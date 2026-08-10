from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class CompanyCreate(BaseModel):
    company_code: str
    company_name: str
    industry: str
    functional_currency: str = "KRW"
    timezone: str = "Asia/Seoul"
    fiscal_year_start_month: int = Field(1, ge=1, le=12)
    close_frequency: str = "MONTHLY"
    month_close_day: int = Field(5, ge=1, le=31)


class CompanyUpdate(CompanyCreate):
    pass


class MaterialityCreate(BaseModel):
    company_id: UUID
    name: str
    benchmark: str
    overall_materiality: Decimal
    performance_materiality: Decimal
    trivial_threshold: Decimal
    effective_from: date
    qualitative_factors: list[str] = []
    approve: bool = False


class MappingApprove(BaseModel):
    company_id: UUID
    source_type: Literal["GENERAL_LEDGER", "SETTLEMENT_SCHEDULE"]
    sheet_name: str
    header_row: int
    source_signature: str
    mapping: dict[str, str]


class RiskTransition(BaseModel):
    target_status: str
    reason: str
    expected_version: int = 1


class RiskReviewDecision(BaseModel):
    decision: str
    expected_version: int = 1


class RiskDelete(BaseModel):
    expected_version: int = 1


class AiConnectionInput(BaseModel):
    provider: str = "openai"
    chat_model: str
    embedding_model: str = "text-embedding-3-large"
    secret_reference: str
    enabled: bool = False

    def model_post_init(self, __context: Any) -> None:
        if not (
            self.secret_reference.startswith("env:")
            or self.secret_reference.startswith("secret://")
        ):
            raise ValueError("secret_reference must be env: or secret://")


class AiConnectionTestInput(BaseModel):
    api_key: str | None = None
    secret_reference: str | None = None
    provider: str = "openai"
    chat_model: str | None = None
    analysis_prompt: str | None = None

    def model_post_init(self, __context: Any) -> None:
        if not self.api_key and not self.secret_reference:
            raise ValueError("api_key or secret_reference is required")


class KnowledgeSourceInput(BaseModel):
    company_id: UUID
    root_directory: str
    allowed_extensions: list[str] = [
        ".pdf",
        ".hwp",
        ".hwpx",
        ".docx",
        ".txt",
        ".md",
        ".html",
    ]

