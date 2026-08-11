from decimal import Decimal
from uuid import uuid4

import pytest

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
