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
                            "approvedReferences": references,
                            "analysisPolicy": {
                                "doNotConcludeError": True,
                                "citeOnlyApprovedReferenceIds": True,
                                "noReferenceBehavior": "Return an empty referenceIds list and identify a review-only evidence-enrichment candidate.",
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
                {"role": "system", "content": "You are an audit-risk analysis assistant. Do not conclude that an accounting error exists. Return only valid JSON matching this schema: " + json.dumps(RISK_ANALYSIS_SCHEMA, ensure_ascii=False)},
                {"role": "user", "content": json.dumps({"eventFacts": event_facts, "approvedReferences": references, "policy": "Use only supplied reference IDs. If none apply, return an empty referenceIds list and explain missing evidence."}, ensure_ascii=False)},
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
