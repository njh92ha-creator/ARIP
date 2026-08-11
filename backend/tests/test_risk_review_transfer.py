from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Lock
from urllib.parse import quote
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text

from app.api import router as api_router
from app.api.schemas import RiskReviewTransfer
from app.core.security import CurrentUser, Role
from app.main import app
import app.domain.repository as repository_module
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


def make_source_risk(
    repository: InMemoryRepository,
    *,
    company_id=None,
    risk_code: str = "LI_20260811_001",
) -> Risk:
    company_id = company_id or uuid4()
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
            risk_code=risk_code,
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
    source = make_source_risk(isolated_repository)
    return (
        TestClient(app, headers={"X-ARIP-Company-ID": str(source.company_id)}),
        isolated_repository,
        source,
    )


def transfer_to_review(client: TestClient, source: Risk) -> dict[str, object]:
    response = client.post(
        f"/api/v1/risks/{source.id}/transfer-to-review",
        json={"review_decision": "CHECK", "severity": "HIGH"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def persistent_repositories(
    tmp_path, monkeypatch: pytest.MonkeyPatch, count: int = 2
):
    database_path = tmp_path / "review-state.sqlite3"
    shared_engine = create_engine(
        f"sqlite+pysqlite:///{database_path}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(shared_engine, "connect")
    def sqlite_now(dbapi_connection, _connection_record):
        dbapi_connection.create_function(
            "now", 0, lambda: "2026-08-11 00:00:00+00:00"
        )

    with shared_engine.begin() as connection:
        connection.execute(text("""
            create table arip_state (
                collection varchar(80) not null,
                object_id varchar(64) not null,
                payload blob not null,
                updated_at timestamp not null default current_timestamp,
                primary key (collection, object_id)
            )
        """))
        connection.execute(text("""
            create table arip_state_log (
                id integer primary key autoincrement,
                collection varchar(80) not null,
                object_id varchar(64),
                payload blob not null,
                created_at timestamp not null default current_timestamp
            )
        """))
    monkeypatch.setattr(repository_module, "engine", shared_engine)

    repositories = []
    for _ in range(count):
        repository = InMemoryRepository(persistent=False)
        repository._persistence_enabled = True
        repository._db_ready = True
        repository._restore()
        repositories.append(repository)
    return shared_engine, repositories


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
    user = CurrentUser(
        user_id="reviewer", role=Role.ACCOUNTANT, company_id=source.company_id
    )

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


def test_review_list_rejects_viewers_and_principals_without_a_company_scope(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    _, _, source = review_api
    viewer = TestClient(app).get(
        "/api/v1/risk-reviews",
        params={"company_id": str(source.company_id)},
        headers={
            "X-ARIP-Role": "VIEWER",
            "X-ARIP-Company-ID": str(source.company_id),
        },
    )
    unscoped = TestClient(app).get(
        "/api/v1/risk-reviews",
        params={"company_id": str(source.company_id)},
    )

    assert viewer.status_code == 403
    assert unscoped.status_code == 403


def test_review_routes_deny_cross_company_read_write_transfer_and_download(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, repository, authorized_source = review_api
    other_source = make_source_risk(repository, risk_code="AS_20260811_001")
    other_scope = {"X-ARIP-Company-ID": str(other_source.company_id)}
    transferred = client.post(
        f"/api/v1/risks/{other_source.id}/transfer-to-review",
        json={"review_decision": "CHECK", "severity": "HIGH"},
        headers=other_scope,
    )
    assert transferred.status_code == 200, transferred.text
    case_id = transferred.json()["id"]
    upload = client.post(
        f"/api/v1/risk-reviews/{case_id}/attachments",
        files={"file": ("evidence.txt", b"audit evidence", "text/plain")},
        headers=other_scope,
    )
    assert upload.status_code == 200, upload.text
    attachment_id = upload.json()["id"]

    forbidden_requests = [
        client.get(
            "/api/v1/risk-reviews",
            params={"company_id": str(other_source.company_id)},
        ),
        client.post(
            f"/api/v1/risks/{other_source.id}/transfer-to-review",
            json={"review_decision": "CHECK", "severity": "HIGH"},
        ),
        client.get(f"/api/v1/risk-reviews/{case_id}"),
        client.put(
            f"/api/v1/risk-reviews/{case_id}/answers",
            json={"question": "Q", "answer": "A"},
        ),
        client.post(
            f"/api/v1/risk-reviews/{case_id}/review-decision",
            json={"decision": "PENDING"},
        ),
        client.post(
            f"/api/v1/risk-reviews/{case_id}/severity",
            json={"severity": "LOW"},
        ),
        client.post(
            f"/api/v1/risk-reviews/{case_id}/attachments",
            files={"file": ("forbidden.txt", b"x", "text/plain")},
        ),
        client.get(
            f"/api/v1/risk-reviews/{case_id}/attachments/{attachment_id}/download"
        ),
        client.delete(
            f"/api/v1/risk-reviews/{case_id}/attachments/{attachment_id}"
        ),
    ]

    assert authorized_source.company_id != other_source.company_id
    assert all(response.status_code == 403 for response in forbidden_requests), [
        (response.status_code, response.text) for response in forbidden_requests
    ]


def test_review_list_returns_only_summary_fields(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api
    transfer_to_review(client, source)

    listed = client.get(
        "/api/v1/risk-reviews", params={"company_id": str(source.company_id)}
    )

    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 1
    assert not {"id", "package", "answers", "attachments", "source_risk_id"} & set(
        listed.json()[0]
    )


def test_default_review_list_hides_pass_cases_but_detail_remains_available(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api
    transferred = transfer_to_review(client, source)
    changed = client.post(
        f"/api/v1/risk-reviews/{transferred['id']}/review-decision",
        json={"decision": "PASS"},
    )
    assert changed.status_code == 200, changed.text

    listed = client.get(
        "/api/v1/risk-reviews", params={"company_id": str(source.company_id)}
    )
    detail = client.get(f"/api/v1/risk-reviews/{transferred['id']}")

    assert listed.status_code == 200, listed.text
    assert listed.json() == []
    assert detail.status_code == 200, detail.text
    assert detail.json()["review_decision"] == "PASS"


def test_persistent_multi_instance_transfer_creates_one_atomic_case_and_marker(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, (first_repository, second_repository) = persistent_repositories(
        tmp_path, monkeypatch
    )
    source = make_source_risk(first_repository)
    second_repository._restore()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda repository: repository.transfer_risk_to_review(
                    repository.risks[source.id],
                    review_decision="CHECK",
                    severity="HIGH",
                    actor="reviewer",
                ),
                (first_repository, second_repository),
            )
        )

    fresh_repository = InMemoryRepository(persistent=False)
    fresh_repository._persistence_enabled = True
    fresh_repository._db_ready = True
    fresh_repository._restore()
    persisted = fresh_repository.review_case_for_source_risk(source.id)

    assert results[0][0].id == results[1][0].id
    assert sorted(created for _, created in results) == [False, True]
    assert persisted is not None
    assert len(fresh_repository.risk_review_cases) == 1
    assert [entry.entry_type for entry in fresh_repository.risk_memory[source.id]] == [
        "RISK_TRANSFERRED"
    ]
    assert [entry.action for entry in fresh_repository.audit_log] == ["RISK_TRANSFERRED"]


def test_persistent_transfer_rolls_back_marker_case_and_audit_on_partial_failure(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    shared_engine, (repository,) = persistent_repositories(
        tmp_path, monkeypatch, count=1
    )
    source = make_source_risk(repository)

    def fail_case_insert(_conn, _cursor, _statement, parameters, _context, _many):
        if parameters and parameters[0] == "RiskReviewCase":
            raise RuntimeError("forced review case persistence failure")

    event.listen(shared_engine, "before_cursor_execute", fail_case_insert)
    try:
        with pytest.raises(RuntimeError, match="forced review case persistence failure"):
            repository.transfer_risk_to_review(
                source,
                review_decision="CHECK",
                severity="HIGH",
                actor="reviewer",
            )
    finally:
        event.remove(shared_engine, "before_cursor_execute", fail_case_insert)

    fresh_repository = InMemoryRepository(persistent=False)
    fresh_repository._persistence_enabled = True
    fresh_repository._db_ready = True
    fresh_repository._restore()
    with shared_engine.connect() as connection:
        review_rows = connection.execute(
            text("select count(*) from arip_state where collection like 'RiskReview%'")
        ).scalar_one()

    assert review_rows == 0
    assert fresh_repository.review_case_for_source_risk(source.id) is None
    assert fresh_repository.risk_memory[source.id] == []
    assert fresh_repository.audit_log == []


def test_review_writes_fail_closed_when_configured_persistence_is_unavailable() -> None:
    repository = InMemoryRepository(persistent=False)
    source = make_source_risk(repository)
    repository._persistence_enabled = True
    repository._db_ready = False

    with pytest.raises(RuntimeError, match="review persistence is unavailable"):
        repository.transfer_risk_to_review(
            source,
            review_decision="CHECK",
            severity="HIGH",
            actor="reviewer",
        )

    assert repository.risk_review_cases == {}
    assert repository.risk_memory[source.id] == []
    assert repository.audit_log == []


def test_persistent_review_mutations_share_answer_fields_and_attachment_cap(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, (first_repository, second_repository) = persistent_repositories(
        tmp_path, monkeypatch
    )
    source = make_source_risk(first_repository)
    review_case, _ = first_repository.transfer_risk_to_review(
        source,
        review_decision="CHECK",
        severity="HIGH",
        actor="reviewer",
    )
    second_repository._restore()

    first_repository.upsert_review_answer(
        review_case.id, question="What is the repayment date?", answer="2027-01-31"
    )
    second_repository.upsert_review_answer(
        review_case.id, question="What is the repayment date?", answer="2027-02-28"
    )
    first_repository.update_review_case_decision(review_case.id, "PASS")
    second_repository.update_review_case_severity(review_case.id, "LOW")
    for index in range(10):
        (first_repository if index % 2 == 0 else second_repository).add_review_attachment(
            RiskReviewAttachment(
                review_case_id=review_case.id,
                filename=f"evidence-{index}.txt",
                content_type="text/plain",
                size_bytes=1,
                content=b"x",
            )
        )
    with pytest.raises(ValueError, match="10 attachments"):
        second_repository.add_review_attachment(
            RiskReviewAttachment(
                review_case_id=review_case.id,
                filename="too-many.txt",
                content_type="text/plain",
                size_bytes=1,
                content=b"x",
            )
        )

    fresh_repository = InMemoryRepository(persistent=False)
    fresh_repository._persistence_enabled = True
    fresh_repository._db_ready = True
    fresh_repository._restore()
    refreshed_case = fresh_repository.get_review_case(review_case.id)
    answers = fresh_repository.answers_for_review_case(review_case.id)
    attachments = fresh_repository.attachments_for_review_case(review_case.id)

    assert refreshed_case is not None
    assert refreshed_case.review_decision == "PASS"
    assert refreshed_case.severity == "LOW"
    assert len(answers) == 1
    assert answers[0].answer == "2027-02-28"
    assert len(attachments) == 10


def test_persistent_transfer_rejects_a_legacy_case_with_the_same_business_code(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, (repository,) = persistent_repositories(tmp_path, monkeypatch, count=1)
    original = make_source_risk(repository)
    repository.create_review_case(
        original, review_decision="CHECK", severity="HIGH"
    )
    duplicate = make_source_risk(
        repository,
        company_id=original.company_id,
        risk_code=original.risk_code,
    )

    with pytest.raises(ValueError, match="risk code already belongs"):
        repository.transfer_risk_to_review(
            duplicate,
            review_decision="CHECK",
            severity="HIGH",
            actor="reviewer",
        )

    fresh_repository = InMemoryRepository(persistent=False)
    fresh_repository._persistence_enabled = True
    fresh_repository._db_ready = True
    fresh_repository._restore()
    assert len(fresh_repository.risk_review_cases) == 1
    assert fresh_repository.review_case_for_source_risk(duplicate.id) is None


@pytest.mark.parametrize(
    "invalid_risk_code",
    ["", "INVALID", "LI_20260811_01", "XX_20260811_001"],
)
def test_transfer_rejects_missing_or_invalid_business_risk_codes(
    review_api: tuple[TestClient, InMemoryRepository, Risk], invalid_risk_code: str
) -> None:
    client, _, source = review_api
    source.risk_code = invalid_risk_code

    response = client.post(
        f"/api/v1/risks/{source.id}/transfer-to-review",
        json={"review_decision": "CHECK", "severity": "HIGH"},
    )

    assert response.status_code == 422


def test_transfer_rejects_a_duplicate_business_risk_code_within_the_company(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, repository, source = review_api
    duplicate = make_source_risk(
        repository,
        company_id=source.company_id,
        risk_code=source.risk_code,
    )
    transfer_to_review(client, source)

    response = client.post(
        f"/api/v1/risks/{duplicate.id}/transfer-to-review",
        json={"review_decision": "CHECK", "severity": "HIGH"},
    )

    assert response.status_code == 422


def test_review_detail_accepts_the_business_risk_code_as_its_route_identifier(
    review_api: tuple[TestClient, InMemoryRepository, Risk]
) -> None:
    client, _, source = review_api
    transferred = transfer_to_review(client, source)

    response = client.get(f"/api/v1/risk-reviews/{source.risk_code}")

    assert response.status_code == 200, response.text
    assert response.json()["id"] == transferred["id"]
    assert response.json()["risk_code"] == source.risk_code


@pytest.mark.parametrize(
    "filename",
    ["검토 증빙.txt", 'quote"name.txt', "line\r\nbreak.txt"],
)
def test_attachment_download_uses_an_ascii_safe_rfc5987_filename(
    review_api: tuple[TestClient, InMemoryRepository, Risk], filename: str
) -> None:
    _, repository, source = review_api
    review_case = repository.create_review_case(
        source, review_decision="CHECK", severity="HIGH"
    )
    attachment = repository.add_review_attachment(
        RiskReviewAttachment(
            review_case_id=review_case.id,
            filename=filename,
            content_type="text/plain",
            size_bytes=1,
            content=b"x",
        )
    )
    client = TestClient(
        app,
        headers={"X-ARIP-Company-ID": str(source.company_id)},
        raise_server_exceptions=False,
    )

    response = client.get(
        f"/api/v1/risk-reviews/{review_case.id}/attachments/{attachment.id}/download"
    )

    assert response.status_code == 200, response.text
    disposition = response.headers["content-disposition"]
    disposition.encode("ascii")
    assert "\r" not in disposition and "\n" not in disposition
    assert f"filename*=UTF-8''{quote(filename, safe='')}" in disposition


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
