# Risk Review Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transfer a reviewer-classified risk into an independent review case, where responses and evidence can be managed without altering the original analysis.

**Architecture:** `Risk` remains source-analysis data. A new `RiskReviewCase` copies the source package and retains the same `risk_code`; answers and attachments belong to that case. A source risk gets a transfer memory record and is then excluded from risk-management queries.

**Tech Stack:** FastAPI, Python dataclasses, Supabase-backed generic state persistence, React, TypeScript, MUI, TanStack Query.

## Global Constraints

- User-facing IDs use `Risk.risk_code` only.
- Transfer needs explicit Check/Pending plus High/Medium/Low values. Pass cannot transfer.
- Snapshot the source analysis at transfer time.
- Attachments are limited to 10 per review case.

### Task 1: Add persisted review-case domain records

**Files:** `backend/app/domain/models.py`, `backend/app/domain/repository.py`, `backend/tests/test_risk_review_transfer.py`

- [ ] Write a failing test that creates a review case from a risk and asserts its risk code and copied package content match the source.
- [ ] Run the test and confirm it fails because the review-case model does not exist.
- [ ] Add `RiskReviewCase`, `RiskReviewAnswer`, and `RiskReviewAttachment`; add repository collections, legacy hydration, save/load maps, company deletion, idempotent source lookup, answer upsert, and attachment add/remove methods.
- [ ] Reject the eleventh attachment with `ValueError` and test it.
- [ ] Run the test to green and commit `feat: persist transferred risk review cases`.

### Task 2: Add transfer and review APIs

**Files:** `backend/app/api/schemas.py`, `backend/app/api/router.py`, `backend/app/services/risk_review.py`, `backend/tests/test_risk_review_transfer.py`

- [ ] Write failing API tests for: 422 without explicit decision/severity; successful idempotent transfer; source omission from `/risks`, `/settings/risk-management`, and list; answer save; decision/severity change; attachment upload/delete; and 10-file rejection.
- [ ] Run the tests and confirm the routes fail as absent.
- [ ] Add `POST /risks/{risk_id}/transfer-to-review`; append `RISK_TRANSFERRED` to source memory. Add review list/detail, answer update, attachment add/delete/download, and review decision/severity update routes.
- [ ] Change list visibility so transferred sources and Pass sources are absent.
- [ ] Run the API tests to green and commit `feat: add transferred risk review APIs`.

### Task 3: Add the risk-management transfer action

**Files:** `frontend/src/api.ts`, `frontend/src/components/RiskReviewDecisionCard.tsx`, `frontend/src/pages/RiskPages.tsx`

- [ ] Write a failing component test that requires explicit Check/Pending and explicit severity before enabling `이관`.
- [ ] Add API interfaces and an `이관` action. On success invalidate risks, risk reviews, and risk-management queries, then open the new review case.
- [ ] Keep the existing Pass hiding behavior.
- [ ] Run the component test and `npm run build`; commit `feat: add risk transfer control`.

### Task 4: Replace the risk-review UI with review cases

**Files:** `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/pages/RiskReviewPage.tsx`, `frontend/src/pages/RiskReviewDetailPage.tsx`

- [ ] Write failing UI tests for case listing with risk code instead of UUID, question-answer save, and attachment counter.
- [ ] Make `/events` list only transferred review cases and create a detail route for a case.
- [ ] Show immutable copied analysis and allow per-question answers, severity/decision changes with immediate mutation, attachment upload/download/delete, and `n / 10` count.
- [ ] Run UI tests and `npm run build`; commit `feat: manage transferred risks in review workspace`.

### Task 5: Verify and deploy

- [ ] Run the full backend suite: `$env:PYTHONPATH='.'; & 'C:\\Users\\POSCOFUTUREM\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe' -m unittest discover -s tests -v`.
- [ ] Run `npm run build` in `frontend`.
- [ ] Verify transfer, source-list removal, stable risk code, answer persistence, immediate severity/decision change, and the 10-file cap through the deployed API.
