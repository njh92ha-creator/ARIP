from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal

from app.domain.models import CompanySettings, JournalLine, MaterialityProfile
from app.domain.repository import InMemoryRepository
from app.services.orchestrator import process_journals


class ReuseTest(unittest.TestCase):
    def test_same_pattern_creates_new_assessment_with_reuse_route(self) -> None:
        company = CompanySettings("C1", "회사", "소재")
        repo = InMemoryRepository()
        repo.save(company)
        repo.save(
            MaterialityProfile(
                company_id=company.id,
                name="기본",
                benchmark="ASSET",
                overall_materiality=Decimal("100"),
                performance_materiality=Decimal("50"),
                trivial_threshold=Decimal("10"),
                effective_from=date(2026, 1, 1),
                status="APPROVED",
            )
        )

        def lines(document: str) -> list[JournalLine]:
            return [
                JournalLine(
                    company_id=company.id,
                    source_row=1,
                    document_number=document,
                    posting_date=date(2026, 7, 31),
                    account_code="1201",
                    account_name="개발비",
                    local_amount=Decimal("1000"),
                    debit_credit_indicator="D",
                    fiscal_year=2026,
                    fiscal_period=7,
                    line_text="동일 개발",
                    source_hash=f"{document}-D",
                ),
                JournalLine(
                    company_id=company.id,
                    source_row=2,
                    document_number=document,
                    posting_date=date(2026, 7, 31),
                    account_code="1001",
                    account_name="현금",
                    local_amount=Decimal("1000"),
                    debit_credit_indicator="C",
                    fiscal_year=2026,
                    fiscal_period=7,
                    line_text="동일 개발",
                    source_hash=f"{document}-C",
                ),
            ]

        process_journals(repo, lines("JE-1"), actor="test")
        process_journals(repo, lines("JE-2"), actor="test")
        routes = [risk.route.value for risk in repo.risks.values()]
        self.assertIn("RULE_TEMPLATE", routes)
        self.assertIn("REUSE_WITH_REASSESSMENT", routes)
        self.assertEqual(len(repo.risk_memory), 2)


if __name__ == "__main__":
    unittest.main()

