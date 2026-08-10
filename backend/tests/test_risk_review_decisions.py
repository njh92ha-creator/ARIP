from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.domain.models import AccountingEvent, JournalLine, RiskMemoryEntry
from app.services.risk_review import current_review_decision, is_visible_in_risk_lists, recommend_review_decision


def make_event_and_lines(document_number: str, account_code: str = "211000"):
    company_id = uuid4()
    event = AccountingEvent(
        company_id=company_id,
        event_type="UNCLASSIFIED_ACCOUNTING_EVENT",
        title="Borrowing",
        amount=Decimal("100000000"),
        currency="KRW",
        journal_line_ids=[],
        canonical_signature={},
        event_hash=document_number,
        classification_confidence=0.45,
    )
    line = JournalLine(
        company_id=company_id,
        source_row=1,
        document_number=document_number,
        posting_date=date(2026, 8, 10),
        account_code=account_code,
        account_name="단기차입금",
        local_amount=Decimal("100000000"),
        debit_credit_indicator="C",
        fiscal_year=2026,
        fiscal_period=8,
        line_text="은행 차입금 실행",
    )
    return event, [line]


def test_current_review_decision_defaults_to_check() -> None:
    assert current_review_decision([]) == "CHECK"


def test_latest_explicit_review_decision_wins() -> None:
    risk_id = uuid4()
    entries = [
        RiskMemoryEntry(risk_id=risk_id, entry_type="REVIEW_DECISION", summary="CHECK", actor="user", metadata={"decision": "CHECK"}),
        RiskMemoryEntry(risk_id=risk_id, entry_type="REVIEW_DECISION", summary="PASS", actor="user", metadata={"decision": "PASS"}),
    ]

    assert current_review_decision(entries) == "PASS"


def test_pass_decision_is_hidden_from_risk_lists() -> None:
    entries = [
        RiskMemoryEntry(
            risk_id=uuid4(), entry_type="REVIEW_DECISION", summary="PASS", actor="user",
            metadata={"decision": "PASS"},
        )
    ]

    assert is_visible_in_risk_lists(entries) is False


def test_similar_explicit_history_recommends_its_decision() -> None:
    target_event, target_lines = make_event_and_lines("JE-2")
    prior_event, prior_lines = make_event_and_lines("JE-1")
    prior_entries = [
        RiskMemoryEntry(
            risk_id=uuid4(), entry_type="REVIEW_DECISION", summary="PENDING", actor="user",
            metadata={"decision": "PENDING"},
        )
    ]

    recommendation = recommend_review_decision(
        target_event, target_lines, [(prior_event, prior_lines, prior_entries)]
    )

    assert recommendation == {"decision": "PENDING", "confidence": 1.0, "matched_cases": 1}
