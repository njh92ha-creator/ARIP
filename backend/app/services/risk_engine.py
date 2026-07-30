from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from app.domain.models import (
    AccountingEvent,
    AnalysisRoute,
    MaterialityProfile,
    Risk,
    RiskLevel,
    RiskPackage,
)


@dataclass(frozen=True, slots=True)
class RiskTemplate:
    event_type: str
    title: str
    statement: str
    references: tuple[dict[str, str], ...]
    questions: tuple[str, ...]
    evidence: tuple[str, ...]
    response: tuple[str, ...]
    base_score: int


TEMPLATES: dict[str, RiskTemplate] = {
    "DEVELOPMENT_COST_CAPITALIZATION": RiskTemplate(
        event_type="DEVELOPMENT_COST_CAPITALIZATION",
        title="개발비 자산화 검토",
        statement="개발비의 인식 시점과 자산화 요건이 감사에서 검토될 가능성이 높습니다.",
        references=(
            {"type": "K-IFRS", "code": "1038", "status": "REFERENCE_REQUIRED"},
        ),
        questions=(
            "연구단계와 개발단계를 구분한 근거는 무엇입니까?",
            "기술적 실현가능성과 미래경제적효익을 어떻게 입증했습니까?",
        ),
        evidence=(
            "개발단계 전환 승인자료",
            "기술적 실현가능성 검토서",
            "사업성 및 미래경제적효익 자료",
            "개발비 집계·배부 명세",
        ),
        response=(
            "자산화 개시일 이전·이후 지출을 구분합니다.",
            "K-IFRS 1038의 자산화 요건별 근거를 연결합니다.",
        ),
        base_score=72,
    ),
    "REVENUE_RECOGNITION": RiskTemplate(
        event_type="REVENUE_RECOGNITION",
        title="수익인식 기간귀속 검토",
        statement="수익의 인식 시점과 기간귀속이 감사에서 검토될 가능성이 높습니다.",
        references=(
            {"type": "K-IFRS", "code": "1115", "status": "REFERENCE_REQUIRED"},
        ),
        questions=("수행의무와 통제 이전 시점을 어떻게 판단했습니까?",),
        evidence=("계약서", "검수·인도 자료", "매출 Cut-off 명세"),
        response=("계약 조건과 인도·검수 시점을 회계 인식일과 대사합니다.",),
        base_score=68,
    ),
    "PROVISION": RiskTemplate(
        event_type="PROVISION",
        title="충당부채 인식·측정 검토",
        statement="충당부채의 현재의무와 최선의 추정치가 감사에서 검토될 가능성이 높습니다.",
        references=(
            {"type": "K-IFRS", "code": "1037", "status": "REFERENCE_REQUIRED"},
        ),
        questions=("현재의무와 자원유출 가능성을 어떻게 평가했습니까?",),
        evidence=("법률검토서", "추정 산식", "경영진 승인자료"),
        response=("인식 요건과 추정 가정의 변경 이력을 정리합니다.",),
        base_score=70,
    ),
}


def _materiality_level(
    amount: Decimal, profile: MaterialityProfile | None
) -> tuple[str, int]:
    if not profile:
        return "UNCONFIGURED", 0
    if amount >= profile.overall_materiality:
        return "HIGH", 20
    if amount >= profile.performance_materiality:
        return "MEDIUM", 12
    if amount >= profile.trivial_threshold:
        return "LOW", 5
    return "TRIVIAL", 0


def analyze_event(
    event: AccountingEvent,
    materiality: MaterialityProfile | None,
    *,
    prior_risk: Risk | None = None,
    external_ai_available: bool = False,
) -> Risk | None:
    materiality_level, materiality_score = _materiality_level(event.amount, materiality)
    if prior_risk:
        route = AnalysisRoute.REUSE_WITH_REASSESSMENT
        template = TEMPLATES.get(event.event_type)
        base = prior_risk.score
    else:
        template = TEMPLATES.get(event.event_type)
        route = AnalysisRoute.RULE_TEMPLATE if template else AnalysisRoute.MANUAL_REVIEW
        base = template.base_score if template else 35
    if not template and external_ai_available:
        route = AnalysisRoute.RAG_LLM
    # The orchestration layer performs semantic AI analysis for non-template
    # events.  Keep deterministic manual review only as the safe fallback
    # when an AI provider is unavailable or deliberately disabled.
    if not template and external_ai_available:
        return None
    if not template and event.classification_confidence < 0.70:
        package = RiskPackage(
            summary="회계사건 분류 신뢰도가 낮아 담당자 검토가 필요합니다.",
            references=[],
            expected_questions=["적용할 회계기준 범주와 거래 실질을 확인해 주십시오."],
            evidence_checklist=["거래 설명", "관련 계약 또는 승인자료"],
            response_guidance=["회계기준 적용 범주를 확정한 후 재분석합니다."],
            generated_by="MANUAL_REVIEW_GATE",
        )
        return Risk(
            company_id=event.company_id,
            event_id=event.id,
            title="미분류 회계사건 검토",
            statement="거래 실질과 적용 기준 범주의 확인이 필요합니다.",
            level=RiskLevel.MEDIUM,
            score=min(100, base + materiality_score),
            route=route,
            package=package,
            materiality_level=materiality_level,
        )
    if not template:
        return None
    score = min(100, base + materiality_score)
    level = (
        RiskLevel.HIGH
        if score >= 75
        else RiskLevel.MEDIUM
        if score >= 50
        else RiskLevel.LOW
    )
    package = RiskPackage(
        summary=template.statement,
        references=list(template.references),
        expected_questions=list(template.questions),
        evidence_checklist=list(template.evidence),
        response_guidance=list(template.response),
        generated_by=route.value,
    )
    return Risk(
        company_id=event.company_id,
        event_id=event.id,
        title=template.title,
        statement=template.statement,
        level=level,
        score=score,
        route=route,
        package=package,
        materiality_level=materiality_level,
    )
