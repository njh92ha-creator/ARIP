import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from app.main import app
from app.domain.repository import InMemoryRepository


class RuntimePersistenceTests(unittest.TestCase):
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
