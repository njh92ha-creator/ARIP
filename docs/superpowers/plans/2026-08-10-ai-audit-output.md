# AI 감사 검토 출력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 감사 프롬프트의 구조화된 결과를 리스크 상세 화면의 감사 검토 항목에 정확히 표시한다.

**Architecture:** 백엔드의 AI 출력 JSON 스키마와 위험 패키지 저장 구조를 확장한다. 전표별 사실 데이터에서 대표 계정·동일 유형 전표 수·원장 요약을 구성하고, 프런트엔드는 새 저장 필드를 기존 상세 영역에 렌더링한다.

**Tech Stack:** Python/FastAPI, dataclasses, unittest, React/TypeScript, MUI.

## Global Constraints

- RAG 검색·임베딩·청크 전달을 결산 AI 분석에 사용하지 않는다.
- K-IFRS 문단·한국회계기준원 질의회신 URL·IFRIC URL은 검증 가능한 값이 없으면 빈 목록으로만 저장한다.
- AI는 오류를 확정하지 않고 검토 필요 사실과 감사 이슈를 구분한다.

---

### Task 1: AI 출력 계약과 위험 저장 확장

**Files:**
- Modify: `backend/app/ai/provider.py`
- Modify: `backend/app/domain/models.py`
- Modify: `backend/app/services/ai_risk_analysis.py`
- Test: `backend/tests/test_ai_risk_analysis.py`

**Interfaces:**
- Produces: `analysis` dictionary with `relatedAccounts`, `voucherCount`, `eventInference`, `auditIssues`, `standardsEvidence`, `ledgerEvidence`.
- Produces: `RiskPackage` fields holding these values for API encoding.

- [ ] **Step 1: Write the failing test**

```python
def test_ai_analysis_persists_structured_audit_output():
    risk = risk_from_ai_analysis(event, None, analysis, [])
    assert risk.package.event_inference == "법인설립 증자"
    assert risk.package.audit_issues == ["자본금과 주식발행초과금 분류 검토"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest backend.tests.test_ai_risk_analysis.AiRiskFactsTest.test_ai_analysis_persists_structured_audit_output -v`

Expected: FAIL because the structured output fields do not exist.

- [ ] **Step 3: Write minimal implementation**

Add strict schema fields and `RiskPackage` storage fields; update `risk_from_ai_analysis` to copy those fields without producing a standard citation.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest backend.tests.test_ai_risk_analysis -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/provider.py backend/app/domain/models.py backend/app/services/ai_risk_analysis.py backend/tests/test_ai_risk_analysis.py
git commit -m "feat: structure AI audit analysis output"
```

### Task 2: 전표 입력과 리스크 상세 화면 매핑

**Files:**
- Modify: `backend/app/services/ai_risk_analysis.py`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/pages/RiskPages.tsx`
- Test: `backend/tests/test_ai_risk_analysis.py`

**Interfaces:**
- Consumes: structured `RiskPackage` saved by Task 1.
- Produces: risk detail UI with AI accounts, voucher count, event inference, audit issues, standards evidence, and ledger evidence.

- [ ] **Step 1: Write the failing test**

```python
def test_build_event_facts_includes_same_type_voucher_count():
    facts = build_event_facts(event, lines, same_type_voucher_count=3)
    assert facts["sameTypeVoucherCount"] == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest backend.tests.test_ai_risk_analysis.AiRiskFactsTest.test_build_event_facts_includes_same_type_voucher_count -v`

Expected: FAIL because the function has no same-type count input.

- [ ] **Step 3: Write minimal implementation**

Pass the same-type voucher count into the AI facts and render persisted structured values in the matching risk detail sections.

- [ ] **Step 4: Run tests and build**

Run: `python -m unittest backend.tests.test_ai_risk_analysis -v`

Run: `npm run build`

Expected: all tests pass and Vite build completes.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai_risk_analysis.py frontend/src/api.ts frontend/src/pages/RiskPages.tsx backend/tests/test_ai_risk_analysis.py
git commit -m "feat: display structured AI audit findings"
```
