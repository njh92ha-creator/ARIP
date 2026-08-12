"""Private, amount-free semantic PASS automation for source risks."""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
from collections.abc import Callable, Iterable
from typing import Any

from app.domain.models import AccountingEvent, JournalLine, Risk, RiskMemoryEntry, RiskSemanticEmbedding
from app.services.knowledge_rag import embed_texts
from app.services.risk_review import explicit_review_decision


MINIMUM_SIMILAR_CASES = 10
SIMILARITY_THRESHOLD = 0.88
_AMOUNT_PATTERN = re.compile(
    r"(?:\d[\d,\.]*\s*(?:원|KRW|억(?:원)?|천만(?:원)?|백만(?:원)?|만원)|"
    r"(?:금액|잔액|증가|감소)\s*[:：]?\s*\d[\d,\.]*)",
    re.IGNORECASE,
)


def semantic_source_text(risk: Risk, lines: Iterable[JournalLine]) -> str:
    """Build the private comparison text, intentionally excluding amounts and Q&A."""
    package = risk.package
    descriptions = [
        " ".join(value.strip() for value in (line.header_text, line.line_text) if value and value.strip())
        for line in lines
    ]
    sections = (
        list(package.issue_types)
        + [package.event_inference]
        + list(package.audit_issues)
        + list(package.related_accounts)
        + descriptions
    )
    cleaned = []
    for value in sections:
        text = _AMOUNT_PATTERN.sub("", str(value or ""))
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            cleaned.append(text)
    return "\n".join(cleaned)


def _content_hash(source_text: str) -> str:
    return hashlib.sha256(source_text.encode("utf-8")).hexdigest()


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left or not right:
        return 0.0
    denominator = math.sqrt(sum(value * value for value in left)) * math.sqrt(sum(value * value for value in right))
    if not denominator:
        return 0.0
    return sum(a * b for a, b in zip(left, right, strict=True)) / denominator


def _embedding_for(
    repo: Any,
    risk: Risk,
    source_text: str,
    *,
    embedding_model: str,
    provider: str,
    api_key: str,
) -> RiskSemanticEmbedding:
    source_hash = _content_hash(source_text)
    existing = repo.risk_semantic_embeddings.get(risk.id)
    if (
        existing is not None
        and existing.content_hash == source_hash
        and existing.embedding_model == embedding_model
    ):
        return existing
    effective_model, vectors = embed_texts(
        [source_text], provider=provider, api_key=api_key, embedding_model=embedding_model
    )
    if not vectors:
        raise RuntimeError("risk semantic embedding was not returned")
    embedding = RiskSemanticEmbedding(
        id=risk.id,
        risk_id=risk.id,
        company_id=risk.company_id,
        content_hash=source_hash,
        embedding_model=effective_model,
        embedding=vectors[0],
    )
    return repo.save(embedding)


def _ask_auto_pass(
    *, model: str, api_key: str, target: str, matches: list[dict[str, Any]]
) -> tuple[bool, str]:
    """Ask the configured AI to compare prior human classifications."""
    from openai import OpenAI

    response = OpenAI(api_key=api_key).responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": (
                    "You decide only whether a new accounting audit risk should be automatically "
                    "classified PASS after comparing it with prior human-classified cases. Amounts "
                    "are excluded and must not be inferred. Consider which individual cases are "
                    "semantically closest, not a majority vote. Return autoPass=true only when the "
                    "new risk is materially consistent with the close PASS cases and distinguishable "
                    "from any close CHECK or PENDING cases. If uncertain, return false."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {"newRisk": target, "similarCases": matches}, ensure_ascii=False
                ),
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "arip_auto_pass_decision",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "autoPass": {"type": "boolean"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["autoPass", "rationale"],
                    "additionalProperties": False,
                },
            }
        },
    )
    result = json.loads(response.output_text)
    return bool(result["autoPass"]), str(result["rationale"])


def maybe_auto_pass_risk(
    repo: Any,
    risk: Risk,
    lines: list[JournalLine],
    *,
    ai_provider: str,
    ai_model: str | None,
    ai_key_env: str | None,
    embedding_model: str | None,
    actor: str = "system",
    ask: Callable[..., tuple[bool, str]] = _ask_auto_pass,
) -> bool:
    """Persist PASS only after 10 close historical cases and an AI comparison.

    No CHECK or PENDING value is created by this function. Any ineligible or
    uncertain result leaves the risk untouched and visible.
    """
    memory = getattr(repo, "risk_memory", {})
    risks = getattr(repo, "risks", {})
    if not isinstance(memory, dict) or not isinstance(risks, dict):
        return False
    if explicit_review_decision(memory.get(risk.id, [])) is not None:
        return False
    if ai_provider.lower() != "openai" or not ai_model:
        return False
    api_key = os.getenv(ai_key_env or "OPENAI_API_KEY")
    if not api_key:
        return False
    prior_classified = [
        prior for prior in risks.values()
        if prior.company_id == risk.company_id
        and prior.id != risk.id
        and explicit_review_decision(memory.get(prior.id, [])) is not None
    ]
    if len(prior_classified) < MINIMUM_SIMILAR_CASES:
        return False

    target_text = semantic_source_text(risk, lines)
    if not target_text:
        return False
    try:
        target_embedding = _embedding_for(
            repo, risk, target_text,
            embedding_model=embedding_model or "text-embedding-3-large",
            provider=ai_provider, api_key=api_key,
        )
        matches: list[dict[str, Any]] = []
        for prior in prior_classified:
            prior_event = repo.events.get(prior.event_id)
            prior_lines = [
                line for line in repo.journal_lines.values()
                if prior_event and line.id in prior_event.journal_line_ids
            ]
            prior_text = semantic_source_text(prior, prior_lines)
            if not prior_text:
                continue
            prior_embedding = _embedding_for(
                repo, prior, prior_text,
                embedding_model=target_embedding.embedding_model,
                provider=ai_provider, api_key=api_key,
            )
            similarity = _cosine_similarity(target_embedding.embedding, prior_embedding.embedding)
            if similarity >= SIMILARITY_THRESHOLD:
                matches.append(
                    {
                        "riskId": prior.risk_code or str(prior.id),
                        "decision": explicit_review_decision(memory.get(prior.id, [])),
                        "similarity": round(similarity, 4),
                        "text": prior_text[:4000],
                    }
                )
        matches.sort(key=lambda item: item["similarity"], reverse=True)
        if len(matches) < MINIMUM_SIMILAR_CASES:
            return False
        auto_pass, rationale = ask(
            model=ai_model, api_key=api_key, target=target_text[:4000],
            matches=matches[:MINIMUM_SIMILAR_CASES],
        )
    except Exception:
        # Auto-PASS is optional: analysis output must remain available if this
        # auxiliary comparison cannot run.
        return False
    if not auto_pass:
        return False
    repo.append_memory(
        RiskMemoryEntry(
            risk_id=risk.id,
            entry_type="REVIEW_DECISION",
            summary="Automatic PASS from semantic comparison",
            actor=actor,
            metadata={
                "decision": "PASS",
                "source": "SEMANTIC_AUTO_PASS",
                "similar_case_count": len(matches),
                "threshold": SIMILARITY_THRESHOLD,
                "rationale": rationale,
            },
        )
    )
    return True
