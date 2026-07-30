from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from decimal import Decimal
from typing import Iterable

from app.domain.models import AccountingEvent, JournalLine


SIGNATURE_VERSION = "2.0.0"


def _amount_band(amount: Decimal) -> str:
    absolute = abs(amount)
    if absolute < Decimal("1000000"):
        return "LT_1M"
    if absolute < Decimal("100000000"):
        return "1M_100M"
    if absolute < Decimal("1000000000"):
        return "100M_1B"
    if absolute < Decimal("10000000000"):
        return "1B_10B"
    return "GE_10B"


def _text_tokens(lines: Iterable[JournalLine]) -> list[str]:
    text = " ".join(f"{line.header_text} {line.line_text}" for line in lines).lower()
    tokens = re.findall(r"[가-힣a-z0-9]{2,}", text)
    return sorted(set(tokens))[:20]


def infer_event_type(lines: list[JournalLine]) -> tuple[str, float]:
    names = " ".join(line.account_name for line in lines)
    text = f"{names} {' '.join(line.header_text + ' ' + line.line_text for line in lines)}"
    rules = [
        ("개발비", "DEVELOPMENT_COST_CAPITALIZATION"),
        ("무형자산", "INTANGIBLE_ASSET"),
        ("리스", "LEASE"),
        ("충당부채", "PROVISION"),
        ("재고", "INVENTORY"),
        ("매출", "REVENUE_RECOGNITION"),
        ("손상", "IMPAIRMENT"),
        ("정부보조", "GOVERNMENT_GRANT"),
        ("법인세", "INCOME_TAX"),
        ("유형자산", "PROPERTY_PLANT_EQUIPMENT"),
    ]
    for keyword, event_type in rules:
        if keyword in text:
            return event_type, 0.92
    return "UNCLASSIFIED_ACCOUNTING_EVENT", 0.45


def cluster_journals(lines: Iterable[JournalLine]) -> list[list[JournalLine]]:
    clusters: dict[tuple[str, str, str, str], list[JournalLine]] = defaultdict(list)
    for line in lines:
        dimension = line.contract_code or line.project_code or line.document_number
        key = (
            str(line.company_id),
            f"{line.fiscal_year:04d}-{line.fiscal_period:02d}",
            line.document_number,
            dimension,
        )
        clusters[key].append(line)
    return list(clusters.values())


def construct_event(lines: list[JournalLine], currency: str = "KRW") -> AccountingEvent:
    if not lines:
        raise ValueError("at least one journal line is required")
    event_type, confidence = infer_event_type(lines)
    debit = sum(
        (line.local_amount for line in lines if line.debit_credit_indicator == "D"),
        Decimal("0"),
    )
    credit = sum(
        (line.local_amount for line in lines if line.debit_credit_indicator == "C"),
        Decimal("0"),
    )
    amount = max(debit, credit)
    account_pairs = sorted(
        {f"{line.debit_credit_indicator}:{line.account_code}" for line in lines}
    )
    signature = {
        "version": SIGNATURE_VERSION,
        "companyId": str(lines[0].company_id),
        "eventType": event_type,
        "accountSet": account_pairs,
        "amountBand": _amount_band(amount),
        "currency": currency,
        "projectPresent": any(line.project_code for line in lines),
        "contractPresent": any(line.contract_code for line in lines),
        "tokens": _text_tokens(lines),
    }
    canonical = json.dumps(
        signature, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    event_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    title = event_type.replace("_", " ").title()
    return AccountingEvent(
        company_id=lines[0].company_id,
        event_type=event_type,
        title=title,
        amount=amount,
        currency=currency,
        journal_line_ids=[line.id for line in lines],
        canonical_signature=signature,
        event_hash=event_hash,
        classification_confidence=confidence,
        status="ROUTED" if confidence >= 0.70 else "REVIEW_REQUIRED",
    )

