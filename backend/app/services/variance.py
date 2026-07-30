from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Iterable
from uuid import UUID

from app.domain.models import (
    AccountCategory,
    VarianceObservation,
    VarianceProfile,
    VarianceThreshold,
)
from app.services.import_pipeline import SettlementRow


CATEGORY_ALIASES = {
    "자산": AccountCategory.ASSET,
    "ASSET": AccountCategory.ASSET,
    "부채": AccountCategory.LIABILITY,
    "LIABILITY": AccountCategory.LIABILITY,
    "자본": AccountCategory.EQUITY,
    "EQUITY": AccountCategory.EQUITY,
    "수익": AccountCategory.REVENUE,
    "REVENUE": AccountCategory.REVENUE,
    "비용": AccountCategory.EXPENSE,
    "EXPENSE": AccountCategory.EXPENSE,
    "가계정": AccountCategory.SUSPENSE,
    "SUSPENSE": AccountCategory.SUSPENSE,
}

CHECKLIST = {
    AccountCategory.ASSET: ["신규 취득·처분·대체 확인", "감가상각·손상 검토"],
    AccountCategory.LIABILITY: ["차입·상환 확인", "충당부채·미지급비용 검토"],
    AccountCategory.EQUITY: ["증자·감자·배당·연결조정 확인"],
    AccountCategory.REVENUE: ["기간귀속(Cut-off) 확인", "수행의무·변동대가 검토"],
    AccountCategory.EXPENSE: ["미지급·선급 확인", "자본화 여부 검토"],
    AccountCategory.SUSPENSE: ["장기 미결 확인", "실질계정 재분류 검토"],
    AccountCategory.OTHER: ["증감 원인과 계정 성격 확인"],
}


def _threshold(profile: VarianceProfile, comparison: str) -> VarianceThreshold:
    for threshold in profile.thresholds:
        if threshold.comparison == comparison:
            return threshold
    raise ValueError(f"threshold not configured: {comparison}")


def monthly_values(rows: Iterable[SettlementRow]) -> dict[tuple[str, str], Decimal]:
    grouped = {(row.period, row.account_code): row for row in rows}
    result: dict[tuple[str, str], Decimal] = {}
    for key, row in grouped.items():
        category = CATEGORY_ALIASES.get(row.category, AccountCategory.OTHER)
        if (
            category in {AccountCategory.REVENUE, AccountCategory.EXPENSE}
            and row.measurement_basis == "YTD_CUMULATIVE"
        ):
            year, month = map(int, row.period.split("-"))
            previous = grouped.get((f"{year:04d}-{month - 1:02d}", row.account_code)) if month > 1 else None
            result[key] = row.amount - (previous.amount if previous else Decimal("0"))
        else:
            result[key] = row.amount
    return result


def analyze_variance(
    company_id: UUID,
    rows: list[SettlementRow],
    profile: VarianceProfile,
    target_period: str,
    comparison: str,
) -> list[VarianceObservation]:
    values = monthly_values(rows)
    year, month = map(int, target_period.split("-"))
    if comparison == "MOM":
        compare_period = f"{year - 1:04d}-12" if month == 1 else f"{year:04d}-{month - 1:02d}"
    elif comparison == "YOY":
        compare_period = f"{year - 1:04d}-{month:02d}"
    else:
        raise ValueError("comparison must be MOM or YOY")
    threshold = _threshold(profile, comparison)
    row_by_account = {
        row.account_code: row for row in rows if row.period == target_period
    }
    observations: list[VarianceObservation] = []
    for account_code, row in row_by_account.items():
        current = values.get((target_period, account_code), Decimal("0"))
        previous = values.get((compare_period, account_code), Decimal("0"))
        delta = current - previous
        delta_rate = (
            abs(delta) / abs(previous)
            if abs(previous) >= threshold.minimum_base_amount and previous != 0
            else None
        )
        amount_hit = abs(delta) >= threshold.amount_threshold
        rate_hit = delta_rate is not None and delta_rate >= threshold.rate_threshold
        triggered = (
            (amount_hit or rate_hit)
            if threshold.trigger_mode == "ANY"
            else (amount_hit and rate_hit)
        )
        if not triggered:
            continue
        reasons = []
        if amount_hit:
            reasons.append("AMOUNT")
        if rate_hit:
            reasons.append("RATE")
        category = CATEGORY_ALIASES.get(row.category, AccountCategory.OTHER)
        measurement_basis = (
            "MONTHLY_FLOW_FROM_YTD"
            if category in {AccountCategory.REVENUE, AccountCategory.EXPENSE}
            and row.measurement_basis == "YTD_CUMULATIVE"
            else row.measurement_basis
        )
        observations.append(
            VarianceObservation(
                company_id=company_id,
                period=target_period,
                account_code=account_code,
                account_name=row.account_name,
                category=category,
                comparison=comparison,
                measurement_basis=measurement_basis,
                current_value=current,
                comparison_value=previous,
                delta_amount=delta,
                delta_rate=delta_rate,
                triggered_by=reasons,
                checklist=CHECKLIST[category],
            )
        )
    return observations

