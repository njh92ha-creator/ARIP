from __future__ import annotations

import json
import os
from typing import Any


OVERALL_ASSESSMENT_PROMPT = """# Role
너는 K-IFRS 회계감사 검토 전문가다.

# 검토 목적
원 감사 이슈, 모든 검토 질문 및 질문별 저장 답변을 종합하여 현재 회계처리의 결론을 검토하라.
이 결과는 검토자의 의사결정을 돕는 의견이며, 리스크를 자동으로 클리어하거나 회계처리 오류를 확정하지 않는다.

# 판단 기준
1. 답변이 원 감사 이슈와 회계처리 결론에 미치는 영향을 분석한다.
2. accountingConclusion은 결론을 첫 문장에 단정적으로 제시하고, 그 뒤에 실제 답변에서 확인된 중요 근거만 한두 문장으로 덧붙인다.
3. "검토해야 한다", "가능성이 있다", "필요할 수 있다"처럼 결론을 흐리는 표현을 쓰지 않는다. 다만 답변만으로 결론을 낼 수 없을 때는 "판단 보류"라고 명확히 결론 내린다.
4. 권고 조치에는 종합 회계 결론을 변경할 수 있는 미해소 질문, 아직 확인되지 않은 사실, 그 사실이 확인되면 결론이 어떻게 달라질 수 있는지, 필요한 자료 또는 후속 조치를 포함한다.
5. 입력에 없는 사실, 계약 조건, 증빙, 금액, 회계기준 근거를 임의로 만들지 않는다.

# Output
응답 스키마에 맞는 JSON 객체 하나만 반환하라.
"""

_FINDING = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "question": {"type": "string"},
        "status": {"type": "string", "enum": ["RESOLVED", "NEEDS_FOLLOW_UP", "NOT_RESOLVED"]},
        "reason": {"type": "string"},
    },
    "required": ["question", "status", "reason"],
}

_ACTION = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "unresolvedQuestion": {"type": "string"},
        "missingFact": {"type": "string"},
        "potentialConclusionEffect": {"type": "string"},
        "action": {"type": "string"},
    },
    "required": ["unresolvedQuestion", "missingFact", "potentialConclusionEffect", "action"],
}

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "conclusionStatus": {"type": "string", "enum": ["MAINTAIN_TREATMENT", "ADJUSTMENT_REVIEW", "ADDITIONAL_EVIDENCE_NEEDED"]},
        "accountingConclusion": {"type": "string"},
        "recommendedActions": {"type": "array", "items": _ACTION},
    },
    "required": ["conclusionStatus", "accountingConclusion", "recommendedActions"],
}


def assess_review_overall(
    *, audit_issues: list[str], questions: list[str], answers_by_question: dict[str, list[str]],
    provider: str, model: str, api_key_env: str | None, enabled: bool,
) -> dict[str, Any]:
    if not enabled:
        raise ValueError("AI 연결이 활성화되어 있지 않습니다.")
    if provider.lower() != "openai":
        raise ValueError("종합 AI 검토는 현재 OpenAI 연결에서만 실행할 수 있습니다.")
    api_key = os.getenv(api_key_env or "OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API 키가 설정되어 있지 않습니다.")
    from openai import OpenAI

    response = OpenAI(api_key=api_key).responses.create(
        model=model,
        input=[
            {"role": "system", "content": OVERALL_ASSESSMENT_PROMPT},
            {"role": "user", "content": json.dumps({
                "auditIssues": audit_issues,
                "questions": questions,
                "answersByQuestion": answers_by_question,
            }, ensure_ascii=False)},
        ],
        text={"format": {
            "type": "json_schema",
            "name": "arip_review_overall_assessment",
            "strict": True,
            "schema": _SCHEMA,
        }},
    )
    return json.loads(response.output_text)
