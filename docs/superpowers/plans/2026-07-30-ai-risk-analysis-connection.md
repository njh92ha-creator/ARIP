# AI Risk Analysis Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ARIP generate evidence-backed AI Risk Packages and evidence-enrichment candidates from newly created accounting events.

**Architecture:** Existing deterministic templates stay first. New events not resolved by those templates go to an event-facts builder, approved-reference retrieval, and the existing OpenAI structured-output provider. An AI result with approved citations becomes a supported Risk; a result without citations becomes a review-only candidate.

**Tech Stack:** Python 3.12, FastAPI, OpenAI Responses API, Pydantic-compatible JSON schema, existing PostgreSQL-backed compatibility repository, React TypeScript.

## Global Constraints

- One AI call per new Accounting Event, never per journal line.
- No accounting error conclusion or automatic journal update.
- API keys remain environment-only.
- Only approved knowledge candidates may be sent as reference context.
- Import must succeed when AI is unavailable.

---

### Task 1: Add an AI candidate package state

**Files:**
- Modify: `backend/app/domain/models.py`
- Test: `backend/tests/test_ai_risk_analysis.py`

**Interfaces:**
- Produces `RiskPackage.missing_facts: list[str]` and `RiskPackage.evidence_status: str`.

- [ ] Write a failing test asserting an AI candidate package records `EVIDENCE_ENRICHMENT_REQUIRED` and its missing facts.
- [ ] Run the test and verify it fails because those fields do not exist.
- [ ] Add defaulted fields to `RiskPackage` so existing rule templates remain compatible.
- [ ] Run the test and verify it passes.

### Task 2: Build event facts and safe approved-reference retrieval

**Files:**
- Create: `backend/app/services/ai_risk_analysis.py`
- Test: `backend/tests/test_ai_risk_analysis.py`

**Interfaces:**
- Produces `build_event_facts(event, lines) -> dict`.
- Produces `approved_reference_context(company_id, candidates) -> list[dict]`.

- [ ] Write failing tests that facts include account names, counterpart accounts, descriptions and amount, and that pending candidates are excluded.
- [ ] Run the tests and verify expected failures.
- [ ] Implement compact facts and metadata-only approved-reference context.
- [ ] Run the tests and verify they pass.

### Task 3: Convert structured AI output into Risk candidates

**Files:**
- Modify: `backend/app/services/ai_risk_analysis.py`
- Test: `backend/tests/test_ai_risk_analysis.py`

**Interfaces:**
- Produces `risk_from_ai_analysis(event, materiality, analysis) -> Risk | None`.

- [ ] Write a failing test using a `단기차입금` / `장기 차입금 차입` analysis response and assert review wording, route `RAG_LLM`, and evidence-enrichment status.
- [ ] Implement deterministic conversion and score/level handling.
- [ ] Run the test and verify it passes.

### Task 4: Connect provider invocation to journal orchestration

**Files:**
- Modify: `backend/app/services/orchestrator.py`
- Modify: `backend/app/services/risk_engine.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_ai_risk_analysis.py`

**Interfaces:**
- `process_journals(..., knowledge_candidates: dict[str, dict] | None = None)` invokes AI only for non-template, new events.

- [ ] Write failing tests using a fake analysis provider that returns a candidate response, and a reuse test asserting no second provider call.
- [ ] Change rule processing so non-template events defer to AI when external AI is enabled.
- [ ] Call `provider_from_settings()` only after event hash reuse and template checks.
- [ ] Catch `AiUnavailableError` and preserve manual-review behavior.
- [ ] Pass knowledge candidates through synchronous and background import routes.
- [ ] Run focused tests and verify they pass.

### Task 5: Surface candidate status in the Risk detail screen

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/pages/RiskPages.tsx`

- [ ] Display an explicit “근거보강 필요” warning and missing-facts list for AI candidate packages.
- [ ] Preserve the existing normal reference display for supported packages.
- [ ] Build the frontend and verify TypeScript compilation succeeds.

### Task 6: Verify the vertical slice

**Files:**
- Modify: `IMPLEMENTATION_STATUS.md`

- [ ] Run backend unit tests inside the backend container.
- [ ] Rebuild backend and frontend services.
- [ ] Import the sample ledger with AI configured and verify the borrowing-classification candidate reaches `/risks`.
- [ ] Record commands and observed outcome in `IMPLEMENTATION_STATUS.md`.
