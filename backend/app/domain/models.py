from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MappingStatus(StrEnum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    RETIRED = "RETIRED"


class ImportStatus(StrEnum):
    RECEIVED = "RECEIVED"
    VALIDATING = "VALIDATING"
    RECONCILED = "RECONCILED"
    FAILED = "FAILED"


class AnalysisRoute(StrEnum):
    REUSE_EXACT = "REUSE_EXACT"
    REUSE_WITH_REASSESSMENT = "REUSE_WITH_REASSESSMENT"
    RULE_TEMPLATE = "RULE_TEMPLATE"
    RAG_LLM = "RAG_LLM"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    SKIPPED_LOW_RISK = "SKIPPED_LOW_RISK"


class RiskStatus(StrEnum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    EVIDENCE_ATTACHED = "EVIDENCE_ATTACHED"
    REASSESSMENT = "REASSESSMENT"
    ACCEPTED = "ACCEPTED"
    DORMANT = "DORMANT"
    REACTIVATED = "REACTIVATED"


class RiskLevel(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFORMATION = "INFORMATION"


class AccountCategory(StrEnum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"
    SUSPENSE = "SUSPENSE"
    OTHER = "OTHER"


@dataclass(slots=True)
class CompanySettings:
    company_code: str
    company_name: str
    industry: str
    functional_currency: str = "KRW"
    timezone: str = "Asia/Seoul"
    fiscal_year_start_month: int = 1
    close_frequency: str = "MONTHLY"
    month_close_day: int = 5
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class MaterialityProfile:
    company_id: UUID
    name: str
    benchmark: str
    overall_materiality: Decimal
    performance_materiality: Decimal
    trivial_threshold: Decimal
    effective_from: date
    qualitative_factors: list[str] = field(default_factory=list)
    status: str = "DRAFT"
    version: int = 1
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class VarianceThreshold:
    comparison: str
    amount_threshold: Decimal
    rate_threshold: Decimal
    minimum_base_amount: Decimal
    trigger_mode: str = "ANY"


@dataclass(slots=True)
class VarianceProfile:
    company_id: UUID
    name: str
    thresholds: list[VarianceThreshold]
    status: str = "DRAFT"
    version: int = 1
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class MappingProfile:
    company_id: UUID
    source_type: str
    sheet_name: str
    header_row: int
    source_signature: str
    mapping: dict[str, str]
    status: MappingStatus = MappingStatus.DRAFT
    version: int = 1
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class JournalLine:
    company_id: UUID
    source_row: int
    document_number: str
    posting_date: date
    account_code: str
    account_name: str
    local_amount: Decimal
    debit_credit_indicator: str
    fiscal_year: int
    fiscal_period: int
    line_text: str = ""
    header_text: str = ""
    project_code: str = ""
    contract_code: str = ""
    vendor_code: str = ""
    customer_code: str = ""
    source_hash: str = ""
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class AccountingEvent:
    company_id: UUID
    event_type: str
    title: str
    amount: Decimal
    currency: str
    journal_line_ids: list[UUID]
    canonical_signature: dict[str, Any]
    event_hash: str
    classification_confidence: float
    status: str = "REVIEW_REQUIRED"
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class RiskPackage:
    summary: str
    references: list[dict[str, str]]
    expected_questions: list[str]
    evidence_checklist: list[str]
    response_guidance: list[str]
    generated_by: str
    missing_facts: list[str] = field(default_factory=list)
    evidence_status: str = "REFERENCE_PENDING"
    version: int = 1
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class Risk:
    company_id: UUID
    event_id: UUID
    title: str
    statement: str
    level: RiskLevel
    score: int
    route: AnalysisRoute
    package: RiskPackage
    status: RiskStatus = RiskStatus.OPEN
    materiality_level: str = "LOW"
    row_version: int = 1
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class RiskMemoryEntry:
    risk_id: UUID
    entry_type: str
    summary: str
    actor: str
    occurred_at: datetime = field(default_factory=utcnow)
    metadata: dict[str, Any] = field(default_factory=dict)
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class VarianceObservation:
    company_id: UUID
    period: str
    account_code: str
    account_name: str
    category: AccountCategory
    comparison: str
    measurement_basis: str
    current_value: Decimal
    comparison_value: Decimal
    delta_amount: Decimal
    delta_rate: Decimal | None
    triggered_by: list[str]
    checklist: list[str]
    review_status: str = "OPEN"
    id: UUID = field(default_factory=uuid4)


@dataclass(slots=True)
class AuditLogEntry:
    action: str
    resource_type: str
    resource_id: str
    actor: str
    company_id: UUID | None = None
    reason: str = ""
    occurred_at: datetime = field(default_factory=utcnow)
    id: UUID = field(default_factory=uuid4)
