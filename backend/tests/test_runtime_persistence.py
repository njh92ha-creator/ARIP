import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from app.main import app
from app.domain.repository import InMemoryRepository, hydrate_legacy_object
from app.domain.models import RiskPackage
from app.api.schemas import AiConnectionTestInput


class RuntimePersistenceTests(unittest.TestCase):
    def test_legacy_risk_package_is_hydrated_with_structured_ai_defaults(self) -> None:
        package = RiskPackage(
            summary="legacy",
            references=[],
            expected_questions=[],
            evidence_checklist=[],
            response_guidance=[],
            generated_by="LEGACY",
        )
        del package.related_accounts
        del package.voucher_count
        del package.event_inference
        del package.audit_issues
        del package.standards_evidence
        del package.ledger_evidence
        del package.issue_types

        hydrate_legacy_object(package)

        self.assertEqual(package.related_accounts, [])
        self.assertEqual(package.voucher_count, 0)
        self.assertEqual(package.event_inference, "")
        self.assertEqual(package.audit_issues, [])
        self.assertEqual(package.standards_evidence, [])
        self.assertEqual(package.ledger_evidence, [])
        self.assertEqual(package.issue_types, [])

    def test_ai_connection_test_accepts_an_analysis_prompt(self):
        payload = AiConnectionTestInput(
            secret_reference="env:NVIDIA_API_KEY",
            provider="nvidia",
            analysis_prompt="분석할 전표입니다.",
        )

        self.assertEqual(payload.analysis_prompt, "분석할 전표입니다.")

    def test_runtime_setting_survives_in_memory_repository(self):
        repository = InMemoryRepository(persistent=False)
        setting = {"aiConnection": {"configured": True}, "knowledgeSources": []}

        repository.save_runtime_setting("global", setting)

        self.assertEqual(repository.get_runtime_setting("global"), setting)

    def test_knowledge_document_can_be_saved_without_a_filesystem(self):
        repository = InMemoryRepository(persistent=False)
        document = {
            "id": "bd1d4ef5-6baf-46e3-9a99-b2e297e12a5a",
            "relativePath": "audit-guide.txt",
            "content": b"audit guidance",
            "status": "PENDING",
        }

        repository.save_runtime_setting("knowledge:document:1", document)

        self.assertEqual(
            repository.get_runtime_setting("knowledge:document:1"), document
        )

    def test_knowledge_upload_waits_for_explicit_rag_indexing(self):
        company_id = uuid4()
        client = TestClient(app)

        response = client.post(
            "/api/v1/settings/knowledge-sources/local-standards/upload",
            params={"company_id": str(company_id)},
            files=[("files", ("audit-guide.txt", b"audit guidance", "text/plain"))],
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["uploaded"], 1)
        candidates = client.get(
            "/api/v1/settings/knowledge-sources/local-standards/candidates",
            params={"company_id": str(company_id)},
        ).json()
        self.assertEqual(candidates[0]["relativePath"], "audit-guide.txt")
        self.assertEqual(candidates[0]["status"], "APPROVED")
        self.assertFalse(candidates[0]["ragEligible"])
        self.assertEqual(candidates[0]["ragStatus"], "NOT_INDEXED")

        duplicate = client.post(
            "/api/v1/settings/knowledge-sources/local-standards/upload",
            params={"company_id": str(company_id)},
            files=[("files", ("audit-guide.txt", b"second version", "text/plain"))],
        )
        self.assertEqual(duplicate.status_code, 409)
