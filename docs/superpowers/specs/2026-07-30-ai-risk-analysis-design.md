# AI Risk Analysis Connection Design

## Goal

Connect ARIP's existing OpenAI provider to the accounting-event workflow so it can identify audit-review candidates from the economic meaning of an event, rather than only from preconfigured event templates.

## Decision

AI may create a candidate risk when it detects a meaningful accounting inconsistency, even before an approved accounting reference is available. A candidate without approved references is explicitly labelled `EVIDENCE_ENRICHMENT_REQUIRED`; it is not an accounting-error conclusion and is not an approved Risk Package.

## Processing Flow

1. Cluster journal lines into one Accounting Event.
2. Build a compact event-facts payload: account codes/names, debit-credit direction, counterpart accounts, header/line descriptions, period and amount.
3. Retrieve approved reference candidates. MVP retrieval uses approved in-memory knowledge candidates only; an empty result is allowed.
4. Call the OpenAI analysis provider only for an event that does not resolve to an exact Risk Memory reuse or a deterministic template risk.
5. Validate the structured AI response against `RISK_ANALYSIS_SCHEMA`.
6. If the AI returns approved reference IDs, create a normal AI-assisted Risk Package.
7. If it returns no approved reference IDs but identifies an issue, create a candidate package with `EVIDENCE_ENRICHMENT_REQUIRED` and the AI's stated missing facts.
8. If no issue is identified, persist no Risk.

## Guardrails

- AI never says that a posting is incorrect.
- AI output must state uncertainty and missing facts.
- Candidate risks must use the wording “검토 필요” and never “오류”.
- A normal AI Risk Package may cite only approved references returned by retrieval.
- No journal-line-level API calls: one call per newly-created Accounting Event.
- Exact event-hash reuse does not call the model again.
- An unavailable AI key/model does not fail journal import; existing rule/template processing remains available.

## Example

Input facts include `단기차입금` as the account name and `은행 장기 차입금 차입` as the journal description.

Expected candidate outcome:

- Issue: current/non-current borrowing classification review
- Candidate wording: “차입금의 유동·비유동 분류 적절성 검토 필요”
- Missing facts: maturity date, repayment schedule, covenant status
- Candidate status: `EVIDENCE_ENRICHMENT_REQUIRED` when no approved reference is available

## Scope

This change connects the existing provider and candidate-risk path only. It does not implement embeddings, pgvector retrieval, public-web acquisition, or autonomous accounting conclusions.
