from __future__ import annotations

import json
import os
import re


_PROMPT = """입력된 회계감사 이슈와 권장 증빙을 리스크 검토 화면용으로 요약하라.
- 원문에 없는 사실·판단·증빙을 추가하지 말고 의미를 바꾸지 마라.
- auditIssues는 각 항목을 60자 이내의 한 문장으로, 최대 3개로 정리한다.
- evidenceChecklist는 각 항목을 40자 이내의 간결한 증빙명으로, 최대 5개로 정리한다.
- JSON 객체 하나만 반환하라.
"""

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "auditIssues": {"type": "array", "items": {"type": "string"}},
        "evidenceChecklist": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["auditIssues", "evidenceChecklist"],
}


def _brief(items: list[str], *, limit: int, width: int) -> list[str]:
    result: list[str] = []
    for item in items:
        original = str(item).strip()
        text = re.sub(r"\s+", " ", original)
        if not text:
            continue
        text = text[:width].rstrip()
        if len(original) > len(text):
            text = f"{text.rstrip(' ,;')}…"
        result.append(text)
        if len(result) == limit:
            break
    return result


def summarize_for_review_transfer(
    *, audit_issues: list[str], evidence_checklist: list[str], model: str,
    api_key_env: str | None, enabled: bool, provider: str,
) -> dict[str, list[str]]:
    """Summarize only the review-case copy; source risk text is never changed."""
    fallback = {
        "auditIssues": _brief(audit_issues, limit=3, width=60),
        "evidenceChecklist": _brief(evidence_checklist, limit=5, width=40),
    }
    if not enabled or provider.lower() != "openai":
        return fallback
    api_key = os.getenv(api_key_env or "OPENAI_API_KEY")
    if not api_key:
        return fallback
    try:
        from openai import OpenAI

        response = OpenAI(api_key=api_key).responses.create(
            model=model,
            input=[
                {"role": "system", "content": _PROMPT},
                {"role": "user", "content": json.dumps({
                    "auditIssues": audit_issues,
                    "evidenceChecklist": evidence_checklist,
                }, ensure_ascii=False)},
            ],
            text={"format": {"type": "json_schema", "name": "arip_review_transfer_summary", "strict": True, "schema": _SCHEMA}},
        )
        parsed = json.loads(response.output_text)
        return {
            "auditIssues": [str(item).strip() for item in parsed["auditIssues"] if str(item).strip()][:3],
            "evidenceChecklist": [str(item).strip() for item in parsed["evidenceChecklist"] if str(item).strip()][:5],
        }
    except Exception:
        return fallback
