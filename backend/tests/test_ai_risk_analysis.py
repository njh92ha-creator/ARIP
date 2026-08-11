from __future__ import annotations

import unittest
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.domain.models import AccountingEvent, JournalLine, RiskPackage
from app.services.ai_risk_analysis import (
    approved_reference_context,
    build_event_facts,
    risk_from_ai_analysis,
)
from app.ai.provider import AiUnavailableError, NvidiaAnalysisProvider, parse_nvidia_json
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


class NvidiaTimeoutConfigurationTest(unittest.TestCase):
    def test_nvidia_json_parser_accepts_a_code_fenced_json_object(self) -> None:
        parsed = parse_nvidia_json('```json\n{"riskSummary":"검토", "issueTypes":[]}\n```')

        self.assertEqual(parsed["riskSummary"], "검토")

    def test_nvidia_analysis_waits_up_to_two_minutes(self) -> None:
        captured: dict[str, object] = {}

        class FakeCompletions:
            def create(self, **kwargs):
                captured["messages"] = kwargs["messages"]
                payload = {
                        "riskSummary": "검토 결과", "issueTypes": [], "expectedQuestions": [],
                        "evidenceChecklist": [], "responseGuidance": [], "referenceIds": [],
                        "missingFacts": [], "uncertainty": "HIGH",
                    }
                message = SimpleNamespace(content=json.dumps(payload))
                return SimpleNamespace(choices=[SimpleNamespace(message=message)])

        class FakeOpenAI:
            def __init__(self, **kwargs):
                captured.update(kwargs)
                self.chat = SimpleNamespace(completions=FakeCompletions())

        original = sys.modules.get("openai")
        sys.modules["openai"] = SimpleNamespace(OpenAI=FakeOpenAI)
        previous_key = os.environ.get("NVIDIA_TEST_KEY")
        os.environ["NVIDIA_TEST_KEY"] = "test-key"
        try:
            NvidiaAnalysisProvider(model="test-model", api_key_env="NVIDIA_TEST_KEY").analyze({}, [])
        finally:
            if original is None:
                del sys.modules["openai"]
            else:
                sys.modules["openai"] = original
            if previous_key is None:
                del os.environ["NVIDIA_TEST_KEY"]
            else:
                os.environ["NVIDIA_TEST_KEY"] = previous_key

        self.assertEqual(captured["timeout"], 120.0)
        self.assertEqual(len(captured["messages"]), 2)
        self.assertIn("동일 전표번호 안의 행만", captured["messages"][0]["content"])
        self.assertNotIn("개발비·무형자산 거래에서는", captured["messages"][0]["content"])
        policy = json.loads(captured["messages"][1]["content"])["policy"]
        self.assertIn("RAG retrieval is disabled", policy)

    def test_vercel_function_allows_two_minutes(self) -> None:
        config = json.loads((Path(__file__).parents[1] / "vercel.json").read_text(encoding="utf-8"))
        self.assertEqual(config["functions"]["api/index.py"]["maxDuration"], 120)


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

    def test_build_event_facts_includes_same_type_voucher_count(self) -> None:
        facts = build_event_facts(self.event, self.lines, same_type_voucher_count=3)

        self.assertEqual(facts["sameTypeVoucherCount"], 3)

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
            "referenceIds": ["chunk-1"],
            "missingFacts": ["차입 만기일", "약정 위반 여부"],
            "uncertainty": "MEDIUM",
        }

        risk = risk_from_ai_analysis(self.event, None, analysis, [{
            "id": "chunk-1", "title": "K-IFRS 1001", "type": "RAG_CHUNK",
            "locator": "p.12", "excerpt": "Current liability classification",
        }])

        self.assertIsNotNone(risk)
        assert risk is not None
        self.assertEqual(risk.route.value, "LLM_KIFRS")
        self.assertEqual(risk.package.evidence_status, "AI_KIFRS_ANALYSIS")
        self.assertEqual(risk.statement, analysis["riskSummary"])
        self.assertIn("차입 만기일", risk.package.missing_facts)

    def test_ai_result_without_a_rag_chunk_creates_a_kifrs_ai_risk(self) -> None:
        analysis = {
            "riskSummary": "Review is required.",
            "issueTypes": ["Borrowing classification"],
            "expectedQuestions": [],
            "evidenceChecklist": [],
            "responseGuidance": [],
            "referenceIds": [],
            "missingFacts": [],
            "uncertainty": "HIGH",
        }

        risk = risk_from_ai_analysis(self.event, None, analysis, [])

        self.assertIsNotNone(risk)
        assert risk is not None
        self.assertEqual(risk.route.value, "LLM_KIFRS")
        self.assertEqual(risk.package.generated_by, "AI_KIFRS_ANALYSIS")

    def test_ai_analysis_persists_structured_audit_output(self) -> None:
        analysis = {
            "riskSummary": "증자 거래로 추정되며 자본금과 주식발행초과금 분류의 근거 확인이 필요합니다.",
            "issueTypes": ["자본 분류 검토"],
            "relatedAccounts": ["현금", "자본금", "주식발행초과금"],
            "voucherCount": 1,
            "eventInference": "법인설립을 위한 현금 증자 거래로 추정됩니다.",
            "auditIssues": ["자본금과 주식발행초과금의 분류 근거 확인"],
            "expectedQuestions": ["주식 발행 조건과 액면가를 확인했습니까?"],
            "evidenceChecklist": ["주주총회 의사록", "납입증명서"],
            "responseGuidance": [],
            "standardsEvidence": [],
            "ledgerEvidence": [
                {"documentNumber": "JE-1", "postingDate": "2025-06-04", "accountName": "현금", "debitCredit": "D", "amount": "501000000", "description": "법인설립 증자"}
            ],
            "referenceIds": [],
            "missingFacts": ["주식 발행 조건"],
            "uncertainty": "MEDIUM",
        }

        risk = risk_from_ai_analysis(self.event, None, analysis, [])

        self.assertIsNotNone(risk)
        assert risk is not None
        self.assertEqual(risk.package.related_accounts, analysis["relatedAccounts"])
        self.assertEqual(risk.package.voucher_count, 1)
        self.assertEqual(risk.package.event_inference, analysis["eventInference"])
        self.assertEqual(risk.package.audit_issues, analysis["auditIssues"])
        self.assertEqual(risk.package.standards_evidence, [])
        self.assertEqual(risk.package.ledger_evidence, analysis["ledgerEvidence"])

    def test_ai_hypothesis_without_direct_rag_citation_is_saved_for_fact_confirmation(self) -> None:
        analysis = {
            "riskSummary": "개발 관련 임대료가 개발비로 처리되어 인식요건 충족 여부의 확인이 필요합니다.",
            "issueTypes": ["개발비 인식요건 검토"],
            "expectedQuestions": ["기술적 실현가능성과 미래 경제적 효익을 입증할 수 있는가?"],
            "evidenceChecklist": ["개발계획서", "기술검토 문서", "원가 배부근거"],
            "responseGuidance": ["확인 전에는 오류로 단정하지 않습니다."],
            "referenceIds": [],
            "missingFacts": ["기술적 실현가능성", "미래 경제적 효익", "원가 배부근거"],
            "uncertainty": "HIGH",
        }

        risk = risk_from_ai_analysis(self.event, None, analysis, [])

        self.assertIsNotNone(risk)
        assert risk is not None
        self.assertEqual(risk.package.evidence_status, "AI_KIFRS_ANALYSIS")
        self.assertEqual(risk.package.generated_by, "AI_KIFRS_ANALYSIS")


class FakeRepository:
    def __init__(self) -> None:
        self.materiality_profiles = {}
        self.journal_lines = {}
        self.events = {}
        self.analysis_event_results = {}
        self.risks = {}
        self.processed_source_hashes = set()
        self.audit_log = []
        self.memory = []

    def save(self, item):
        target = self.journal_lines if isinstance(item, JournalLine) else self.events if isinstance(item, AccountingEvent) else self.analysis_event_results if hasattr(item, "event_id") and hasattr(item, "attempts") else self.risks
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


class APITimeoutError(Exception):
    pass


class TimeoutThenSuccessProvider:
    def __init__(self) -> None:
        self.calls = 0

    def analyze(self, event_facts, references):
        self.calls += 1
        if self.calls == 1:
            raise APITimeoutError("test timeout")
        return {
            "riskSummary": "전표 사실에 대한 확인이 필요합니다.",
            "issueTypes": ["회계처리 검토"],
            "expectedQuestions": ["거래 조건은 무엇인가?"],
            "evidenceChecklist": ["계약서"],
            "responseGuidance": ["증빙을 확인합니다."],
            "referenceIds": [],
            "missingFacts": ["계약 조건"],
            "uncertainty": "MEDIUM",
        }


class AiOrchestrationTest(unittest.TestCase):
    def test_existing_ai_risk_is_refreshed_when_analysis_is_rerun(self) -> None:
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
        self.assertEqual(second["reusedPatterns"], 0)
        self.assertEqual(provider.calls, 2)

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
        self.assertEqual(result["risks"], 0)

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
        self.assertEqual(len(repo.risks), 0)
        provider = FakeAnalysisProvider()

        second = process_journals(repo, [line], actor="test", analysis_provider=provider)

        self.assertEqual(first["risks"], 0)
        self.assertEqual(second["events"], 1)
        self.assertEqual(second["risks"], 1)
        self.assertEqual(provider.calls, 1)
        self.assertEqual(len(repo.risks), 1)

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
        self.assertEqual(result["risks"], 0)

    def test_only_timeout_event_is_retried_and_saved_independently(self) -> None:
        company_id = uuid4()
        line = JournalLine(
            company_id=company_id, source_row=1, document_number="JE-5",
            posting_date=date(2025, 6, 4), account_code="211000",
            account_name="단기차입금", local_amount=Decimal("100000000"),
            debit_credit_indicator="C", fiscal_year=2025, fiscal_period=6,
            line_text="차입금 거래",
        )
        repo = FakeRepository()
        provider = TimeoutThenSuccessProvider()

        result = process_journals(repo, [line], actor="test", analysis_provider=provider)

        self.assertEqual(provider.calls, 2)
        self.assertEqual(result["retriedEvents"], 1)
        self.assertEqual(result["risks"], 1)
        stored = next(iter(repo.analysis_event_results.values()))
        self.assertEqual(stored.status, "COMPLETED")
        self.assertEqual(stored.attempts, 2)


if __name__ == "__main__":
    unittest.main()
