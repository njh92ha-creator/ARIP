from __future__ import annotations

from typing import Any

from app.ai.provider import AnalysisProvider, provider_from_settings
from app.core.config import settings
from app.domain.models import AuditLogEntry, RiskMemoryEntry
from app.services.ai_risk_analysis import (
    approved_reference_context,
    build_event_facts,
    risk_from_ai_analysis,
)
from app.services.event_engine import cluster_journals, construct_event
from app.services.risk_engine import analyze_event


def process_journals(
    repo: Any,
    lines: list,
    *,
    actor: str,
    knowledge_candidates: dict[str, dict[str, Any]] | None = None,
    analysis_provider: AnalysisProvider | None = None,
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
        if prior_event and prior_risk:
            reused_events += 1
            continue
        repo.save(candidate)
        created_events += 1
        ai_enabled = analysis_provider is not None or settings.enable_external_ai
        risk = analyze_event(
            candidate,
            materiality,
            prior_risk=prior_risk,
            external_ai_available=ai_enabled,
        )
        if risk is None and ai_enabled:
            try:
                provider = analysis_provider or provider_from_settings()
                references = approved_reference_context(
                    candidate.company_id, knowledge_candidates
                )
                analysis = provider.analyze(build_event_facts(candidate, cluster), references)
                risk = risk_from_ai_analysis(candidate, materiality, analysis, references)
            except Exception:
                # AI is an analysis enhancement, never an import dependency.  This
                # boundary also covers SDK/network/provider failures; the
                # deterministic review route preserves human review without treating
                # an unavailable AI response as evidence.
                risk = analyze_event(
                    candidate,
                    materiality,
                    prior_risk=prior_risk,
                    external_ai_available=False,
                )
        if risk:
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
                    company_id=candidate.company_id,
                    reason=risk.route.value,
                )
            )
            created_risks += 1
    return {
        "journalLines": len(lines),
        "events": created_events,
        "reusedPatterns": reused_events,
        "risks": created_risks,
    }
