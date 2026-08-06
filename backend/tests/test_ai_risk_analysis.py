from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.domain.models import AccountingEvent, JournalLine, RiskPackage
from app.services.ai_risk_analysis import (
    approved_reference_context,
    build_event_facts,
    risk_from_ai_analysis,
)
from app.ai.provider import AiUnavailableError
from app.services.orchestrator import process_journals


class AiRiskPackageTest(unittest.TestCase):
    def test_candidate_package_has_evidence_enrichment_defaults(self) -> None:
        package = RiskPackage(
            summary="검토 필요",
            references=[],
            expected_questions=[],
            evidence_checklist=[],
            response_guidance=[],
            generated_by="AI_CANDIDATE",
        )

        self.assertEqual(package.evidence_status, "REFERENCE_PENDING")
        self.assertEqual(package.missing_facts, [])


class AiRiskFactsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.company_id = uuid4()
        self.event = AccountingEvent(
            company_id=self.company_id,
            event_type="UNCLASSIFIED_ACCOUNTING_EVENT",
            title="Unclassified",
            amount=Decimal("100000000"),
            currency="KRW",
            journal_line_ids=[],
            canonical_signature={},
            event_hash="event-hash",
            classification_confidence=0.45,
        )
        self.lines = [
            JournalLine(
                company_id=self.company_id,
                source_row=1,
                document_number="JE-1",
                posting_date=date(2025, 6, 4),
                account_code="211000",
                account_name="\ub2e8\uae30\ucc28\uc785\uae08",
                local_amount=Decimal("100000000"),
                debit_credit_indicator="C",
                fiscal_year=2025,
                fiscal_period=6,
                line_text="\uc740\ud589 \uc7a5\uae30 \ucc28\uc785\uae08 \ucc28\uc785",
            ),
        ]

    def test_build_event_facts_includes_account_and_journal_meaning(self) -> None:
        facts = build_event_facts(self.event, self.lines)

        self.assertIn("\ub2e8\uae30\ucc28\uc785\uae08", facts["accountNames"])
        self.assertIn("\uc7a5\uae30 \ucc28\uc785\uae08", facts["journalDescriptions"][0])
        self.assertEqual(facts["amount"], "100000000")

    def test_reference_context_excludes_pending_documents(self) -> None:
        candidates = {
            "approved": {
                "id": "approved", "companyId": str(self.company_id),
                "relativePath": "K-IFRS-1001.pdf", "status": "APPROVED", "ragEligible": True,
            },
            "pending": {
                "id": "pending", "companyId": str(self.company_id),
                "relativePath": "draft.pdf", "status": "PENDING", "ragEligible": False,
            },
        }

        self.assertEqual(approved_reference_context(self.company_id, candidates), [
            {"id": "approved", "title": "K-IFRS-1001.pdf", "type": "APPROVED_KNOWLEDGE"}
        ])

    def test_ai_borrowing_mismatch_becomes_evidence_enrichment_candidate(self) -> None:
        analysis = {
            "riskSummary": "단기차입금 계정과 장기 차입금 차입 적요의 기간 속성이 불일치합니다.",
            "issueTypes": ["차입금 유동·비유동 분류"],
            "expectedQuestions": ["보고기간 말부터 12개월 이내 상환의무가 있는가?"],
            "evidenceChecklist": ["차입 약정서", "상환 스케줄"],
            "responseGuidance": ["만기와 표시 분류를 검토합니다."],
            "referenceIds": [],
            "missingFacts": ["차입 만기일", "약정 위반 여부"],
            "uncertainty": "MEDIUM",
        }

        risk = risk_from_ai_analysis(self.event, None, analysis, [])

        self.assertIsNotNone(risk)
        assert risk is not None
        self.assertEqual(risk.route.value, "RAG_LLM")
        self.assertEqual(risk.package.evidence_status, "EVIDENCE_ENRICHMENT_REQUIRED")
        self.assertIn("근거보강 필요", risk.statement)
        self.assertIn("차입 만기일", risk.package.missing_facts)


class FakeRepository:
    def __init__(self) -> None:
        self.materiality_profiles = {}
        self.journal_lines = {}
        self.events = {}
        self.risks = {}
        self.processed_source_hashes = set()
        self.audit_log = []
        self.memory = []

    def save(self, item):
        target = self.journal_lines if isinstance(item, JournalLine) else self.events if isinstance(item, AccountingEvent) else self.risks
        target[item.id] = item
        return item

    def event_by_hash(self, company_id, event_hash):
        return next((event for event in self.events.values() if event.company_id == company_id and event.event_hash == event_hash), None)

    def append_memory(self, entry):
        self.memory.append(entry)

    def append_audit(self, entry):
        self.audit_log.append(entry)


class FakeAnalysisProvider:
    def __init__(self) -> None:
        self.calls = 0

    def analyze(self, event_facts, references):
        self.calls += 1
        return {
            "riskSummary": "단기차입금 계정과 장기 차입금 적요의 기간 속성이 불일치합니다.",
            "issueTypes": ["차입금 유동·비유동 분류"],
            "expectedQuestions": ["만기일은 무엇인가?"],
            "evidenceChecklist": ["차입 약정서"],
            "responseGuidance": ["표시 분류를 검토합니다."],
            "referenceIds": [],
            "missingFacts": ["차입 만기일"],
            "uncertainty": "MEDIUM",
        }


class UnavailableAnalysisProvider:
    def analyze(self, event_facts, references):
        raise AiUnavailableError("test provider unavailable")


class BrokenAnalysisProvider:
    def analyze(self, event_facts, references):
        raise RuntimeError("test provider failure")


class AiOrchestrationTest(unittest.TestCase):
    def test_new_unclassified_event_uses_ai_once_and_reuses_exact_pattern(self) -> None:
        company_id = uuid4()
        line = JournalLine(
            company_id=company_id, source_row=1, document_number="JE-1",
            posting_date=date(2025, 6, 4), account_code="211000",
            account_name="\ub2e8\uae30\ucc28\uc785\uae08", local_amount=Decimal("100000000"),
            debit_credit_indicator="C", fiscal_year=2025, fiscal_period=6,
            line_text="\uc740\ud589 \uc7a5\uae30 \ucc28\uc785\uae08 \ucc28\uc785",
        )
        repo = FakeRepository()
        provider = FakeAnalysisProvider()

        first = process_journals(repo, [line], actor="test", analysis_provider=provider)
        second = process_journals(repo, [line], actor="test", analysis_provider=provider)

        self.assertEqual(first["risks"], 1)
        self.assertEqual(second["reusedPatterns"], 1)
        self.assertEqual(provider.calls, 1)

    def test_ai_unavailable_falls_back_without_stopping_import(self) -> None:
        company_id = uuid4()
        line = JournalLine(
            company_id=company_id, source_row=1, document_number="JE-2",
            posting_date=date(2025, 6, 4), account_code="211000",
            account_name="\ub2e8\uae30\ucc28\uc785\uae08", local_amount=Decimal("100000000"),
            debit_credit_indicator="C", fiscal_year=2025, fiscal_period=6,
            line_text="\uc740\ud589 \uc7a5\uae30 \ucc28\uc785\uae08 \ucc28\uc785",
        )
        repo = FakeRepository()

        result = process_journals(
            repo, [line], actor="test", analysis_provider=UnavailableAnalysisProvider()
        )

        self.assertEqual(result["events"], 1)
        self.assertEqual(result["risks"], 1)

    def test_generic_manual_review_is_reassessed_when_ai_is_enabled_later(self) -> None:
        company_id = uuid4()
        line = JournalLine(
            company_id=company_id, source_row=1, document_number="JE-4",
            posting_date=date(2025, 6, 4), account_code="111000",
            account_name="현금", local_amount=Decimal("100000000"),
            debit_credit_indicator="D", fiscal_year=2025, fiscal_period=6,
            line_text="법인 설립 증자 대금 수령",
        )
        repo = FakeRepository()
        first = process_journals(repo, [line], actor="test", external_ai_enabled=False)
        original = next(iter(repo.risks.values()))
        provider = FakeAnalysisProvider()

        second = process_journals(repo, [line], actor="test", analysis_provider=provider)

        self.assertEqual(first["risks"], 1)
        self.assertEqual(second["events"], 0)
        self.assertEqual(second["risks"], 0)
        self.assertEqual(provider.calls, 1)
        self.assertEqual(len(repo.risks), 1)
        self.assertIs(next(iter(repo.risks.values())), original)
        self.assertEqual(original.route.value, "RAG_LLM")

    def test_unexpected_ai_failure_falls_back_without_stopping_import(self) -> None:
        company_id = uuid4()
        line = JournalLine(
            company_id=company_id, source_row=1, document_number="JE-3",
            posting_date=date(2025, 6, 4), account_code="211000",
            account_name="\ub2e8\uae30\ucc28\uc785\uae08", local_amount=Decimal("100000000"),
            debit_credit_indicator="C", fiscal_year=2025, fiscal_period=6,
            line_text="\uc740\ud589 \uc7a5\uae30 \ucc28\uc785\uae08 \ucc28\uc785",
        )
        repo = FakeRepository()

        result = process_journals(
            repo, [line], actor="test", analysis_provider=BrokenAnalysisProvider()
        )

        self.assertEqual(result["events"], 1)
        self.assertEqual(result["risks"], 1)


if __name__ == "__main__":
    unittest.main()
