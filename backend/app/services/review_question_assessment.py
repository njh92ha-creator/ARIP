from __future__ import annotations

import json
import os
from typing import Any


QUESTION_ASSESSMENT_PROMPT = """# Role
너는 K-IFRS 회계감사 검토 전문가다.

# 검토 목적
아래 감사 이슈와 검토 질문에 대해, 저장된 답변들이 해당 질문의 확인 목적을 충족하는지 판단하라.
이 판단은 질문 단위의 검토 의견일 뿐이며, 리스크 전체를 자동으로 클리어하거나 회계처리 오류를 확정하지 않는다.

# 판단 기준
1. 답변이 질문의 핵심 확인 사항에 직접 답하는지 검토한다.
2. 단순한 결론 표현(예: “확인함”, “문제없음”)만 있고 구체적 사실·근거·판단 내용이 없으면 해소로 판단하지 않는다.
3. 답변 내용만으로 질문의 확인 목적이 충족되면 해소로 판단한다.
4. 일부 사실 또는 근거가 부족하지만 추가 자료·확인으로 판단 가능하면 추가 검토 필요로 판단한다.
5. 답변 내용이 원 감사 이슈를 해소하지 못하거나, 반대 사실·오류 가능성을 드러내면 해소 불가로 판단한다.
6. 입력에 없는 사실, 증빙, 계약 조건, 회계기준 근거를 임의로 만들지 않는다.
7. 전체 리스크의 클리어 여부나 심각도는 판단하지 않는다.

# Output
응답 스키마에 맞는 JSON 객체 하나만 반환하라.
"""

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "status": {
            "type": "string",
            "enum": ["RESOLVED", "NEEDS_FOLLOW_UP", "NOT_RESOLVED"],
        },
        "reason": {"type": "string"},
    },
    "required": ["status", "reason"],
}


def assess_review_question(
    *, audit_issues: list[str], question: str, answers: list[str], provider: str,
    model: str, api_key_env: str | None, enabled: bool,
) -> dict[str, str]:
    if not enabled:
        raise ValueError("AI 연결이 활성화되어 있지 않습니다.")
    if provider.lower() != "openai":
        raise ValueError("질문별 AI 검토는 현재 OpenAI 연결에서만 실행할 수 있습니다.")
    api_key = os.getenv(api_key_env or "OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API 키가 설정되어 있지 않습니다.")
    from openai import OpenAI

    response = OpenAI(api_key=api_key).responses.create(
        model=model,
        input=[
            {"role": "system", "content": QUESTION_ASSESSMENT_PROMPT},
            {"role": "user", "content": json.dumps({
                "auditIssues": audit_issues,
                "question": question,
                "savedAnswers": answers,
            }, ensure_ascii=False)},
        ],
        text={"format": {
            "type": "json_schema",
            "name": "arip_review_question_assessment",
            "strict": True,
            "schema": _SCHEMA,
        }},
    )
    parsed: Any = json.loads(response.output_text)
    return {"status": str(parsed["status"]), "reason": str(parsed["reason"]).strip()}
