from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import settings

KIFRS_EVENT_ANALYSIS_PROMPT = """너는 K-IFRS 시니어 수준의 전문가다.
총계정원장을 전표번호 단위로 분석하되, 동일 전표번호 안의 행만 하나의 거래로 묶어라. 다른 전표번호의 행을 섞거나 거래를 합산하지 마라.
각 거래에서 계정명·계정코드, 적요, 차변·대변, 금액을 대조하여 회계처리를 추론하고, 가능한 분류·인식·측정·표시·공시 쟁점을 먼저 식별하라.
회계사건 추론과 감사리스크 판단은 전표 사실만으로 먼저 완료하라. 제공된 RAG 기준서 청크는 이미 도출된 감사리스크의 근거를 인용하는 데만 사용하고, 청크의 내용이나 다른 전표의 사례로 거래 판단을 바꾸지 마라. 직접 적용되는 청크가 있으면 반드시 referenceIds로 인용하라.
전표만으로 결론을 낼 수 없거나 직접 근거 청크가 없더라도 이슈를 버리지 마라. 오류라고 단정하지 않고, 확인이 필요한 사실을 missingFacts에 구체적으로 적고 담당자 검토 질문과 권장 증빙을 작성하라.
riskSummary는 한국어로 관찰된 거래 사실, 회계처리 가설, 검토 필요 사유, 판단 한계를 구체적으로 서술하라."""


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
                {"role": "system", "content": KIFRS_EVENT_ANALYSIS_PROMPT},
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
                                "issueFirstPolicy": "Identify transaction-specific accounting hypotheses before evaluating citations. When facts indicate a plausible classification, recognition, measurement, presentation, or disclosure issue, keep issueTypes populated and list the specific facts required to confirm or reject it. Do not conclude that an error exists.",
                                "noReferenceBehavior": "When no supplied excerpt directly supports a hypothesis, retain the hypothesis with an empty referenceIds list and explicit missingFacts. The result is a fact-confirmation review, not a standards-based conclusion.",
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
            base_url=self.base_url, api_key=api_key, max_retries=0, timeout=120.0
        )
        completion = client.chat.completions.create(
            model=self.model,
            temperature=0,
            max_tokens=600,
            messages=[
                {"role": "system", "content": KIFRS_EVENT_ANALYSIS_PROMPT},
                {"role": "user", "content": json.dumps({"eventFacts": event_facts, "retrievedReferenceChunks": references, "policy": "Identify transaction-specific accounting hypotheses before evaluating citations. Use the supplied excerpts as the only accounting-standard authority for a conclusion. If no excerpt directly supports a hypothesis, retain issueTypes, leave referenceIds empty, and state the missingFacts required to confirm or reject it. Do not state that an error exists without evidence."}, ensure_ascii=False)},
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
