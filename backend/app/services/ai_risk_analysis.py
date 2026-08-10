from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from app.domain.models import (
    AccountingEvent,
    AnalysisRoute,
    JournalLine,
    MaterialityProfile,
    Risk,
    RiskLevel,
    RiskPackage,
)


def build_event_facts(
    event: AccountingEvent, lines: list[JournalLine]
) -> dict[str, Any]:
    """Create a compact, auditable event payload for one AI call."""
    descriptions = sorted(
        {
            text.strip()
            for line in lines
            for text in (line.header_text, line.line_text)
            if text and text.strip()
        }
    )
    line_facts = [
        {
            "accountCode": line.account_code,
            "accountName": line.account_name,
            "debitCredit": line.debit_credit_indicator,
            "amount": str(line.local_amount),
            "description": " ".join(
                value.strip() for value in (line.header_text, line.line_text) if value.strip()
            ),
        }
        for line in lines
    ]
    return {
        "eventId": str(event.id),
        "eventType": event.event_type,
        "classificationConfidence": event.classification_confidence,
        "amount": str(event.amount),
        "currency": event.currency,
        "accountNames": sorted({line.account_name for line in lines if line.account_name}),
        "accountCodes": sorted({line.account_code for line in lines if line.account_code}),
        "journalDescriptions": descriptions,
        "journalLines": line_facts,
    }


def approved_reference_context(
    company_id: UUID, candidates: dict[str, dict[str, Any]] | None
) -> list[dict[str, str]]:
    """Return only references explicitly approved for the given company."""
    if not candidates:
        return []
    approved: list[dict[str, str]] = []
    for candidate in candidates.values():
        if candidate.get("companyId") != str(company_id):
            continue
        if candidate.get("status") != "APPROVED" or not candidate.get("ragEligible"):
            continue
        approved.append(
            {
                "id": str(candidate["id"]),
                "title": str(candidate.get("relativePath", "approved knowledge")),
                "type": "APPROVED_KNOWLEDGE",
            }
        )
    return approved


def rag_reference_context(retrieved_chunks: list[dict[str, str]]) -> list[dict[str, str]]:
    """Keep the evidence payload explicit and small before it reaches the LLM."""
    return [
        {
            "id": str(chunk["id"]),
            "title": str(chunk["title"]),
            "type": "RAG_CHUNK",
            "locator": str(chunk.get("locator", "본문")),
            "excerpt": str(chunk["excerpt"]),
        }
        for chunk in retrieved_chunks
    ]


def _materiality(event: AccountingEvent, profile: MaterialityProfile | None) -> tuple[str, int]:
    if not profile:
        return "UNCONFIGURED", 0
    if event.amount >= profile.overall_materiality:
        return "HIGH", 20
    if event.amount >= profile.performance_materiality:
        return "MEDIUM", 12
    if event.amount >= profile.trivial_threshold:
        return "LOW", 5
    return "TRIVIAL", 0


def risk_from_ai_analysis(
    event: AccountingEvent,
    materiality: MaterialityProfile | None,
    analysis: dict[str, Any],
    approved_references: list[dict[str, str]],
) -> Risk | None:
    issue_types = [str(item).strip() for item in analysis.get("issueTypes", []) if str(item).strip()]
    summary = str(analysis.get("riskSummary", "")).strip()
    if not issue_types or not summary:
        return None

    requested_ids = {str(item) for item in analysis.get("referenceIds", [])}
    referenced = [item for item in approved_references if item["id"] in requested_ids]
    if requested_ids and not referenced:
        return None
    missing_facts = [
        str(item).strip() for item in analysis.get("missingFacts", []) if str(item).strip()
    ]
    if not referenced and not missing_facts:
        return None
    evidence_status = "SUPPORTED" if referenced else "REFERENCE_PENDING"
    materiality_level, materiality_points = _materiality(event, materiality)
    uncertainty = str(analysis.get("uncertainty", "HIGH"))
    base_score = 62 if evidence_status == "SUPPORTED" else 52
    if uncertainty == "LOW":
        base_score += 8
    elif uncertainty == "HIGH":
        base_score -= 5
    score = max(1, min(100, base_score + materiality_points))
    level = RiskLevel.HIGH if score >= 75 else RiskLevel.MEDIUM if score >= 50 else RiskLevel.LOW
    package_references = [
        {
            "type": item["type"],
            "code": f"{item['title']} · {item.get('locator', '본문')}",
            "status": "APPROVED",
            "excerpt": item.get("excerpt", ""),
        }
        for item in referenced
    ]
    package = RiskPackage(
        summary=summary,
        references=package_references,
        expected_questions=[str(item) for item in analysis.get("expectedQuestions", [])],
        evidence_checklist=[str(item) for item in analysis.get("evidenceChecklist", [])],
        response_guidance=[str(item) for item in analysis.get("responseGuidance", [])],
        generated_by="AI_RAG_SUPPORTED" if referenced else "AI_HYPOTHESIS_RAG_PENDING",
        missing_facts=missing_facts,
        evidence_status=evidence_status,
    )
    title = f"검토 필요: {issue_types[0]}"
    statement = summary
    return Risk(
        company_id=event.company_id,
        event_id=event.id,
        title=title,
        statement=statement,
        level=level,
        score=score,
        route=AnalysisRoute.RAG_LLM,
        package=package,
        materiality_level=materiality_level,
    )
