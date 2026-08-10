from datetime import datetime, timezone
from uuid import uuid4

from app.domain.models import RiskMemoryEntry
from app.services.risk_timestamps import latest_analysis_at


def test_latest_analysis_at_returns_the_most_recent_risk_creation() -> None:
    risk_id = uuid4()
    earlier = datetime(2026, 8, 10, 1, 2, tzinfo=timezone.utc)
    latest = datetime(2026, 8, 10, 3, 4, tzinfo=timezone.utc)
    entries = [
        RiskMemoryEntry(risk_id=risk_id, entry_type="RISK_CREATED", summary="first", actor="system", occurred_at=earlier),
        RiskMemoryEntry(risk_id=risk_id, entry_type="STATUS_CHANGED", summary="reviewed", actor="user", occurred_at=latest),
        RiskMemoryEntry(risk_id=risk_id, entry_type="RISK_CREATED", summary="reanalyzed", actor="system", occurred_at=latest),
    ]

    assert latest_analysis_at(entries) == latest


def test_latest_analysis_at_returns_none_without_an_analysis_entry() -> None:
    entry = RiskMemoryEntry(risk_id=uuid4(), entry_type="STATUS_CHANGED", summary="reviewed", actor="user")

    assert latest_analysis_at([entry]) is None
