from __future__ import annotations

import json
import logging
import os
from typing import Any

from app.ai.provider import AnalysisProvider, provider_from_settings
from app.core.config import settings
from app.domain.models import AuditLogEntry, RiskMemoryEntry
from app.services.ai_risk_analysis import (
    build_event_facts,
    rag_reference_context,
    risk_from_ai_analysis,
)
from app.services.knowledge_rag import retrieve_reference_context
from app.services.event_engine import cluster_journals, construct_event


logger = logging.getLogger(__name__)


def process_journals(
    repo: Any,
    lines: list,
    *,
    actor: str,
    knowledge_candidates: dict[str, dict[str, Any]] | None = None,
    analysis_provider: AnalysisProvider | None = None,
    external_ai_enabled: bool | None = None,
    ai_model: str | None = None,
    ai_provider: str = "openai",
    ai_key_env: str | None = None,
    embedding_model: str | None = None,
    cross_findings: list[Any] | None = None,
) -> dict[str, int]:
    for line in lines:
        repo.save(line)
        repo.processed_source_hashes.add(line.source_hash)
    company_id = lines[0].company_id if lines else None
    materiality = next(
        (
            profile
            for profile in repo.materiality_profiles.values()
            if profile.company_id == company_id and profile.status == "APPROVED"
        ),
        None,
    )
    created_events = 0
    reused_events = 0
    created_risks = 0
    for cluster in cluster_journals(lines):
        candidate = construct_event(cluster)
        candidate.closing_analysis_set_id = cluster[0].closing_analysis_set_id
        prior_event = repo.event_by_hash(candidate.company_id, candidate.event_hash)
        prior_risk = (
            next(
                (
                    risk
                    for risk in repo.risks.values()
                    if prior_event and risk.event_id == prior_event.id
                ),
                None,
            )
            if prior_event
            else None
        )
        same_pattern = (
            prior_event
            and prior_risk
            and set(prior_event.journal_line_ids) == set(candidate.journal_line_ids)
        )
        ai_enabled = (
            analysis_provider is not None
            or settings.enable_external_ai
            if external_ai_enabled is None
            else external_ai_enabled
        )
        # Reanalysis is driven only by the RAG-supported AI path.  Legacy
        # deterministic routes cannot create a new risk in this workflow.
        reassess_with_ai = bool(same_pattern and ai_enabled)
        if same_pattern and not reassess_with_ai:
            reused_events += 1
            continue
        event = prior_event if reassess_with_ai else candidate
        if not reassess_with_ai:
            repo.save(event)
            created_events += 1
        risk = None
        if ai_enabled:
            ai_stage = "provider_initialization"
            try:
                provider = analysis_provider or provider_from_settings(
                    enabled=ai_enabled, chat_model=ai_model,
                    provider=ai_provider, api_key_env=ai_key_env,
                )
                facts = build_event_facts(event, cluster)
                ai_stage = "build_event_facts"
                linked_findings = [
                    finding
                    for finding in (cross_findings or [])
                    if set(finding.journal_line_ids).intersection(candidate.journal_line_ids)
                ]
                if linked_findings:
                    facts["crossAnalysisFindings"] = [
                        {
                            "id": str(finding.id),
                            "type": finding.finding_type,
                            "title": finding.title,
                            "statement": finding.statement,
                            "accountCode": finding.account_code,
                            "amount": str(finding.amount),
                            "metadata": finding.metadata,
                        }
                        for finding in linked_findings
                    ]
                # Retrieval is deliberately performed per accounting event.  The
                # LLM receives only these selected excerpts, never every uploaded
                # standard or its file bytes.
                if analysis_provider is not None:
                    # Unit/integration callers can supply a deterministic provider
                    # without requiring a live vector store.
                    retrieved = []
                else:
                    ai_stage = "retrieve_reference_context"
                    key_env = ai_key_env or "OPENAI_API_KEY"
                    api_key = os.getenv(key_env)
                    if not api_key:
                        raise RuntimeError(f"{key_env} is not configured")
                    retrieved = retrieve_reference_context(
                        company_id=event.company_id,
                        query=json.dumps(facts, ensure_ascii=False),
                        provider=ai_provider,
                        api_key=api_key,
                        embedding_model=embedding_model,
                    )
                references = rag_reference_context(retrieved)
                ai_stage = "llm_analysis"
                analysis = provider.analyze(facts, references)
                ai_stage = "risk_from_ai_analysis"
                generated_risk = risk_from_ai_analysis(event, materiality, analysis, references)
                if reassess_with_ai and prior_risk and generated_risk:
                    # Keep the existing risk identity and history while replacing
                    # its generic fallback contents with the AI assessment.
                    prior_risk.title = generated_risk.title
                    prior_risk.statement = generated_risk.statement
                    prior_risk.level = generated_risk.level
                    prior_risk.score = generated_risk.score
                    prior_risk.route = generated_risk.route
                    prior_risk.package = generated_risk.package
                    prior_risk.materiality_level = generated_risk.materiality_level
                    prior_risk.row_version += 1
                    risk = prior_risk
                else:
                    risk = generated_risk
            except Exception as exc:
                # Preserve the safe fallback while making an operational failure
                # diagnosable without writing secrets or source document contents.
                logger.warning(
                    "AI RAG analysis fallback: stage=%s event_id=%s error_type=%s error=%s",
                    ai_stage,
                    event.id,
                    type(exc).__name__,
                    str(exc),
                )
                # A failed AI/RAG call is not replaced with a fixed template or
                # generic review risk.  The import still completes without an
                # unsupported audit conclusion.
                risk = None
        if risk:
            linked_finding_ids = [
                finding.id
                for finding in (cross_findings or [])
                if set(finding.journal_line_ids).intersection(candidate.journal_line_ids)
            ]
            risk.closing_analysis_set_id = event.closing_analysis_set_id
            risk.cross_finding_ids = linked_finding_ids
            risk.package.cross_finding_ids = linked_finding_ids
            repo.save(risk)
            repo.append_memory(
                RiskMemoryEntry(
                    risk_id=risk.id,
                    entry_type="RISK_CREATED",
                    summary=f"{risk.route.value} 경로로 생성",
                    actor=actor,
                    metadata={
                        "eventHash": candidate.event_hash,
                        "sourceRiskId": str(prior_risk.id) if prior_risk else None,
                    },
                )
            )
            repo.append_audit(
                AuditLogEntry(
                    action="RISK_CREATED",
                    resource_type="Risk",
                    resource_id=str(risk.id),
                    actor=actor,
                    company_id=event.company_id,
                    reason=risk.route.value,
                )
            )
            if not reassess_with_ai:
                created_risks += 1
    return {
        "journalLines": len(lines),
        "events": created_events,
        "reusedPatterns": reused_events,
        "risks": created_risks,
    }
