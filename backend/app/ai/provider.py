from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import settings


RISK_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "riskSummary": {"type": "string"},
        "issueTypes": {"type": "array", "items": {"type": "string"}},
        "expectedQuestions": {"type": "array", "items": {"type": "string"}},
        "evidenceChecklist": {"type": "array", "items": {"type": "string"}},
        "responseGuidance": {"type": "array", "items": {"type": "string"}},
        "referenceIds": {"type": "array", "items": {"type": "string"}},
        "missingFacts": {"type": "array", "items": {"type": "string"}},
        "uncertainty": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]},
    },
    "required": [
        "riskSummary",
        "issueTypes",
        "expectedQuestions",
        "evidenceChecklist",
        "responseGuidance",
        "referenceIds",
        "missingFacts",
        "uncertainty",
    ],
}


class AnalysisProvider(Protocol):
    def analyze(self, event_facts: dict[str, Any], references: list[dict[str, Any]]) -> dict[str, Any]:
        ...


class AiUnavailableError(RuntimeError):
    pass


@dataclass(slots=True)
class DisabledProvider:
    reason: str = "external AI is disabled"

    def analyze(self, event_facts: dict[str, Any], references: list[dict[str, Any]]) -> dict[str, Any]:
        raise AiUnavailableError(self.reason)


@dataclass(slots=True)
class OpenAIAnalysisProvider:
    model: str
    api_key_env: str = "OPENAI_API_KEY"
    enabled: bool = True

    def analyze(self, event_facts: dict[str, Any], references: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.enabled:
            raise AiUnavailableError("external AI is disabled")
        api_key = os.getenv(self.api_key_env)
        if not api_key:
            raise AiUnavailableError(f"{self.api_key_env} is not configured")
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=self.model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "당신은 감사 리스크 검토 보조자다. 오류를 확정하지 말고, "
                        "제공된 승인 Reference만 근거로 검토사항을 구조화한다."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "eventFacts": event_facts,
                            "retrievedReferenceChunks": references,
                            "analysisPolicy": {
                                "doNotConcludeError": True,
                                "citeOnlyApprovedReferenceIds": True,
                                "ragOnly": "Use the supplied excerpts as the only accounting-standard authority. Do not cite or apply IFRS knowledge that is absent from the excerpts.",
                                "noReferenceBehavior": "When no supplied excerpt directly supports an issue, return empty issueTypes and referenceIds; do not create a standards-based issue.",
                            },
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "arip_risk_analysis",
                    "strict": True,
                    "schema": RISK_ANALYSIS_SCHEMA,
                }
            },
        )
        parsed = json.loads(response.output_text)
        unknown = set(parsed["referenceIds"]) - {
            str(reference["id"]) for reference in references
        }
        if unknown:
            raise ValueError(f"model returned unapproved references: {sorted(unknown)}")
        return parsed


@dataclass(slots=True)
class NvidiaAnalysisProvider:
    """NVIDIA NIM's OpenAI-compatible Chat Completions integration."""

    model: str
    api_key_env: str = "NVIDIA_API_KEY"
    enabled: bool = True
    base_url: str = "https://integrate.api.nvidia.com/v1"

    def analyze(self, event_facts: dict[str, Any], references: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.enabled:
            raise AiUnavailableError("external AI is disabled")
        api_key = os.getenv(self.api_key_env)
        if not api_key:
            raise AiUnavailableError(f"{self.api_key_env} is not configured")
        from openai import OpenAI

        # NIM prototype endpoints can queue.  Keep an individual event bounded so
        # one slow model response cannot exhaust Vercel's function duration.
        client = OpenAI(
            base_url=self.base_url, api_key=api_key, max_retries=0, timeout=25.0
        )
        completion = client.chat.completions.create(
            model=self.model,
            temperature=0,
            max_tokens=600,
            messages=[
                {"role": "system", "content": """당신은 한국어 회계감사 보조자입니다. 반드시 제공된 전표의 적요, 계정명·코드, 차변/대변, 금액 및 교차분석 사실을 서로 대조해 질적 검토 의견을 작성하십시오. 특히 적요의 거래 성격(예: 장기차입금)과 분개 계정의 분류(예: 단기차입금)가 상충하면, 두 사실을 명시하고 분류 적정성 검토가 필요하다고 설명하십시오. 오류나 재무제표 왜곡을 단정하지 말고, 결론을 위해 필요한 계약 만기·상환청구권·차환약정 등의 구체적 증빙을 제시하십시오. 원장-정산표 대사 차이는 실제로 제공된 교차분석 사실이 있을 때만 언급하십시오. riskSummary는 반드시 한국어로 '관찰된 사실 / 검토 의견 / 판단 한계'를 포함한 3~5문장으로 작성하십시오. 일반적·추상적 경고 문구를 쓰지 마십시오. Return only valid JSON matching this schema: """ + json.dumps(RISK_ANALYSIS_SCHEMA, ensure_ascii=False)},
                {"role": "user", "content": json.dumps({"eventFacts": event_facts, "retrievedReferenceChunks": references, "policy": "Use the supplied excerpts as the only accounting-standard authority. Cite only supplied chunk IDs and locate the opinion in the cited excerpt. If none directly applies, return empty issueTypes and referenceIds; do not infer a standards-based issue from model knowledge."}, ensure_ascii=False)},
            ],
        )
        content = completion.choices[0].message.content or ""
        if content.startswith("```"):
            content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        parsed = json.loads(content)
        unknown = set(parsed["referenceIds"]) - {str(reference["id"]) for reference in references}
        if unknown:
            raise ValueError(f"model returned unapproved references: {sorted(unknown)}")
        return parsed


def provider_from_settings(
    *, enabled: bool | None = None, chat_model: str | None = None,
    provider: str = "openai", api_key_env: str | None = None,
) -> AnalysisProvider:
    enabled = settings.enable_external_ai if enabled is None else enabled
    model = chat_model or settings.chat_model
    if not enabled:
        return DisabledProvider()
    if not model:
        return DisabledProvider("chat model is not configured")
    if provider.lower() == "nvidia":
        return NvidiaAnalysisProvider(model=model, api_key_env=api_key_env or "NVIDIA_API_KEY", enabled=enabled)
    return OpenAIAnalysisProvider(model=model, api_key_env=api_key_env or "OPENAI_API_KEY", enabled=enabled)
