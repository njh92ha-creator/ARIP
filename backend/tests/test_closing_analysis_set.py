from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.domain.models import (
    CompanySettings,
    JournalLine,
    MaterialityProfile,
    SettlementBalance,
)
from app.domain.repository import InMemoryRepository
from app.services.closing_analysis import create_closing_analysis_set, analyze_closing_analysis_set


class ClosingAnalysisSetTest(unittest.TestCase):
    def test_analysis_set_is_scoped_only_to_company(self) -> None:
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))

        first = create_closing_analysis_set(repo, company.id)
        second = create_closing_analysis_set(repo, company.id)

        self.assertEqual(first.id, second.id)
        self.assertEqual(first.fiscal_year, 0)
        self.assertEqual(first.fiscal_period, 0)

    def test_account_description_conflict_creates_audit_risk_from_two_input_set(self) -> None:
        """A 100m short-term borrowing posted as a long-term borrowing needs Audit Risk review."""
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))
        repo.save(
            MaterialityProfile(
                company_id=company.id,
                name="Default",
                benchmark="TOTAL_ASSETS",
                overall_materiality=Decimal("500000000"),
                performance_materiality=Decimal("100000000"),
                trivial_threshold=Decimal("10000000"),
                effective_from=date(2025, 1, 1),
                status="APPROVED",
            )
        )
        closing_set = create_closing_analysis_set(repo, company.id, 2025, 6)
        lines = [
            JournalLine(
                company_id=company.id,
                source_row=2,
                document_number="18253102",
                posting_date=date(2025, 6, 4),
                account_code="211000",
                account_name="Short-term borrowings",
                local_amount=Decimal("100000000"),
                debit_credit_indicator="C",
                fiscal_year=2025,
                fiscal_period=6,
                header_text="Bank long-term borrowing drawdown",
                source_hash="short-long-conflict-credit",
            ),
            JournalLine(
                company_id=company.id,
                source_row=3,
                document_number="18253102",
                posting_date=date(2025, 6, 4),
                account_code="122500",
                account_name="Cash",
                local_amount=Decimal("100000000"),
                debit_credit_indicator="D",
                fiscal_year=2025,
                fiscal_period=6,
                header_text="Bank long-term borrowing drawdown",
                source_hash="short-long-conflict-debit",
            ),
        ]
        balances = [
            SettlementBalance(
                company_id=company.id,
                fiscal_year=2025,
                fiscal_period=6,
                account_code="211000",
                account_name="Short-term borrowings",
                category="LIABILITY",
                amount=Decimal("-100000000"),
                measurement_basis="ENDING_BALANCE",
            ),
            SettlementBalance(
                company_id=company.id,
                fiscal_year=2025,
                fiscal_period=6,
                account_code="122500",
                account_name="Cash",
                category="ASSET",
                amount=Decimal("100000000"),
                measurement_basis="ENDING_BALANCE",
            ),
        ]

        result = analyze_closing_analysis_set(
            repo,
            closing_set.id,
            lines=lines,
            settlement_balances=balances,
            actor="test",
        )

        self.assertEqual(result["status"], "COMPLETED")
        self.assertGreaterEqual(result["crossFindings"], 1)
        risk = next(iter(repo.risks.values()))
        self.assertEqual(risk.closing_analysis_set_id, closing_set.id)
        self.assertIn("classification", risk.title.lower())
        self.assertIn("liquidity", " ".join(risk.package.expected_questions).lower())

        analyze_closing_analysis_set(repo, closing_set.id, actor="test")
        self.assertEqual(len(repo.cross_analysis_findings), 1)
        self.assertEqual(len(repo.risks), 1)


if __name__ == "__main__":
    unittest.main()
