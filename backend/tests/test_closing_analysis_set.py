from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.domain.models import (
    CompanySettings,
    JournalLine,
    MaterialityProfile,
    SettlementBalance,
)
from app.domain.repository import InMemoryRepository
from app.services.closing_analysis import (
    analyze_closing_analysis_set,
    attach_general_ledger,
    create_closing_analysis_set,
    materiality_qualified_settlement_accounts,
)


class ClosingAnalysisSetTest(unittest.TestCase):
    def test_reuploading_general_ledger_replaces_prior_lines_in_the_same_set(self) -> None:
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))
        closing_set = create_closing_analysis_set(repo, company.id, 2025, 6)
        old_line = JournalLine(company_id=company.id, source_row=1, document_number="JE-OLD", posting_date=date(2025, 6, 4), account_code="1000", account_name="Cash", local_amount=Decimal("100"), debit_credit_indicator="D", fiscal_year=2025, fiscal_period=6, source_hash="old")
        new_line = JournalLine(company_id=company.id, source_row=1, document_number="JE-NEW", posting_date=date(2025, 6, 4), account_code="1000", account_name="Cash", local_amount=Decimal("100"), debit_credit_indicator="D", fiscal_year=2025, fiscal_period=6, source_hash="new")

        attach_general_ledger(repo, closing_set, [old_line])
        attach_general_ledger(repo, closing_set, [new_line])

        self.assertEqual(
            [line.document_number for line in repo.lines_for_set(closing_set.id)],
            ["JE-NEW"],
        )

    def test_different_ledger_filenames_are_added_without_replacing_each_other(self) -> None:
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))
        closing_set = create_closing_analysis_set(repo, company.id, 2025, 6)
        first = JournalLine(company_id=company.id, source_row=1, document_number="JE-A", posting_date=date(2025, 6, 4), account_code="1000", account_name="Cash", local_amount=Decimal("100"), debit_credit_indicator="D", fiscal_year=2025, fiscal_period=6, source_hash="a", source_filename="ledger-a.xlsx")
        second = JournalLine(company_id=company.id, source_row=1, document_number="JE-B", posting_date=date(2025, 6, 4), account_code="2000", account_name="Debt", local_amount=Decimal("100"), debit_credit_indicator="C", fiscal_year=2025, fiscal_period=6, source_hash="b", source_filename="ledger-b.xlsx")

        attach_general_ledger(repo, closing_set, [first])
        attach_general_ledger(repo, closing_set, [second])

        self.assertEqual(
            {line.document_number for line in repo.lines_for_set(closing_set.id)},
            {"JE-A", "JE-B"},
        )

    def test_legacy_settlement_without_period_values_is_skipped_without_crashing(self) -> None:
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))
        repo.save(
            MaterialityProfile(
                company_id=company.id,
                name="Default",
                benchmark="TOTAL_ASSETS",
                overall_materiality=Decimal("500"),
                performance_materiality=Decimal("100"),
                trivial_threshold=Decimal("10"),
                effective_from=date(2025, 1, 1),
                status="APPROVED",
            )
        )
        closing_set = create_closing_analysis_set(repo, company.id, 2025, 6)
        legacy_balance = SimpleNamespace(
            account_code="1000",
            account_name="Cash",
            amount=Decimal("500"),
        )

        qualified = materiality_qualified_settlement_accounts(
            repo, closing_set, [legacy_balance]
        )

        self.assertEqual(qualified, {})

    def test_only_accounts_with_absolute_settlement_variance_above_performance_materiality_reach_ai(self) -> None:
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))
        repo.save(
            MaterialityProfile(
                company_id=company.id,
                name="Default",
                benchmark="TOTAL_ASSETS",
                overall_materiality=Decimal("500"),
                performance_materiality=Decimal("100"),
                trivial_threshold=Decimal("10"),
                effective_from=date(2025, 1, 1),
                status="APPROVED",
            )
        )
        closing_set = create_closing_analysis_set(repo, company.id, 2025, 6)
        lines = [
            JournalLine(company_id=company.id, source_row=1, document_number="JE-1", posting_date=date(2025, 6, 4), account_code="1000", account_name="현금", local_amount=Decimal("500"), debit_credit_indicator="D", fiscal_year=2025, fiscal_period=6, source_hash="eligible"),
            JournalLine(company_id=company.id, source_row=2, document_number="JE-2", posting_date=date(2025, 6, 4), account_code="2000", account_name="매출", local_amount=Decimal("500"), debit_credit_indicator="C", fiscal_year=2025, fiscal_period=6, source_hash="ineligible"),
        ]
        balances = [
            SettlementBalance(company_id=company.id, fiscal_year=2025, fiscal_period=6, account_code="1000", account_name="현금", category="ASSET", amount=Decimal("500"), current_amount=Decimal("500"), prior_amount=Decimal("300"), measurement_basis="ENDING_BALANCE"),
            SettlementBalance(company_id=company.id, fiscal_year=2025, fiscal_period=6, account_code="2000", account_name="매출", category="REVENUE", amount=Decimal("300"), current_amount=Decimal("300"), prior_amount=Decimal("250"), measurement_basis="YTD_CUMULATIVE"),
        ]

        class CapturingProvider:
            def __init__(self) -> None:
                self.facts: list[dict] = []

            def analyze(self, event_facts, references):
                self.facts.append(event_facts)
                return {
                    "riskSummary": "현금 증감 거래의 검토가 필요합니다.", "issueTypes": ["현금 증감"],
                    "relatedAccounts": ["현금"], "voucherCount": 1, "eventInference": "현금 거래",
                    "auditIssues": ["현금 증감 검토"], "expectedQuestions": [], "evidenceChecklist": [],
                    "responseGuidance": [], "standardsEvidence": [], "ledgerEvidence": [], "referenceIds": [],
                    "missingFacts": [], "uncertainty": "MEDIUM",
                }

        provider = CapturingProvider()
        result = analyze_closing_analysis_set(
            repo, closing_set.id, lines=lines, settlement_balances=balances,
            actor="test", analysis_provider=provider,
        )

        self.assertEqual(result["qualifiedAccounts"], 1)
        self.assertEqual(result["events"], 1)
        self.assertEqual(len(provider.facts), 1)
        self.assertNotIn("materialityVariances", provider.facts[0])

    def test_qualified_account_does_not_analyze_a_sub_materiality_voucher(self) -> None:
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))
        repo.save(MaterialityProfile(
            company_id=company.id, name="Default", benchmark="TOTAL_ASSETS",
            overall_materiality=Decimal("500"), performance_materiality=Decimal("100"),
            trivial_threshold=Decimal("10"), effective_from=date(2025, 1, 1), status="APPROVED",
        ))
        closing_set = create_closing_analysis_set(repo, company.id, 2025, 6)
        lines = [
            JournalLine(company_id=company.id, source_row=1, document_number="JE-SMALL", posting_date=date(2025, 6, 4), account_code="1000", account_name="Cash", local_amount=Decimal("80"), debit_credit_indicator="D", fiscal_year=2025, fiscal_period=6, source_hash="small-cash"),
            JournalLine(company_id=company.id, source_row=2, document_number="JE-SMALL", posting_date=date(2025, 6, 4), account_code="2100", account_name="Borrowing", local_amount=Decimal("80"), debit_credit_indicator="C", fiscal_year=2025, fiscal_period=6, source_hash="small-borrowing"),
        ]
        balances = [
            SettlementBalance(company_id=company.id, fiscal_year=2025, fiscal_period=6, account_code="1000", account_name="Cash", category="ASSET", amount=Decimal("300"), current_amount=Decimal("300"), prior_amount=Decimal("0"), measurement_basis="ENDING_BALANCE"),
        ]

        class CapturingProvider:
            def __init__(self) -> None:
                self.calls = 0

            def analyze(self, event_facts, references):
                self.calls += 1
                return {"riskSummary": "unused", "issueTypes": ["unused"], "expectedQuestions": [], "evidenceChecklist": [], "responseGuidance": [], "referenceIds": [], "missingFacts": [], "uncertainty": "MEDIUM"}

        provider = CapturingProvider()
        result = analyze_closing_analysis_set(
            repo, closing_set.id, lines=lines, settlement_balances=balances,
            actor="test", analysis_provider=provider,
        )

        self.assertEqual(result["qualifiedAccounts"], 1)
        self.assertEqual(result["events"], 0)
        self.assertEqual(provider.calls, 0)
    def test_each_upload_analysis_starts_with_a_new_isolated_set(self) -> None:
        repo = InMemoryRepository(persistent=False)
        company = repo.save(CompanySettings("P001", "Test Company", "Manufacturing"))

        first = create_closing_analysis_set(repo, company.id)
        second = create_closing_analysis_set(repo, company.id)

        self.assertNotEqual(first.id, second.id)
        self.assertEqual(first.fiscal_year, 0)
        self.assertEqual(first.fiscal_period, 0)

    def test_account_description_conflict_does_not_create_a_fixed_risk(self) -> None:
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
        self.assertEqual(result["crossFindings"], 0)
        self.assertEqual(result["risks"], 0)
        self.assertEqual(len(repo.risks), 0)

        analyze_closing_analysis_set(repo, closing_set.id, actor="test")
        self.assertEqual(len(repo.cross_analysis_findings), 0)
        self.assertEqual(len(repo.risks), 0)


if __name__ == "__main__":
    unittest.main()
