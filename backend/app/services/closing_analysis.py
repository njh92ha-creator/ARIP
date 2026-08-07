from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.domain.models import (
    AnalysisRoute,
    ClosingAnalysisSet,
    ClosingAnalysisStatus,
    CrossAnalysisFinding,
    ReconciliationStatus,
    Risk,
    RiskLevel,
    RiskMemoryEntry,
    RiskPackage,
    SettlementBalance,
    utcnow,
)
from app.services.import_pipeline import SettlementRow
from app.services.orchestrator import process_journals
from app.services.variance import analyze_variance


def create_closing_analysis_set(
    repo: Any, company_id: UUID, fiscal_year: int = 0, fiscal_period: int = 0
) -> ClosingAnalysisSet:
    """Return the single paired analysis container for company uploads."""
    if fiscal_period and (fiscal_period < 1 or fiscal_period > 12):
        raise ValueError("fiscal_period must be between 1 and 12")
    existing = repo.closing_set_by_scope(company_id, fiscal_year, fiscal_period)
    if existing:
        return existing
    return repo.save(
        ClosingAnalysisSet(
            company_id=company_id,
            fiscal_year=fiscal_year,
            fiscal_period=fiscal_period,
        )
    )


def attach_general_ledger(
    repo: Any,
    closing_set: ClosingAnalysisSet,
    lines: list[Any],
    *,
    mapping_profile_id: UUID | None = None,
) -> ClosingAnalysisSet:
    for line in lines:
        line.closing_analysis_set_id = closing_set.id
        repo.save(line)
        repo.processed_source_hashes.add(line.source_hash)
    closing_set.general_ledger_mapping_profile_id = mapping_profile_id
    closing_set.general_ledger_ready = bool(lines) or bool(repo.lines_for_set(closing_set.id))
    _refresh_set_status(closing_set)
    return repo.save(closing_set)


def attach_settlement_schedule(
    repo: Any,
    closing_set: ClosingAnalysisSet,
    balances: list[SettlementBalance],
    *,
    mapping_profile_id: UUID | None = None,
) -> ClosingAnalysisSet:
    for existing in repo.settlement_for_set(closing_set.id):
        repo.remove(existing)
    for balance in balances:
        balance.closing_analysis_set_id = closing_set.id
        balance.company_id = closing_set.company_id
        balance.fiscal_year = closing_set.fiscal_year
        balance.fiscal_period = closing_set.fiscal_period
        repo.save(balance)
    closing_set.settlement_mapping_profile_id = mapping_profile_id
    closing_set.settlement_ready = bool(balances)
    _refresh_set_status(closing_set)
    return repo.save(closing_set)


def settlement_balances_from_rows(
    company_id: UUID,
    rows: list[SettlementRow],
    fiscal_year: int,
    fiscal_period: int,
) -> list[SettlementBalance]:
    return [
        SettlementBalance(
            company_id=company_id,
            fiscal_year=fiscal_year,
            fiscal_period=fiscal_period,
            account_code=row.account_code,
            account_name=row.account_name,
            category=row.category,
            amount=row.amount,
            measurement_basis=row.measurement_basis,
        )
        for row in rows
    ]


def _refresh_set_status(closing_set: ClosingAnalysisSet) -> None:
    if closing_set.is_ready and closing_set.status == ClosingAnalysisStatus.DRAFT:
        closing_set.status = ClosingAnalysisStatus.READY
    elif not closing_set.is_ready:
        closing_set.status = ClosingAnalysisStatus.DRAFT
    closing_set.updated_at = utcnow()


def _signed_amount(line: Any) -> Decimal:
    return line.local_amount if line.debit_credit_indicator == "D" else -line.local_amount


def _ledger_balances(lines: list[Any]) -> dict[str, Decimal]:
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for line in lines:
        totals[line.account_code] += _signed_amount(line)
    return dict(totals)


def _normalize_text(*values: str) -> str:
    return " ".join(value or "" for value in values).lower().replace("-", " ")


def _is_short_term_borrowing(name: str) -> bool:
    text = _normalize_text(name)
    return "단기차입" in text or "short term borrowing" in text or "short term loan" in text


def _mentions_long_term_borrowing(text: str) -> bool:
    normalized = _normalize_text(text)
    return "장기차입" in normalized or "long term borrowing" in normalized or "long term loan" in normalized


def _materiality_threshold(repo: Any, company_id: UUID) -> Decimal:
    profile = next(
        (
            item
            for item in repo.materiality_profiles.values()
            if item.company_id == company_id and item.status == "APPROVED"
        ),
        None,
    )
    return profile.trivial_threshold if profile else Decimal("0")


def detect_cross_analysis_findings(
    repo: Any,
    closing_set: ClosingAnalysisSet,
    lines: list[Any],
    balances: list[SettlementBalance],
) -> list[CrossAnalysisFinding]:
    """Persist auditable cross-source facts; no accounting conclusion is made here."""
    for existing in list(repo.cross_analysis_findings.values()):
        if existing.closing_analysis_set_id == closing_set.id:
            repo.remove(existing)
    scoped_line_ids = {line.id for line in lines}
    for risk in repo.risks.values():
        event = repo.events.get(risk.event_id)
        if event and scoped_line_ids.intersection(event.journal_line_ids):
            risk.cross_finding_ids = []
            risk.package.cross_finding_ids = []
            repo.save(risk)
    threshold = _materiality_threshold(repo, closing_set.company_id)
    findings: list[CrossAnalysisFinding] = []
    balance_by_account = {balance.account_code: balance for balance in balances}
    ledger_by_account = _ledger_balances(lines)
    comparable = False
    mismatch = False
    for account_code, total in ledger_by_account.items():
        balance = balance_by_account.get(account_code)
        if not balance:
            continue
        comparable = True
        difference = total - balance.amount
        if difference == 0:
            continue
        mismatch = True
        if abs(difference) < threshold:
            continue
        related_lines = [line.id for line in lines if line.account_code == account_code]
        findings.append(
            CrossAnalysisFinding(
                company_id=closing_set.company_id,
                closing_analysis_set_id=closing_set.id,
                finding_type="GL_SETTLEMENT_RECONCILIATION_DIFFERENCE",
                title="Ledger and settlement balance require reconciliation",
                statement=(
                    f"Account {account_code} has ledger net {total} and settlement amount "
                    f"{balance.amount}; the material difference is {difference}."
                ),
                severity="HIGH" if abs(difference) >= threshold else "MEDIUM",
                account_code=account_code,
                account_name=balance.account_name,
                amount=abs(difference),
                journal_line_ids=related_lines,
                metadata={"ledgerNet": str(total), "settlementAmount": str(balance.amount)},
            )
        )
    closing_set.reconciliation_status = (
        ReconciliationStatus.MISMATCHED
        if mismatch
        else ReconciliationStatus.MATCHED
        if comparable
        else ReconciliationStatus.NOT_COMPARABLE
    )

    for line in lines:
        description = _normalize_text(line.header_text, line.line_text)
        if (
            _is_short_term_borrowing(line.account_name)
            and _mentions_long_term_borrowing(description)
            and line.local_amount >= threshold
        ):
            findings.append(
                CrossAnalysisFinding(
                    company_id=closing_set.company_id,
                    closing_analysis_set_id=closing_set.id,
                    finding_type="ACCOUNT_DESCRIPTION_CLASSIFICATION_CONFLICT",
                    title="Borrowing classification, liquidity and disclosure review",
                    statement=(
                        "The ledger account is short-term borrowing while the journal description "
                        "indicates a long-term borrowing drawdown. Classification, current/non-current "
                        "presentation, liquidity and disclosure require review."
                    ),
                    severity="HIGH",
                    account_code=line.account_code,
                    account_name=line.account_name,
                    amount=line.local_amount,
                    journal_line_ids=[line.id],
                    metadata={
                        "accountName": line.account_name,
                        "journalDescription": " ".join(
                            value for value in (line.header_text, line.line_text) if value
                        ),
                    },
                )
            )
    for finding in findings:
        repo.save(finding)
    repo.save(closing_set)
    return findings


def _event_for_finding(repo: Any, finding: CrossAnalysisFinding) -> Any | None:
    line_ids = set(finding.journal_line_ids)
    return next(
        (
            event
            for event in repo.events.values()
            if event.closing_analysis_set_id == finding.closing_analysis_set_id
            and line_ids.intersection(event.journal_line_ids)
        ),
        None,
    )


def _enrich_or_create_cross_risk(
    repo: Any, finding: CrossAnalysisFinding, *, actor: str
) -> Risk | None:
    event = _event_for_finding(repo, finding)
    if not event:
        return None
    risk = next((item for item in repo.risks.values() if item.event_id == event.id), None)
    questions = [
        "Does the borrowing contract establish a current or non-current repayment obligation at the reporting date?",
        "Are covenant breaches, refinancing terms and liquidity disclosures supported by evidence?",
    ]
    evidence = [
        "Borrowing agreement and maturity schedule",
        "Covenant compliance and refinancing evidence",
        "Current/non-current classification calculation and disclosure draft",
    ]
    if risk is None:
        package = RiskPackage(
            summary=finding.statement,
            references=[{"type": "K-IFRS", "code": "IAS 1 / IFRS 7", "status": "REFERENCE_REQUIRED"}],
            expected_questions=questions,
            evidence_checklist=evidence,
            response_guidance=["Validate the contractual maturity and present the liability consistently."],
            generated_by="CROSS_ANALYSIS_CANDIDATE",
            missing_facts=["Contractual maturity", "Covenant status", "Refinancing availability"],
            evidence_status="EVIDENCE_ENRICHMENT_REQUIRED",
            cross_finding_ids=[finding.id],
        )
        risk = Risk(
            company_id=finding.company_id,
            event_id=event.id,
            title="Borrowing classification and liquidity review",
            statement=finding.statement,
            level=RiskLevel.HIGH,
            score=75,
            route=AnalysisRoute.MANUAL_REVIEW,
            package=package,
            materiality_level="MEDIUM",
            closing_analysis_set_id=finding.closing_analysis_set_id,
            cross_finding_ids=[finding.id],
        )
    else:
        # Keep an AI-generated, transaction-specific review opinion visible;
        # the cross finding is linked as evidence instead of overwriting it.
        if risk.route != AnalysisRoute.RAG_LLM:
            risk.title = "Borrowing classification and liquidity review"
            risk.statement = finding.statement
            risk.level = RiskLevel.HIGH
            risk.score = max(risk.score, 75)
        risk.closing_analysis_set_id = finding.closing_analysis_set_id
        risk.cross_finding_ids = sorted(set([*risk.cross_finding_ids, finding.id]), key=str)
        risk.package.cross_finding_ids = sorted(
            set([*risk.package.cross_finding_ids, finding.id]), key=str
        )
        if risk.route != AnalysisRoute.RAG_LLM:
            risk.package.expected_questions = list(
                dict.fromkeys([*risk.package.expected_questions, *questions])
            )
            risk.package.evidence_checklist = list(
                dict.fromkeys([*risk.package.evidence_checklist, *evidence])
            )
    repo.save(risk)
    finding.linked_event_ids = [event.id]
    finding.linked_risk_ids = [risk.id]
    repo.save(finding)
    repo.append_memory(
        RiskMemoryEntry(
            risk_id=risk.id,
            entry_type="CROSS_ANALYSIS_FINDING_LINKED",
            summary=finding.title,
            actor=actor,
            metadata={"crossFindingId": str(finding.id)},
        )
    )
    return risk


def _historical_settlement_rows(repo: Any, company_id: UUID) -> list[SettlementRow]:
    return [
        SettlementRow(
            period=f"{balance.fiscal_year:04d}-{balance.fiscal_period:02d}",
            account_code=balance.account_code,
            account_name=balance.account_name,
            category=balance.category,
            amount=balance.amount,
            measurement_basis=balance.measurement_basis,
        )
        for balance in repo.settlement_balances.values()
        if balance.company_id == company_id
    ]


def _link_variance_to_risks(repo: Any, closing_set: ClosingAnalysisSet) -> int:
    profile = next(
        (
            item
            for item in repo.variance_profiles.values()
            if item.company_id == closing_set.company_id and item.status == "APPROVED"
        ),
        None,
    )
    if not profile:
        return 0
    for existing in list(repo.variance_observations.values()):
        if existing.closing_analysis_set_id == closing_set.id:
            repo.remove(existing)
    rows = _historical_settlement_rows(repo, closing_set.company_id)
    period = f"{closing_set.fiscal_year:04d}-{closing_set.fiscal_period:02d}"
    observations = [
        *analyze_variance(closing_set.company_id, rows, profile, period, "MOM"),
        *analyze_variance(closing_set.company_id, rows, profile, period, "YOY"),
    ]
    risks_by_account: dict[str, list[Risk]] = defaultdict(list)
    for risk in repo.risks.values():
        event = repo.events.get(risk.event_id)
        if event and event.closing_analysis_set_id == closing_set.id:
            for line_id in event.journal_line_ids:
                line = repo.journal_lines.get(line_id)
                if line:
                    risks_by_account[line.account_code].append(risk)
    for observation in observations:
        observation.closing_analysis_set_id = closing_set.id
        observation.linked_risk_ids = [risk.id for risk in risks_by_account[observation.account_code]]
        repo.save(observation)
    return len(observations)


def analyze_closing_analysis_set(
    repo: Any,
    closing_analysis_set_id: UUID,
    *,
    actor: str,
    lines: list[Any] | None = None,
    settlement_balances: list[SettlementBalance] | None = None,
    analysis_provider: Any | None = None,
    knowledge_candidates: dict[str, dict[str, Any]] | None = None,
    external_ai_enabled: bool | None = None,
    ai_model: str | None = None,
    ai_provider: str = "openai",
    ai_key_env: str | None = None,
) -> dict[str, Any]:
    closing_set = repo.closing_analysis_sets.get(closing_analysis_set_id)
    if closing_set is None:
        raise ValueError("closing analysis set not found")
    if lines is not None:
        attach_general_ledger(repo, closing_set, lines)
    if settlement_balances is not None:
        attach_settlement_schedule(repo, closing_set, settlement_balances)
    if not closing_set.is_ready:
        raise ValueError("both general ledger and settlement schedule are required")

    closing_set.status = ClosingAnalysisStatus.PROCESSING
    closing_set.updated_at = utcnow()
    repo.save(closing_set)
    scoped_lines = repo.lines_for_set(closing_set.id)
    scoped_balances = repo.settlement_for_set(closing_set.id)
    findings = detect_cross_analysis_findings(repo, closing_set, scoped_lines, scoped_balances)
    processing = process_journals(
        repo,
        scoped_lines,
        actor=actor,
        knowledge_candidates=knowledge_candidates,
        analysis_provider=analysis_provider,
        external_ai_enabled=external_ai_enabled,
        ai_model=ai_model,
        ai_provider=ai_provider,
        ai_key_env=ai_key_env,
        cross_findings=findings,
    )
    for event in repo.events.values():
        if any(line_id in {line.id for line in scoped_lines} for line_id in event.journal_line_ids):
            event.closing_analysis_set_id = closing_set.id
            repo.save(event)
    linked_risks = [
        _enrich_or_create_cross_risk(repo, finding, actor=actor)
        for finding in findings
        if finding.finding_type == "ACCOUNT_DESCRIPTION_CLASSIFICATION_CONFLICT"
    ]
    variance_count = _link_variance_to_risks(repo, closing_set)
    closing_set.status = ClosingAnalysisStatus.COMPLETED
    closing_set.updated_at = utcnow()
    repo.save(closing_set)
    return {
        "status": closing_set.status.value,
        "closingAnalysisSetId": str(closing_set.id),
        "journalLines": len(scoped_lines),
        "settlementBalances": len(scoped_balances),
        "crossFindings": len(findings),
        "varianceObservations": variance_count,
        "events": processing["events"],
        "risks": processing["risks"] + len([risk for risk in linked_risks if risk]),
        "reconciliationStatus": closing_set.reconciliation_status.value,
    }
