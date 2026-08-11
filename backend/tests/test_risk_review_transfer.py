from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Lock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api import router as api_router
from app.api.schemas import RiskReviewTransfer
from app.core.security import CurrentUser, Role
from app.main import app
from app.domain.models import (
    AccountingEvent,
    AnalysisRoute,
    CompanySettings,
    Risk,
    RiskLevel,
    RiskPackage,
    RiskReviewAttachment,
)
from app.domain.repository import InMemoryRepository


def make_source_risk(repository: InMemoryRepository) -> Risk:
    company_id = uuid4()
    event = repository.save(
        AccountingEvent(
            company_id=company_id,
            event_type="UNCLASSIFIED_ACCOUNTING_EVENT",
            title="Borrowing",
            amount=Decimal("100000000"),
            currency="KRW",
            journal_line_ids=[],
            canonical_signature={},
            event_hash="event-1",
            classification_confidence=0.8,
        )
    )
    return repository.save(
        Risk(
            company_id=company_id,
            event_id=event.id,
            title="Borrowing classification",
            statement="Confirm the borrowing classification.",
            level=RiskLevel.HIGH,
            score=8,
            route=AnalysisRoute.RAG_LLM,
            risk_code="LI_20260811_001",
            package=RiskPackage(
                summary="Classify the borrowing correctly.",
                references=[{"title": "K-IFRS 1001", "url": "https://example.test/k-ifrs"}],
                expected_questions=["What is the repayment date?"],
                evidence_checklist=["Loan agreement"],
                response_guidance=["Compare terms with the standard."],
                generated_by="AI_RAG_SUPPORTED",
            ),
        )
    )


@pytest.fixture
def review_api(monkeypatch: pytest.MonkeyPatch) -> tuple[TestClient, InMemoryRepository, Risk]:
    """Exercise routes against clean state without touching runtime persistence."""
    isolated_repository = InMemoryRepository(persistent=False)
    monkeypatch.setattr(api_router, "repository", isolated_repository)
    return TestClient(app), isolated_repository, make_source_risk(isolated_repository)


def transfer_to_review(client: TestClient, source: Risk) -> dict[str, object]:
    response = client.post(
        f"/api/v1/risks/{source.id}/transfer-to-review",
        json={"review_decision": "CHECK", "severity": "HIGH"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_create_review_case_copies_the_source_analysis_snapshot() -> None:
    repository = InMemoryRepository(persistent=False)
    source = make_source_risk(repository)

    review_case = repository.create_review_case(
        source, review_decision="CHECK", severity="HIGH"
    )
    source.package.expected_questions.append("This belongs only to the source.")

    assert review_case.risk_code == "LI_20260811_001"
    assert review_case.package.summary == "Classify the borrowing correctly."
    assert review_case.package.expected_questions == ["What is the repayment date?"]


def test_create_review_case_validates_inputs_before_returning_an_existing_case() -> None:
    repository = InMemoryRepository(persistent=False)
    source = make_source_risk(repository)
    repository.create_review_case(source, review_decision="CHECK", severity="HIGH")

    with pytest.raises(ValueError, match="CHECK or PENDING"):
        repository.create_review_case(source, review_decision="PASS", severity="HIGH")
    with pytest.raises(ValueError, match="HIGH, MEDIUM, or LOW"):
        repository.create_review_case(source, review_decision="CHECK", severity="CRITICAL")


def test_add_review_attachment_rejects_the_eleventh_attachment() -> None:
    repository = InMemoryRepository(persistent=False)
    review_case = repository.create_review_case(
        make_source_risk(repository), review_decision="PENDING", severity="MEDIUM"
    )

    for index in range(10):
        repository.add_review_attachment(
            RiskReviewAttachment(
                review_case_id=review_case.id,
                filename=f"evidence-{index}.txt",
                content_type="text/plain",
                size_bytes=1,
                content=b"x",
            )
        )

    with pytest.raises(ValueError, match="10 attachments"):
        repository.add_review_attachment(
            RiskReviewAttachment(
                review_case_id=review_case.id,
                filename="too-many.txt",
                content_type="text/plain",
                size_bytes=1,
                content=b"x",
            )
        )


def test_upsert_review_answer_replaces_the_answer_for_the_same_question() -> None:
    repository = InMemoryRepository(persistent=False)
    review_case = repository.create_review_case(
        make_source_risk(repository), review_decision="CHECK", severity="LOW"
    )

    original = repository.upsert_review_answer(
        review_case.id, question="What is the repayment date?", answer="2027-01-31"
    )
    updated = repository.upsert_review_answer(
        review_case.id, question="What is the repayment date?", answer="2027-02-28"
    )

    assert updated.id == original.id
    assert updated.answer == "2027-02-28"
    assert repository.answers_for_review_case(review_case.id) == [updated]


def test_removing_a_company_removes_its_review_case_answers_and_attachments() -> None:
    repository = InMemoryRepository(persistent=False)
    company_id = uuid4()
    repository.save(
        CompanySettings(
            company_code="C001", company_name="Test Company", industry="Manufacturing", id=company_id
        )
    )
    source = make_source_risk(repository)
    source.company_id = company_id
    review_case = repository.create_review_case(
        source, review_decision="CHECK", severity="HIGH"
    )
    answer = repository.upsert_review_answer(
        review_case.id, question="Question", answer="Answer"
    )
    attachment = repository.add_review_attachment(
        RiskReviewAttachment(
            review_case_id=review_case.id,
            filename="evidence.txt",
            content_type="text/plain",
            size_bytes=1,
            content=b"x",
        )
    )

    repository.remove_company(company_id)

    assert review_case.id not in repository.risk_review_cases
    assert answer.id not in repository.risk_review_answers
    assert attachment.id not in repository.risk_review_attachments


@pytest.mark.parametrize("payload", [{"severity": "HIGH"}, {"review_decision": "CHECK"}])
def test_transfer_requires_an_explicit_review_decision_and_severity(
    review_api: tuple[TestClient, InMemoryRepository, Risk], payload: dict[str, str]
) -> None:
    client, _, source = review_api

    response = client.post(f"/api/v1/risks/{source.id}/transfer-to-review", json=payload)

    assert response.status_code == 422


def test_transfer_is_idempotent_and_hides_the_source_from_risk_lists(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, repository, source = review_api

    review_case = transfer_to_review(client, source)
    repeated = transfer_to_review(client, source)

    assert review_case["id"] == repeated["id"]
    assert review_case["risk_code"] == source.risk_code
    assert review_case["package"]["summary"] == source.package.summary
    assert [entry.entry_type for entry in repository.risk_memory[source.id]].count("RISK_TRANSFERRED") == 1
    for path in (
        "/api/v1/risks",
        "/api/v1/settings/risk-management",
        "/api/v1/risk-reviews",
    ):
        response = client.get(path, params={"company_id": str(source.company_id)})
        assert response.status_code == 200
        assert str(source.id) not in {item.get("id") for item in response.json()}


def test_review_case_saves_answers_and_updates_decision_and_severity(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api
    review_case = transfer_to_review(client, source)
    case_id = review_case["id"]

    answer = client.put(
        f"/api/v1/risk-reviews/{case_id}/answers",
        json={"question": "What is the repayment date?", "answer": "2027-01-31"},
    )
    decision = client.post(
        f"/api/v1/risk-reviews/{case_id}/review-decision",
        json={"decision": "PENDING"},
    )
    severity = client.post(
        f"/api/v1/risk-reviews/{case_id}/severity",
        json={"severity": "LOW"},
    )
    detail = client.get(f"/api/v1/risk-reviews/{case_id}")

    assert answer.status_code == 200, answer.text
    assert answer.json()["answer"] == "2027-01-31"
    assert decision.status_code == 200, decision.text
    assert decision.json()["review_decision"] == "PENDING"
    assert severity.status_code == 200, severity.text
    assert severity.json()["severity"] == "LOW"
    assert detail.status_code == 200, detail.text
    assert detail.json()["answers"] == [answer.json()]


def test_review_case_uploads_downloads_and_deletes_attachments(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api
    review_case = transfer_to_review(client, source)
    case_id = review_case["id"]

    upload = client.post(
        f"/api/v1/risk-reviews/{case_id}/attachments",
        files={"file": ("evidence.txt", b"audit evidence", "text/plain")},
    )

    assert upload.status_code == 200, upload.text
    attachment = upload.json()
    assert attachment["filename"] == "evidence.txt"
    download = client.get(f"/api/v1/risk-reviews/{case_id}/attachments/{attachment['id']}/download")
    assert download.status_code == 200
    assert download.content == b"audit evidence"
    deleted = client.delete(f"/api/v1/risk-reviews/{case_id}/attachments/{attachment['id']}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["deleted"] is True


def test_review_case_rejects_an_eleventh_attachment(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api
    review_case = transfer_to_review(client, source)
    case_id = review_case["id"]

    for index in range(10):
        response = client.post(
            f"/api/v1/risk-reviews/{case_id}/attachments",
            files={"file": (f"evidence-{index}.txt", b"x", "text/plain")},
        )
        assert response.status_code == 200, response.text

    response = client.post(
        f"/api/v1/risk-reviews/{case_id}/attachments",
        files={"file": ("too-many.txt", b"x", "text/plain")},
    )

    assert response.status_code == 422


def test_concurrent_transfers_append_one_transfer_record(
    review_api: tuple[TestClient, InMemoryRepository, Risk], monkeypatch: pytest.MonkeyPatch
) -> None:
    _, repository, source = review_api
    original_lookup = repository.review_case_for_source_risk
    starting_gate = Barrier(2)
    lookup_lock = Lock()
    lookup_count = 0

    def synchronized_lookup(source_risk_id):  # type: ignore[no-untyped-def]
        nonlocal lookup_count
        with lookup_lock:
            lookup_count += 1
            wait_for_peer = lookup_count <= 2
        existing = original_lookup(source_risk_id)
        if wait_for_peer and not repository._lock._is_owned():
            starting_gate.wait(timeout=2)
        return existing

    monkeypatch.setattr(repository, "review_case_for_source_risk", synchronized_lookup)
    payload = RiskReviewTransfer(review_decision="CHECK", severity="HIGH")
    user = CurrentUser(user_id="reviewer", role=Role.ACCOUNTANT)

    with ThreadPoolExecutor(max_workers=2) as executor:
        cases = list(
            executor.map(
                lambda _: api_router.transfer_risk_to_review(source.id, payload, user),
                range(2),
            )
        )

    assert cases[0]["id"] == cases[1]["id"]
    assert [entry.entry_type for entry in repository.risk_memory[source.id]].count("RISK_TRANSFERRED") == 1
    assert [entry.action for entry in repository.audit_log].count("RISK_TRANSFERRED") == 1


def test_review_case_routes_require_an_established_role(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api
    review_case = transfer_to_review(client, source)
    case_id = review_case["id"]
    attachment = client.post(
        f"/api/v1/risk-reviews/{case_id}/attachments",
        files={"file": ("evidence.txt", b"audit evidence", "text/plain")},
    ).json()
    forbidden_headers = {"X-ARIP-ROLE": "VIEWER"}
    requests = [
        ("get", f"/api/v1/risk-reviews/{case_id}", {}),
        ("put", f"/api/v1/risk-reviews/{case_id}/answers", {"json": {"question": "Q", "answer": "A"}}),
        ("post", f"/api/v1/risk-reviews/{case_id}/review-decision", {"json": {"decision": "PENDING"}}),
        ("post", f"/api/v1/risk-reviews/{case_id}/severity", {"json": {"severity": "LOW"}}),
        ("post", f"/api/v1/risk-reviews/{case_id}/attachments", {"files": {"file": ("new.txt", b"x", "text/plain")}}),
        ("get", f"/api/v1/risk-reviews/{case_id}/attachments/{attachment['id']}/download", {}),
        ("delete", f"/api/v1/risk-reviews/{case_id}/attachments/{attachment['id']}", {}),
    ]

    for method, path, kwargs in requests:
        response = getattr(client, method)(path, headers=forbidden_headers, **kwargs)
        assert response.status_code == 403, f"{method.upper()} {path}: {response.text}"


def test_review_case_transfer_list_and_detail_expose_the_business_risk_code(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api

    transferred = transfer_to_review(client, source)
    listed = client.get("/api/v1/risk-reviews", params={"company_id": str(source.company_id)})
    detail = client.get(f"/api/v1/risk-reviews/{transferred['id']}")

    assert transferred["risk_code"] == source.risk_code
    assert listed.status_code == 200
    assert listed.json()[0]["risk_code"] == source.risk_code
    assert detail.status_code == 200
    assert detail.json()["risk_code"] == source.risk_code
    assert "source_risk_id" not in detail.json()
