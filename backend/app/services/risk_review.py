from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from app.domain.models import AccountingEvent, JournalLine, RiskMemoryEntry


REVIEW_DECISIONS = {"CHECK", "PENDING", "PASS"}


def explicit_review_decision(entries: Iterable[RiskMemoryEntry]) -> str | None:
    decision: str | None = None
    for entry in entries:
        if entry.entry_type != "REVIEW_DECISION":
            continue
        candidate = str(entry.metadata.get("decision", "")).upper()
        if candidate in REVIEW_DECISIONS:
            decision = candidate
    return decision


def current_review_decision(entries: Iterable[RiskMemoryEntry]) -> str:
    return explicit_review_decision(entries) or "CHECK"


def is_visible_in_risk_lists(entries: Iterable[RiskMemoryEntry]) -> bool:
    return current_review_decision(entries) != "PASS"


def _features(event: AccountingEvent, lines: Iterable[JournalLine]) -> set[str]:
    text = " ".join(
        [event.event_type, event.title]
        + [
            " ".join(
                value for value in (line.account_code, line.account_name, line.header_text, line.line_text) if value
            )
            for line in lines
        ]
    ).lower()
    tokens = set(re.findall(r"[가-힣a-z0-9]{2,}", text))
    return {f"event:{event.event_type}", *tokens}


def recommend_review_decision(
    event: AccountingEvent,
    lines: list[JournalLine],
    history: Iterable[tuple[AccountingEvent, list[JournalLine], list[RiskMemoryEntry]]],
) -> dict[str, Any] | None:
    target_features = _features(event, lines)
    votes: dict[str, float] = defaultdict(float)
    matched_cases: dict[str, int] = defaultdict(int)
    for prior_event, prior_lines, entries in history:
        decision = explicit_review_decision(entries)
        if not decision:
            continue
        overlap = len(target_features & _features(prior_event, prior_lines))
        if overlap == 0:
            continue
        votes[decision] += overlap
        matched_cases[decision] += 1
    if not votes:
        return None
    ordered = sorted(votes.items(), key=lambda item: item[1], reverse=True)
    if len(ordered) > 1 and ordered[0][1] == ordered[1][1]:
        return None
    decision, score = ordered[0]
    return {
        "decision": decision,
        "confidence": round(score / sum(votes.values()), 2),
        "matched_cases": matched_cases[decision],
    }
