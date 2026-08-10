# Risk Review Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Check, Pending, and Pass risk-review decisions with case-based recommendations.

**Architecture:** Persist selections as risk-memory entries, derive current selection from the latest entry, and expose filtered risk APIs. Build recommendations only from prior explicit decisions and transaction similarity.

**Tech Stack:** FastAPI, Python, React, TanStack Query, Material UI.

### Task 1: Decision and recommendation service

- [ ] Write failing tests for default Check, latest stored choice, Pass filtering, and a recommendation from similar explicit history.
- [ ] Implement pure decision/recommendation helpers.
- [ ] Run targeted tests.

### Task 2: Review APIs

- [ ] Add a decision mutation endpoint and filtered review-list endpoint.
- [ ] Return decision and recommendation with risk list/detail responses.
- [ ] Run API behavior tests.

### Task 3: Review UI

- [ ] Rename the Event navigation/page copy to 리스크 검토.
- [ ] Add Check, Pending, Pass controls and recommendation display on risk details.
- [ ] Render Check/Pending risks on the review page and redirect after Pass.
- [ ] Build frontend, run backend suite, deploy, and verify Vercel.
