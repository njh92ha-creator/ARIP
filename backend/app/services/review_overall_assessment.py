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
1. 질문별로 답변이 해당 질문의 확인 목적을 충족하는지 해소, 추가 검토 필요, 해소 불가 중 하나로 판단한다.
2. 답변에서 실제로 확인된 사실만 confirmedFacts에 정리한다.
3. 확인된 사실과 미해소 사항을 종합해 현 회계처리 유지 가능, 수정 검토 필요, 판단 보류·추가 자료 필요 중 하나의 회계 결론을 제시한다.
4. 권고 조치에는 종합 회계 결론을 변경할 수 있는 미해소 질문, 아직 확인되지 않은 사실, 그 사실이 확인되면 결론이 어떻게 달라질 수 있는지, 필요한 자료 또는 후속 조치를 포함한다.
5. 단순히 답변이 질문에 답했는지만 판단하지 말고, 답변이 원 감사 이슈와 회계처리 결론에 미치는 영향을 분석한다.
6. 입력에 없는 사실, 계약 조건, 증빙, 금액, 회계기준 근거를 임의로 만들지 않는다.

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
        "questionFindings": {"type": "array", "items": _FINDING},
        "confirmedFacts": {"type": "array", "items": {"type": "string"}},
        "conclusionStatus": {"type": "string", "enum": ["MAINTAIN_TREATMENT", "ADJUSTMENT_REVIEW", "ADDITIONAL_EVIDENCE_NEEDED"]},
        "accountingConclusion": {"type": "string"},
        "recommendedActions": {"type": "array", "items": _ACTION},
    },
    "required": ["questionFindings", "confirmedFacts", "conclusionStatus", "accountingConclusion", "recommendedActions"],
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
