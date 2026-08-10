from collections.abc import Iterable
from datetime import datetime

from app.domain.models import RiskMemoryEntry


def latest_analysis_at(entries: Iterable[RiskMemoryEntry]) -> datetime | None:
    """Return the latest completed analysis creation timestamp for a risk."""
    timestamps = [
        entry.occurred_at
        for entry in entries
        if entry.entry_type == "RISK_CREATED"
    ]
    return max(timestamps, default=None)
