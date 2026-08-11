from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import settings

KIFRS_EVENT_ANALYSIS_PROMPT = """# Role
너는 K-IFRS 시니어 수준의 회계 전문가다.

# Request
회계 감사인으로써, 감사 이슈를 도출하라.
총계정원장을 전표번호 단위로 분석하되, 동일 전표번호 안의 행만 하나의 거래로 묶어라. 다른 전표번호의 행을 섞거나 거래를 합산하지 마라.
eventFacts.materialityVariances는 정산표에서 절대 증감액이 수행중요성을 초과하여 분석 대상으로 선별된 계정의 당기, 전기, 증감액 정보다. 이 계정이 포함된 전표만 분석하며, 선정 사유 자체를 오류로 단정하지 마라.

# Output
결과물은 다음과 같이 도출한다.
1. 관련 계정
   - 해당 회계처리의 대표 계정을 relatedAccounts에 작성한다.
2. 원장 전표 수
   - eventFacts.sameTypeVoucherCount 값을 voucherCount에 그대로 작성한다.
3. 분석 결과
   - eventInference에 회계전표의 금액, 전표 일자, 적요, 계정 등을 고려하여 추론한 회계사건을 작성한다.
   - auditIssues에 추론된 회계사건으로 예상되는 회계감사 이슈사항을 작성한다.
   - riskSummary에는 회계사건 추론, 회계감사 이슈, 검토 필요 사유와 판단 한계를 한국어로 모두 서술한다.
4. 검토질문
   - expectedQuestions에 분석 결과의 회계감사 이슈사항을 해소하기 위해 사용자가 확인해야 할 사항을 질문으로 작성한다.
5. 권장 증빙
   - evidenceChecklist에 검토질문의 근거를 확인할 수 있는 적격 증빙을 작성한다.
6. 기준서 검색 근거
   - standardsEvidence에 분석 결과의 회계감사 이슈 도출에 사용된 근거만 작성한다.
   - K-IFRS 근거에는 문단 번호와 본문 내용을 포함한다.
   - 한국회계기준원 정규 질의 문답과 IFRIC 근거에는 URL을 포함한다.
7. 원장근거
   - ledgerEvidence에 eventFacts.journalLines의 해당 회계전표 내역만 요약 표시한다. 입력에 없는 전표 사실을 추가하지 마라.

# 제한 사항
- 근거로써 확인되는 K-IFRS는 임의 생성할 수 없다.
- 근거로써 확인되는 한국회계기준원 정규 질의 문답 및 URL은 임의 생성할 수 없다.
- 근거로써 확인되는 IFRIC 및 URL은 임의 생성할 수 없다.
- 확인할 수 없는 기준서·질의문답·IFRIC 근거는 standardsEvidence에 넣지 마라.
- 오류를 확정하지 말고, 전표만으로 판단할 수 없는 사실은 missingFacts에 구체적으로 작성하라.
- 마크다운, 코드 펜스, 설명문을 덧붙이지 말고 응답 스키마에 맞는 JSON 객체 하나만 반환하라."""


RISK_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "riskSummary": {"type": "string"},
        "issueTypes": {"type": "array", "items": {"type": "string"}},
        "relatedAccounts": {"type": "array", "items": {"type": "string"}},
        "voucherCount": {"type": "integer", "minimum": 0},
        "eventInference": {"type": "string"},
        "auditIssues": {"type": "array", "items": {"type": "string"}},
        "expectedQuestions": {"type": "array", "items": {"type": "string"}},
        "evidenceChecklist": {"type": "array", "items": {"type": "string"}},
        "responseGuidance": {"type": "array", "items": {"type": "string"}},
        "referenceIds": {"type": "array", "items": {"type": "string"}},
        "missingFacts": {"type": "array", "items": {"type": "string"}},
        "uncertainty": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]},
        "standardsEvidence": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "source": {"type": "string", "enum": ["K-IFRS", "KASB_QA", "IFRIC"]},
                    "title": {"type": "string"},
                    "paragraph": {"type": "string"},
                    "excerpt": {"type": "string"},
                    "url": {"type": "string"},
                },
                "required": ["source", "title", "paragraph", "excerpt", "url"],
            },
        },
        "ledgerEvidence": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "documentNumber": {"type": "string"},
                    "postingDate": {"type": "string"},
                    "accountName": {"type": "string"},
                    "debitCredit": {"type": "string"},
                    "amount": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["documentNumber", "postingDate", "accountName", "debitCredit", "amount", "description"],
            },
        },
    },
    "required": [
        "riskSummary",
        "issueTypes",
        "relatedAccounts",
        "voucherCount",
        "eventInference",
        "auditIssues",
        "expectedQuestions",
        "evidenceChecklist",
        "responseGuidance",
        "referenceIds",
        "missingFacts",
        "uncertainty",
        "standardsEvidence",
        "ledgerEvidence",
    ],
}


class AnalysisProvider(Protocol):
    def analyze(self, event_facts: dict[str, Any], references: list[dict[str, Any]]) -> dict[str, Any]:
        ...


class AiUnavailableError(RuntimeError):
    pass


def parse_nvidia_json(content: str) -> dict[str, Any]:
    """Extract the single JSON object from a NIM response without accepting prose."""
    candidate = content.strip()
    if candidate.startswith("```"):
        candidate = candidate.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    start, end = candidate.find("{"), candidate.rfind("}")
    if start < 0 or end < start:
        raise ValueError("NVIDIA response does not contain a JSON object")
    return json.loads(candidate[start : end + 1])


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
                    "role": "user",
                    "content": json.dumps(
                        {
                            "eventFacts": event_facts,
                            "retrievedReferenceChunks": references,
                            "analysisPolicy": {
                                "doNotConcludeError": True,
                                "issueFirstPolicy": "Follow the Korean system prompt. Analyze transaction-specific accounting hypotheses from the transaction facts. Do not conclude that an error exists; list facts required to confirm or reject each hypothesis.",
                                "referenceIdsBehavior": "RAG retrieval is disabled for this analysis. Return an empty referenceIds array.",
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
                {"role": "user", "content": json.dumps({"eventFacts": event_facts, "policy": "Follow the Korean system prompt. RAG retrieval is disabled; return an empty referenceIds array. Do not state that an error exists without evidence, and identify missingFacts, review questions, recommended evidence, and only non-fabricated standards evidence."}, ensure_ascii=False)},
            ],
        )
        content = completion.choices[0].message.content or ""
        parsed = parse_nvidia_json(content)
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
