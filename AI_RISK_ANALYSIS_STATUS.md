# AI Risk Analysis Connection Status

## Implemented

- New non-template Accounting Events are analyzed once per Event Hash, never once per journal row.
- Event facts contain account code/name, debit-credit direction, amount, and journal text.
- Exact prior Event Hashes reuse the prior Risk Memory result and skip the next AI call.
- Template and rule risks run first; AI is the semantic-analysis fallback only.
- AI output is structured JSON and may name only approved knowledge candidates as references.
- Findings without approved citations are stored as `EVIDENCE_ENRICHMENT_REQUIRED` candidates. They do not assert an accounting error.
- API, SDK, network, or invalid-structured-response failures fall back to deterministic human-review routing so Excel import can continue.
- Risk Detail displays a candidate warning and a missing-facts checklist.

## Runtime configuration

The local `.env` now has external AI enabled with `gpt-5-mini`. The API key remains an environment-only secret and is not included in this document.

```dotenv
ARIP_ENABLE_EXTERNAL_AI=true
ARIP_CHAT_MODEL=gpt-5-mini
ARIP_OPENAI_SECRET_REF=env:OPENAI_API_KEY
OPENAI_API_KEY=<your key>
```

## Verification

The focused backend test suite passed locally:

```text
python -m unittest tests.test_ai_risk_analysis
7 tests passed
```

## Current RAG boundary

The current approved-knowledge flow can pass approved document metadata to the AI provider. Paragraph/chunk extraction plus pgvector retrieval is still required before ARIP should represent a package as evidence-backed RAG. Until then, a semantic finding without a verified citation is deliberately displayed as an evidence-enrichment candidate.

## Required local smoke test

After rebuilding the backend, import a new Excel event whose Event Hash has not been seen before, then confirm a candidate appears in **Audit Risk**. The short-vs-long-term borrowing example should generate a review candidate requesting maturity and repayment-schedule evidence.
