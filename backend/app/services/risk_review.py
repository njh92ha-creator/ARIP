from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from app.domain.models import AccountingEvent, JournalLine, RiskMemoryEntry


REVIEW_DECISIONS = {"CHECK", "PENDING", "PASS"}
RISK_SEVERITIES = {"HIGH", "MEDIUM", "LOW"}


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


def explicit_risk_severity(entries: Iterable[RiskMemoryEntry]) -> str | None:
    severity: str | None = None
    for entry in entries:
        if entry.entry_type != "RISK_SEVERITY":
            continue
        candidate = str(entry.metadata.get("severity", "")).upper()
        if candidate in RISK_SEVERITIES:
            severity = candidate
    return severity


def current_risk_severity(entries: Iterable[RiskMemoryEntry], default: str) -> str:
    return explicit_risk_severity(entries) or default.upper()


def is_visible_in_risk_lists(entries: Iterable[RiskMemoryEntry]) -> bool:
    return (
        current_review_decision(entries) != "PASS"
        and not is_transferred_to_review(entries)
    )


def is_transferred_to_review(entries: Iterable[RiskMemoryEntry]) -> bool:
    return any(entry.entry_type == "RISK_TRANSFERRED" for entry in entries)


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


def _normalized_issue_types(values: Iterable[str]) -> set[str]:
    return {
        re.sub(r"\s+", " ", str(value).strip()).lower()
        for value in values
        if str(value).strip()
    }


def recommend_review_decision(
    event: AccountingEvent,
    lines: list[JournalLine],
    history: Iterable[tuple[Any, ...]],
    *,
    issue_types: Iterable[str] | None = None,
) -> dict[str, Any] | None:
    target_issue_types = _normalized_issue_types(issue_types or [])
    if target_issue_types:
        counts = {decision: 0 for decision in REVIEW_DECISIONS}
        for item in history:
            if len(item) < 4:
                continue
            _, _, entries, prior_issue_types = item
            decision = explicit_review_decision(entries)
            if decision and target_issue_types & _normalized_issue_types(prior_issue_types):
                counts[decision] += 1
        total = sum(counts.values())
        if not total:
            return None
        ordered = sorted(counts.items(), key=lambda item: item[1], reverse=True)
        if len(ordered) > 1 and ordered[0][1] == ordered[1][1]:
            return None
        decision, votes = ordered[0]
        return {
            "decision": decision,
            "confidence": round(votes / total, 2),
            "matched_cases": votes,
            "decision_counts": counts,
        }

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


def recommend_risk_severity(
    event: AccountingEvent,
    lines: list[JournalLine],
    history: Iterable[tuple[Any, ...]],
    *,
    issue_types: Iterable[str] | None = None,
) -> dict[str, Any] | None:
    target_issue_types = _normalized_issue_types(issue_types or [])
    if not target_issue_types:
        return None
    counts = {severity: 0 for severity in RISK_SEVERITIES}
    for item in history:
        if len(item) < 4:
            continue
        _, _, entries, prior_issue_types = item
        severity = explicit_risk_severity(entries)
        if severity and target_issue_types & _normalized_issue_types(prior_issue_types):
            counts[severity] += 1
    total = sum(counts.values())
    if not total:
        return None
    ordered = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    if len(ordered) > 1 and ordered[0][1] == ordered[1][1]:
        return None
    severity, votes = ordered[0]
    return {
        "severity": severity,
        "confidence": round(votes / total, 2),
        "matched_cases": votes,
        "severity_counts": counts,
    }
