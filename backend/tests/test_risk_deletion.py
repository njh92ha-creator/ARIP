from decimal import Decimal
from uuid import uuid4

from app.domain.models import AccountingEvent, AnalysisRoute, AuditLogEntry, Risk, RiskLevel, RiskMemoryEntry, RiskPackage
from app.domain.repository import InMemoryRepository


def test_delete_risk_analysis_removes_risk_and_its_history() -> None:
    repo = InMemoryRepository(persistent=False)
    company_id = uuid4()
    event = repo.save(AccountingEvent(
        company_id=company_id, event_type="EVENT", title="Event", amount=Decimal("1"), currency="KRW",
        journal_line_ids=[], canonical_signature={}, event_hash="event", classification_confidence=1,
    ))
    risk = repo.save(Risk(
        company_id=company_id, event_id=event.id, title="Risk", statement="Result", level=RiskLevel.LOW,
        score=1, route=AnalysisRoute.RAG_LLM,
        package=RiskPackage(summary="Result", references=[], expected_questions=[], evidence_checklist=[], response_guidance=[], generated_by="AI_RAG_SUPPORTED"),
    ))
    repo.append_memory(RiskMemoryEntry(risk_id=risk.id, entry_type="RISK_CREATED", summary="created", actor="test"))
    repo.append_audit(AuditLogEntry(action="RISK_CREATED", resource_type="Risk", resource_id=str(risk.id), actor="test", company_id=company_id))

    repo.delete_risk_analysis(risk.id)

    assert risk.id not in repo.risks
    assert risk.id not in repo.risk_memory
    assert all(entry.resource_id != str(risk.id) for entry in repo.audit_log)
    assert event.id in repo.events
