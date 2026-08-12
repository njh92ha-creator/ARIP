from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.domain.models import JournalLine
from app.services.event_engine import construct_event


def _line() -> JournalLine:
    return JournalLine(
        company_id=uuid4(), source_row=2, document_number="JE-100",
        posting_date=date(2026, 1, 1), account_code="122500", account_name="현금",
        local_amount=Decimal("100"), debit_credit_indicator="D", fiscal_year=2026,
        fiscal_period=1, header_text="증자",
    )


def test_same_voucher_has_a_different_event_hash_in_a_new_upload_analysis_set() -> None:
    line = _line()

    first = construct_event([line], analysis_set_id="upload-set-1")
    second = construct_event([line], analysis_set_id="upload-set-2")

    assert first.event_hash != second.event_hash
    assert first.canonical_signature["documentNumber"] == "JE-100"
