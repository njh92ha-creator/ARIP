from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import settings

KIFRS_EVENT_ANALYSIS_PROMPT = """# Role
너는 K-IFRS 시니어 수준의 회계 전문가다.

# Request
회계 감사인으로서 총계정원장을 전표번호 단위로 검토하라.
동일 전표번호 안의 행만 하나의 거래로 묶어 분석한다. 다른 전표번호의 행을 섞거나 거래를 합산하지 마라.

# 회계처리 검토 절차
1. 동일 전표번호의 원장 행만 사용하여 실제 거래 또는 회계사건을 추론한다.
2. 추론한 거래와 실제 분개를 비교한다. 적요가 의미하는 거래 내용, 차변 및 대변 계정의 성격, 차변 및 대변 금액의 대응 관계, 전표일자와 인식시점, 계정 분류와 표시 방식을 검토한다.
3. 거래 성격과 계정 분류의 불일치, 자산·부채·자본·수익·비용의 인식 또는 제거, 금액 측정 또는 원가 구성, 인식 시점 또는 기간 귀속, 표시·공시 또는 상계 처리 중 하나가 전표 사실에서 구체적으로 확인되거나 추가 확인 없이는 회계처리 결론이 달라질 때만 회계감사 이슈로 판단한다.
4. 단순히 거래 금액·계정 잔액이 크거나 일반적인 감사절차가 필요하다는 이유만으로 이슈를 만들지 마라.
5. 적요, 계정, 차대변 및 금액의 관계가 통상적인 거래와 일관되고 구체적인 불일치·오류 가능성·결론에 영향을 주는 누락 사실을 제시할 수 없으면 NO_ACTION으로 판단하라.
6. 전표만으로 알 수 없는 사실을 이유로 이슈를 만들 때에는, 그 사실이 없으면 어떤 회계처리 결론을 판단할 수 없는지를 구체적으로 설명할 수 있을 때만 허용한다.

# Output
결과물은 다음과 같이 도출한다.
1. 사전 판단
   - triageDecision에는 NO_ACTION, REVIEW_REQUIRED, INSUFFICIENT_FACTS 중 하나를 작성한다.
   - NO_ACTION: 정상적·통상적 거래로 보이며 추가 검토가 필요한 구체적 회계 쟁점이 없음.
   - REVIEW_REQUIRED: 회계처리 오류, 분류 오류, 인식시점 오류, 측정 오류, 표시·공시 오류 또는 금액 대응이 필요한 구체적 쟁점이 있음.
   - INSUFFICIENT_FACTS: 전표만으로 결론을 확정할 수 없고 확인이 필요한 사실이 회계처리 결론을 바꿀 구체적 가능성이 있음.
   - triageReason에는 해당 판단의 구체적 이유를 작성한다.
   - NO_ACTION이면 riskSummary와 eventInference는 빈 문자열로, issueTypes, auditIssues, expectedQuestions, evidenceChecklist, standardsEvidence, missingFacts, ledgerEvidence는 빈 배열로 작성한다.
2. 관련 계정
   - 해당 회계처리의 대표 계정을 relatedAccounts에 작성한다.
3. 원장 전표 수
   - eventFacts.sameTypeVoucherCount 값을 voucherCount에 그대로 작성한다.
4. 분석 결과
   - REVIEW_REQUIRED 또는 INSUFFICIENT_FACTS인 경우에만 작성한다.
   - eventInference에 회계전표의 금액, 전표 일자, 적요, 계정 등을 고려하여 추론한 회계사건을 작성한다.
   - auditIssues에 해당 회계사건에서 확인된 구체적인 회계감사 이슈사항을 작성한다.
   - riskSummary에는 회계사건 추론, 회계감사 이슈 및 검토 필요 사유를 한국어로 서술한다.
5. 검토질문
   - REVIEW_REQUIRED 또는 INSUFFICIENT_FACTS인 경우에만 expectedQuestions에 회계감사 이슈를 해소하기 위해 사용자가 확인해야 할 사항을 질문으로 작성한다.
6. 권장 증빙
   - REVIEW_REQUIRED 또는 INSUFFICIENT_FACTS인 경우에만 evidenceChecklist에 검토질문의 근거를 확인할 수 있는 적격 증빙을 작성한다.
7. 기준서 검색 근거
   - REVIEW_REQUIRED 또는 INSUFFICIENT_FACTS인 경우에만 standardsEvidence에 회계감사 이슈 도출에 사용된 근거를 작성한다.
   - K-IFRS 근거에는 문단 번호와 본문 내용을 포함한다.
   - 한국회계기준원 정규 질의 문답과 IFRIC 근거에는 URL을 포함한다.
8. 원장근거
   - REVIEW_REQUIRED 또는 INSUFFICIENT_FACTS인 경우에만 ledgerEvidence에 eventFacts.journalLines의 해당 회계전표 내역을 요약 표시한다. 입력에 없는 전표 사실을 추가하지 마라.

# 제한 사항
- 거래가 발생했다는 사실만으로 리스크를 생성하지 마라.
- 금액이 크다는 사실만으로 리스크를 생성하지 마라.
- 정상적인 유상증자, 자본금 납입 등 통상적 거래는 전표 사실상 구체적인 회계 쟁점이 없으면 NO_ACTION으로 판단하라.
- 근거로써 확인되는 K-IFRS는 임의 생성할 수 없다.
- 근거로써 확인되는 한국회계기준원 정규 질의 문답 및 URL은 임의 생성할 수 없다.
- 근거로써 확인되는 IFRIC 및 URL은 임의 생성할 수 없다.
- 확인할 수 없는 기준서·질의문답·IFRIC 근거는 standardsEvidence에 넣지 마라.
- 오류를 확정하지 마라.
- 마크다운, 코드 펜스, 설명문을 덧붙이지 말고 응답 스키마에 맞는 JSON 객체 하나만 반환하라."""


RISK_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "triageDecision": {"type": "string", "enum": ["NO_ACTION", "REVIEW_REQUIRED", "INSUFFICIENT_FACTS"]},
        "triageReason": {"type": "string"},
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
        "triageDecision",
        "triageReason",
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
