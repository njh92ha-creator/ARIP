from __future__ import annotations

import logging
from time import perf_counter
from typing import Any

from app.ai.provider import AnalysisProvider, provider_from_settings
from app.core.config import settings
from app.domain.models import AnalysisEventResult, AuditLogEntry, RiskMemoryEntry, utcnow
from app.services.ai_risk_analysis import (
    assign_risk_code,
    build_event_facts,
    risk_from_ai_analysis,
)
from app.services.event_engine import cluster_journals, construct_event


logger = logging.getLogger(__name__)


def _is_timeout(exc: Exception) -> bool:
    return type(exc).__name__ in {"APITimeoutError", "ReadTimeout", "TimeoutException"}


def _save_event_result(
    repo: Any, event: Any, *, status: str, attempts: int, duration_ms: int,
    error: Exception | None = None,
) -> None:
    existing = getattr(repo, "analysis_event_results", {}).get(event.id)
    result = existing or AnalysisEventResult(
        company_id=event.company_id,
        event_id=event.id,
        closing_analysis_set_id=event.closing_analysis_set_id,
        status=status,
        attempts=attempts,
        id=event.id,
    )
    result.status = status
    result.attempts = attempts
    result.duration_ms = duration_ms
    result.error_type = type(error).__name__ if error else ""
    result.error_message = str(error) if error else ""
    result.updated_at = utcnow()
    repo.save(result)


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
    materiality_variances: dict[str, dict[str, str]] | None = None,
    selected_event_ids: set[Any] | None = None,
) -> dict[str, Any]:
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
    retried_events = 0
    skipped_by_materiality = 0
    processed_event_ids: list[str] = []
    clusters = cluster_journals(lines)
    candidates = [(cluster, construct_event(cluster)) for cluster in clusters]
    same_type_voucher_counts = {
        event_type: sum(1 for _, candidate in candidates if candidate.event_type == event_type)
        for event_type in {candidate.event_type for _, candidate in candidates}
    }
    for cluster, candidate in candidates:
        relevant_variances = [
            variance
            for account_code, variance in (materiality_variances or {}).items()
            if any(line.account_code == account_code for line in cluster)
        ]
        if materiality_variances is not None and not relevant_variances:
            skipped_by_materiality += 1
            continue
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
        if selected_event_ids is not None and (prior_event is None or prior_event.id not in selected_event_ids):
            continue
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
            processed_event_ids.append(str(prior_event.id))
            continue
        event = prior_event if (reassess_with_ai or selected_event_ids is not None) else candidate
        if not reassess_with_ai:
            if selected_event_ids is None:
                repo.save(event)
                created_events += 1
        processed_event_ids.append(str(event.id))
        risk = None
        if ai_enabled:
            ai_stage = "provider_initialization"
            try:
                provider = analysis_provider or provider_from_settings(
                    enabled=ai_enabled, chat_model=ai_model,
                    provider=ai_provider, api_key_env=ai_key_env,
                )
                facts = build_event_facts(
                    event,
                    cluster,
                    same_type_voucher_count=same_type_voucher_counts[event.event_type],
                )
                ai_stage = "build_event_facts"
                facts["materialityVariances"] = relevant_variances
                # Closing analysis deliberately relies on the model's K-IFRS
                # reasoning over the transaction facts only. Uploaded knowledge
                # documents are not retrieved or sent to the model on this path.
                references: list[dict[str, str]] = []
                ai_stage = "llm_analysis"
                attempts = 0
                while True:
                    attempts += 1
                    started_at = perf_counter()
                    try:
                        analysis = provider.analyze(facts, references)
                        duration_ms = int((perf_counter() - started_at) * 1000)
                        logger.info("AI analysis completed: event_id=%s attempt=%s duration_ms=%s", event.id, attempts, duration_ms)
                        break
                    except Exception as exc:
                        duration_ms = int((perf_counter() - started_at) * 1000)
                        logger.warning("AI analysis failed: event_id=%s attempt=%s duration_ms=%s error_type=%s", event.id, attempts, duration_ms, type(exc).__name__)
                        if _is_timeout(exc) and attempts == 1:
                            retried_events += 1
                            _save_event_result(repo, event, status="RETRYING", attempts=attempts, duration_ms=duration_ms, error=exc)
                            continue
                        raise
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
                _save_event_result(repo, event, status="COMPLETED" if risk else "NO_ISSUE", attempts=attempts, duration_ms=duration_ms)
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
                _save_event_result(repo, event, status="FAILED", attempts=locals().get("attempts", 1), duration_ms=locals().get("duration_ms", 0), error=exc)
        if risk:
            if not risk.risk_code:
                assign_risk_code(repo, risk, cluster)
            risk.closing_analysis_set_id = event.closing_analysis_set_id
            risk.cross_finding_ids = []
            risk.package.cross_finding_ids = []
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
        "retriedEvents": retried_events,
        "skippedByMateriality": skipped_by_materiality,
        "eventIds": processed_event_ids,
    }
