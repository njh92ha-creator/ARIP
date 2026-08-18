from __future__ import annotations

import json
import os
from typing import Any


OVERALL_ASSESSMENT_PROMPT = """# Role
너는 K-IFRS 회계감사 검토 전문가다.

# 검토 목적
`reviewContext`의 이관 시점 분석 스냅샷과 모든 검토 질문 및 질문별 저장 답변을 종합하여 현재 회계처리의 결론을 검토하라.
이 결과는 검토자의 의사결정을 돕는 의견이며, 리스크를 자동으로 클리어하거나 회계처리 오류를 확정하지 않는다.

# 판단 기준
1. 답변이 원 감사 이슈와 회계처리 결론에 미치는 영향을 분석한다.
2. accountingConclusion은 결론을 첫 문장에 단정적으로 제시하고, 그 뒤에 실제 답변에서 확인된 중요 근거만 한두 문장으로 덧붙인다.
3. "검토해야 한다", "가능성이 있다", "필요할 수 있다"처럼 결론을 흐리는 표현을 쓰지 않는다. 다만 답변만으로 결론을 낼 수 없을 때는 "판단 보류"라고 명확히 결론 내린다.
4. 권고 조치에는 종합 회계 결론을 변경할 수 있는 미해소 질문, 아직 확인되지 않은 사실, 그 사실이 확인되면 결론이 어떻게 달라질 수 있는지, 필요한 자료 또는 후속 조치를 포함한다.
5. 입력에 없는 사실, 계약 조건, 증빙, 금액, 회계기준 근거를 임의로 만들지 않는다.
6. `reviewContext`의 원장 근거·종합 판단·회계사건 추론·감사 이슈·노출금액·산정 근거·수정/조치사항과 질문별 답변을 함께 판단한다. 답변의 날짜·금액·조건·사실이 원본 거래와 모순되는지, 또는 거래 이후의 사실을 과거 회계처리의 정당화 근거로 사용하고 있는지 확인한다. 모순이 있으면 그 답변만으로 현 회계처리 유지를 결론내리지 않는다.

# Additional constraints
- `questionAssessments` is the latest assessment for each question. Treat a question with
  status `RESOLVED` and its saved answer as a confirmed fact unless the saved answers for
  that same question contradict each other.
- Do not repeat, as a recommended action, a fact that a saved answer already states.
- Do not create a new question or a new evidence request outside the supplied `questions`.
- Include a recommended action only for a supplied question that has no saved answer, has a
  `NEEDS_FOLLOW_UP` or `NOT_RESOLVED` assessment, or whose saved answers contradict each other.
- If every supplied question is answered and resolved without contradiction, return an empty
  `recommendedActions` array.

# Output
응답 스키마에 맞는 JSON 객체 하나만 반환하라.
"""

OVERALL_ASSESSMENT_PROMPT += """

# 조정 결론 구체화 규칙
- accountingConclusion의 첫 문장은 conclusionStatus에 맞는 단정적 결론으로 작성한다.
  - MAINTAIN_TREATMENT: 현 회계처리를 유지한다고 명시한다.
  - ADJUSTMENT_REVIEW: 현재 회계처리를 어떤 방식으로 조정해야 하는지 명시한다.
  - ADDITIONAL_EVIDENCE_NEEDED: 현재 자료만으로 조정 분개를 확정할 수 없어 판단을 보류한다고 명시한다.
- conclusionStatus가 ADJUSTMENT_REVIEW이면 accountingConclusion에 다음을 모두 포함한다.
  1) 현재 장부 처리 중 부적정한 인식·측정·분류·기간귀속
  2) 적용해야 할 인식·측정·분류·기간귀속 방식
  3) 입력된 사실만으로 특정할 수 있는 경우 조정 대상 계정과 차변·대변 방향
  4) 조정금액을 확정할 수 없는 경우 금액 산정에 필요한 변수와 산정 방식
- “수정 검토 필요”, “조정 대상”, “확인이 필요하다”만으로 결론을 끝내지 않는다. 무엇을 어떤 기준으로 어떻게 변경해야 하는지 서술한다.
- 입력자료만으로 차변·대변 계정, 조정 금액 또는 측정 변수를 확정할 수 없으면 임의로 만들지 않는다. 이미 확인된 범위의 조정 방향과 확정에 필요한 미확인 변수만 구분해 작성한다.
- accountingConclusion은 핵심 근거와 조정 방식을 포함해 3문장 이내로 작성한다.
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
    question_assessments: dict[str, dict[str, str]], review_context: dict[str, Any],
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
                "reviewContext": review_context,
                "auditIssues": audit_issues,
                "questions": questions,
                "answersByQuestion": answers_by_question,
                "questionAssessments": question_assessments,
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
