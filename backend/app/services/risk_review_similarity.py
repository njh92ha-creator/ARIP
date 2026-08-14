"""Semantic links from a new risk to cleared risk-review cases."""

from __future__ import annotations

import hashlib
import math
import os
from typing import Any

from app.domain.models import Risk, RiskReviewCase, RiskReviewSemanticEmbedding
from app.services.knowledge_rag import embed_texts
SIMILARITY_THRESHOLD = 0.62
MAX_SIMILAR_CASES = 3


def _content_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left or not right:
        return 0.0
    denominator = math.sqrt(sum(value * value for value in left)) * math.sqrt(sum(value * value for value in right))
    return sum(a * b for a, b in zip(left, right, strict=True)) / denominator if denominator else 0.0


def review_case_source_text(repo: Any, review_case: RiskReviewCase) -> str:
    """Use only the transferred risk's overall judgment for semantic comparison."""
    return str(review_case.package.summary or "").strip()


def _embedding_for_review_case(repo: Any, review_case: RiskReviewCase, source_text: str, *, provider: str, api_key: str, embedding_model: str) -> RiskReviewSemanticEmbedding:
    source_hash = _content_hash(source_text)
    existing = repo.risk_review_semantic_embeddings.get(review_case.id)
    if existing and existing.content_hash == source_hash and existing.embedding_model == embedding_model:
        return existing
    effective_model, vectors = embed_texts([source_text], provider=provider, api_key=api_key, embedding_model=embedding_model)
    if not vectors:
        raise RuntimeError("review-case embedding was not returned")
    return repo.save(RiskReviewSemanticEmbedding(id=review_case.id, review_case_id=review_case.id, company_id=review_case.company_id, content_hash=source_hash, embedding_model=effective_model, embedding=vectors[0]))


def find_cleared_review_similarities(repo: Any, risk: Risk, lines: list[Any], *, ai_provider: str, ai_key_env: str | None, embedding_model: str | None) -> list[dict[str, Any]]:
    """Return cleared review cases with a semantic link. Never blocks analysis."""
    api_key = os.getenv(ai_key_env or "OPENAI_API_KEY")
    target_text = str(risk.package.summary or "").strip()
    if not api_key or not target_text:
        return []
    cleared_cases = [item for item in repo.review_cases_for_company(risk.company_id) if item.status == "CLEARED" and item.source_risk_id != risk.id]
    if not cleared_cases:
        return []
    try:
        model, vectors = embed_texts([target_text], provider=ai_provider, api_key=api_key, embedding_model=embedding_model or "text-embedding-3-large")
        if not vectors:
            return []
        matches: list[dict[str, Any]] = []
        for review_case in cleared_cases:
            review_text = review_case_source_text(repo, review_case)
            if not review_text:
                continue
            embedding = _embedding_for_review_case(repo, review_case, review_text, provider=ai_provider, api_key=api_key, embedding_model=model)
            similarity = _cosine_similarity(vectors[0], embedding.embedding)
            if similarity >= SIMILARITY_THRESHOLD:
                matches.append({"riskCode": review_case.risk_code, "title": review_case.title, "reviewDecision": review_case.review_decision, "severity": review_case.severity, "similarity": round(similarity, 4)})
        return sorted(matches, key=lambda item: item["similarity"], reverse=True)[:MAX_SIMILAR_CASES]
    except Exception:
        return []
