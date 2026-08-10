# RAG-AI Only Risk Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and store risks only when an AI response cites retrieved accounting-standard chunks.

**Architecture:** Keep transaction grouping and RAG retrieval. Replace deterministic risk creation with an AI-result gate requiring a cited retrieved chunk. Cross-analysis may be AI input but may not create or overwrite a risk.

**Tech Stack:** FastAPI, Python dataclasses, PostgreSQL vector retrieval, React/Vite.

## Global Constraints

- A risk needs `issueTypes`, `riskSummary`, and at least one cited retrieved chunk.
- No fixed keyword, template, materiality-only, or cross-analysis rule may create a risk.
- RAG/AI failure must not create a generic fallback risk.

---

### Task 1: Require a cited RAG chunk for AI risks

**Files:**
- Modify: `backend/app/services/ai_risk_analysis.py`
- Modify: `backend/tests/test_ai_risk_analysis.py`

- [ ] Write a failing test where `issueTypes` and `riskSummary` exist but `referenceIds` is empty, and assert `risk_from_ai_analysis(...) is None`.
- [ ] Run `python -m pytest backend/tests/test_ai_risk_analysis.py -q` and verify that test fails.
- [ ] Return `None` from `risk_from_ai_analysis` unless at least one requested reference ID is present in retrieved RAG references.
- [ ] Re-run the test and verify it passes.

### Task 2: Disable deterministic risk creation

**Files:**
- Modify: `backend/app/services/orchestrator.py`
- Modify: `backend/app/services/closing_analysis.py`
- Modify: `backend/tests/test_closing_analysis_set.py`

- [ ] Write a failing borrowing-conflict test that asserts a cross-analysis fact alone produces no risk.
- [ ] Run the targeted test and verify failure.
- [ ] Stop calling `analyze_event` as a risk fallback, and stop `_enrich_or_create_cross_risk` from persisting cross-analysis risks.
- [ ] Re-run the targeted test and verify pass.

### Task 3: Verify and deploy

**Files:**
- Test: `backend/tests`
- Test: `frontend`

- [ ] Run `python -m pytest backend/tests -q`.
- [ ] Run `node node_modules/vite/bin/vite.js build` from `frontend`.
- [ ] Stage only intended production and test files, commit, push `main`, then confirm both Vercel deployments are READY.
