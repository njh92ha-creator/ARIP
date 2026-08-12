from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.domain.models import (
    AccountingEvent,
    AnalysisRoute,
    JournalLine,
    Risk,
    RiskLevel,
    RiskMemoryEntry,
    RiskPackage,
)
from app.domain.repository import InMemoryRepository
from app.services.risk_auto_pass import (
    MINIMUM_SIMILAR_CASES,
    maybe_auto_pass_risk,
    semantic_source_text,
)
from app.services.risk_review import current_review_decision


def make_risk(repo, company_id, suffix, *, line_text="개발단계 직접귀속 원가 검토", amount="900000000"):
    line = repo.save(JournalLine(
        company_id=company_id, source_row=1, document_number=f"JV-{suffix}",
        posting_date=date(2026, 1, 1), account_code="101000", account_name="개발비",
        local_amount=Decimal(amount), debit_credit_indicator="D", fiscal_year=2026,
        fiscal_period=1, line_text=line_text,
    ))
    event = repo.save(AccountingEvent(
        company_id=company_id, event_type="DEVELOPMENT_COST", title="개발비 검토",
        amount=Decimal(amount), currency="KRW", journal_line_ids=[line.id],
        canonical_signature={}, event_hash=f"hash-{suffix}", classification_confidence=1,
    ))
    package = RiskPackage(
        summary="금액은 비교하지 않습니다.", references=[], expected_questions=["제외"],
        evidence_checklist=["제외"], response_guidance=[], generated_by="AI",
        issue_types=["개발비 자산화 요건"], related_accounts=["개발비"],
        event_inference="개발 단계 지출의 자산화 처리로 추론됩니다.",
        audit_issues=["개발단계 직접귀속성과 인식요건 확인이 필요합니다."],
    )
    return repo.save(Risk(
        company_id=company_id, event_id=event.id, title="개발비 검토", statement="",
        level=RiskLevel.MEDIUM, score=50, route=AnalysisRoute.LLM_KIFRS,
        package=package, risk_code=f"AS_20260101_{suffix:03d}",
    )), [line]


def test_semantic_text_excludes_amounts_questions_and_evidence() -> None:
    repo = InMemoryRepository(persistent=False)
    risk, lines = make_risk(repo, uuid4(), 1, amount="900000000")

    text = semantic_source_text(risk, lines)

    assert "900000000" not in text
    assert "금액" not in text
    assert "제외" not in text
    assert "개발단계 직접귀속성" in text


def test_auto_pass_only_when_ten_close_classified_examples_and_ai_agrees(monkeypatch) -> None:
    repo = InMemoryRepository(persistent=False)
    company_id = uuid4()
    target, target_lines = make_risk(repo, company_id, 99, amount="100000000")
    for number in range(MINIMUM_SIMILAR_CASES):
        prior, _ = make_risk(repo, company_id, number + 1, amount=str(number + 1))
        repo.append_memory(RiskMemoryEntry(
            risk_id=prior.id, entry_type="REVIEW_DECISION", summary="PASS", actor="user",
            metadata={"decision": "CHECK" if number == MINIMUM_SIMILAR_CASES - 1 else "PASS"},
        ))

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        "app.services.risk_auto_pass.embed_texts",
        lambda *args, **kwargs: ("test-embedding", [[1.0, 0.0]]),
    )
    passed = maybe_auto_pass_risk(
        repo, target, target_lines, ai_provider="openai", ai_model="test",
        ai_key_env="OPENAI_API_KEY", embedding_model="test-embedding",
        ask=lambda **_: (True, "same accounting context"),
    )

    assert passed is True
    assert current_review_decision(repo.risk_memory[target.id]) == "PASS"


def test_ai_rejection_leaves_risk_unclassified(monkeypatch) -> None:
    repo = InMemoryRepository(persistent=False)
    company_id = uuid4()
    target, target_lines = make_risk(repo, company_id, 99)
    for number in range(MINIMUM_SIMILAR_CASES):
        prior, _ = make_risk(repo, company_id, number + 1)
        repo.append_memory(RiskMemoryEntry(
            risk_id=prior.id, entry_type="REVIEW_DECISION", summary="PASS", actor="user",
            metadata={"decision": "PASS"},
        ))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        "app.services.risk_auto_pass.embed_texts",
        lambda *args, **kwargs: ("test-embedding", [[1.0, 0.0]]),
    )

    passed = maybe_auto_pass_risk(
        repo, target, target_lines, ai_provider="openai", ai_model="test",
        ai_key_env="OPENAI_API_KEY", embedding_model="test-embedding",
        ask=lambda **_: (False, "not enough substantive consistency"),
    )

    assert passed is False
    assert repo.risk_memory[target.id] == []
