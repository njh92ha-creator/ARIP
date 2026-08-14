from __future__ import annotations

import json
import os


_COMPACTION_PROMPT = """너는 회계감사 검토 결과를 간결하게 편집하는 역할이다.

입력된 세 목록의 사실·의미·범위를 바꾸거나 새로운 사실을 추가하지 말고, 각 항목을 짧은 업무용 문구로만 다시 작성하라.
- 회계감사 이슈: 항목당 70자 이내의 한 문장, 최대 3개.
- 권장 증빙: 항목당 45자 이내의 증빙명 또는 짧은 구문, 최대 5개.
- 누락 사실: 항목당 35자 이내의 확인 필요 사실 또는 조건, 최대 5개.
- 서로 중복되는 항목은 하나로 합친다.
- 입력 목록이 비어 있으면 빈 배열을 유지한다.
- 마크다운 없이 JSON 객체 하나만 반환하라.
"""

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "auditIssues": {"type": "array", "items": {"type": "string"}},
        "evidenceChecklist": {"type": "array", "items": {"type": "string"}},
        "missingFacts": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["auditIssues", "evidenceChecklist", "missingFacts"],
}


def compact_risk_text(
    *, audit_issues: list[str], evidence_checklist: list[str], missing_facts: list[str],
    model: str, api_key_env: str | None, enabled: bool, provider: str,
) -> dict[str, list[str]]:
    """Create one persisted concise version of the existing risk lists."""
    if not any((audit_issues, evidence_checklist, missing_facts)):
        return {"auditIssues": [], "evidenceChecklist": [], "missingFacts": []}
    if not enabled:
        raise RuntimeError("AI summarization is disabled")
    if provider.lower() != "openai":
        raise RuntimeError("legacy risk text compaction currently requires OpenAI")

    api_key = os.getenv(api_key_env or "OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    from openai import OpenAI

    response = OpenAI(api_key=api_key).responses.create(
        model=model,
        input=[
            {"role": "system", "content": _COMPACTION_PROMPT},
            {"role": "user", "content": json.dumps({
                "auditIssues": audit_issues,
                "evidenceChecklist": evidence_checklist,
                "missingFacts": missing_facts,
            }, ensure_ascii=False)},
        ],
        text={"format": {"type": "json_schema", "name": "arip_risk_text_compaction", "strict": True, "schema": _SCHEMA}},
    )
    parsed = json.loads(response.output_text)
    return {
        "auditIssues": [str(item).strip() for item in parsed["auditIssues"] if str(item).strip()],
        "evidenceChecklist": [str(item).strip() for item in parsed["evidenceChecklist"] if str(item).strip()],
        "missingFacts": [str(item).strip() for item in parsed["missingFacts"] if str(item).strip()],
    }
