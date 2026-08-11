# Risk Review Transfer Final Fix Report

**Date:** 2026-08-11

**Reviewed baseline:** `7ce0216`

**Implementation commits:**

- `baed83f` — `fix: harden risk review transfers`
- `619ec09` — `fix: bind review scope to server principal`
- `bb947dc` — `fix: scope source risk review workflow`

**Branch:** `codex/design-system-refactor`

## Outcome

All six findings in `final-review.md` and both subsequent P1 re-review findings are corrected. This includes eliminating caller-controlled review scope from both transferred cases and the source-risk prerequisite workflow. Backend and frontend suites and the TypeScript/Vite production build pass. Unrelated `.gitignore` and older plan-file changes in the worktree were not staged or modified by this fix wave.

## Finding 1 — Tenant-scoped review authorization and list exposure (P1)

### Correction

- Review authorization no longer uses `X-ARIP-Company-ID`, `X-ARIP-User`, or `X-ARIP-Role`. Those demo browser headers cannot select the review principal, role, or tenant.
- Review routes resolve a server-owned principal from `ARIP_AUTHENTICATED_PRINCIPAL` and its ordered company allow-list from `ARIP_USER_COMPANY_SCOPES`. The first configured company is the server-selected active company. Missing principal or missing company scope fails closed; malformed server configuration returns HTTP 503.
- `.env.example` documents both server-only settings. This explicit configuration is the current local/admin adapter and can be replaced by a verified OIDC/SSO principal without changing route authorization semantics.
- `/auth/me` returns the server-selected `companyId` and authorized `companyIds` for the verified review principal.
- The review list, transfer, detail, answer, decision, severity, attachment upload/download/delete routes all require an allowed review role and verify the resolved source/case company against the server-selected company.
- `VIEWER` is an established role but is excluded from every review route.
- The review list returns summary fields only. It omits packages, answers, attachment metadata, source IDs, and internal review UUIDs.
- The frontend loads `/auth/me`, selects the exact matching authorized company, and fails closed if it is missing. It no longer uses `companies[0]` and sends no tenant-authorization header.
- Source-risk list, risk-management list, source detail, source review-decision, and source severity routes now use the same server-owned principal and company check before reading or mutating a risk.
- `RiskListPage` loads `/auth/me`, matches the server-selected company rather than `companies[0]`, and queries `/risks` only with that authorized company ID.

### Regression coverage

- `test_review_case_routes_require_an_established_role`
- `test_review_list_rejects_viewers_and_principals_without_a_company_scope`
- `test_review_routes_deny_cross_company_read_write_transfer_and_download`
- `test_auth_me_returns_server_authorized_company_scopes`
- `test_review_list_returns_only_summary_fields`
- `AuthenticatedCompanyScope.test.mjs`
- `RiskReviewWorkspace.test.mjs`
- `test_source_risk_queries_and_review_prerequisites_reject_forged_company_scope`
- `AnalysisOutput.test.mjs` (`risk list uses the server-authorized company instead of the first company`)

The cross-company test creates data under a different server-selected principal, switches back to the first principal, then forges all three `X-ARIP-*` headers for the other tenant. List, transfer, detail, answer, decision, severity, upload, download, and delete all return HTTP 403. The frontend runtime test proves an authorized second company is selected when an unauthorized company is first in the companies response.

Follow-up RED run before server-principal enforcement: `2 failed, 2 passed, 29 deselected`. Focused GREEN run after enforcement: `4 passed, 29 deselected`.

Final re-review RED evidence: the source-risk scope regression failed because forged headers returned HTTP 200 and changed both source risks; the RiskListPage contract test failed because `/auth/me` was absent and `companies[0]` remained. Focused GREEN results: backend `1 passed, 33 deselected`; frontend `3 passed, 0 failed`. The backend regression asserts HTTP 403 for source list, risk-management list, source detail, decision, and severity, and verifies row versions, severity, and memory are unchanged.

## Finding 2 — Durable transfer idempotency and shared review invariants (P1)

### Correction

- Added a database-backed transfer claim in generic `arip_state`, keyed by the source risk UUID as `RiskReviewTransfer`. The existing primary key provides atomic uniqueness across processes and server instances.
- The review case, source transfer memory marker, audit entry, and business-code index are persisted in one transaction. Partial failure rolls back the entire transfer.
- The durable transfer marker contains the canonical case/memory/audit relationship; stale instances consult this marker before exposing source risks.
- Added `RiskReviewCaseByCode` atomic uniqueness, including collision detection against legacy persisted cases.
- Review writes fail closed when persistence is configured but unavailable; database errors are no longer acknowledged as memory-only success.
- Answer IDs are deterministic for `(review_case_id, question)` and persisted with upsert behavior.
- Decision and severity use independent atomic state rows, preventing stale snapshots from overwriting the other control.
- Ten database-backed attachment-slot claims enforce the shared attachment cap; delete releases the slot transactionally.
- Review reads refresh case, answer, decision, severity, and attachment state from shared storage.

### Regression coverage

- `test_persistent_multi_instance_transfer_creates_one_atomic_case_and_marker`
- `test_persistent_transfer_rolls_back_marker_case_and_audit_on_partial_failure`
- `test_review_writes_fail_closed_when_configured_persistence_is_unavailable`
- `test_persistent_review_mutations_share_answer_fields_and_attachment_cap`
- `test_persistent_transfer_rejects_a_legacy_case_with_the_same_business_code`
- Existing in-process concurrency and idempotency tests remain green.

The persistent tests use separate repository instances/connections over one state database and exercise multi-instance races and transaction rollback.

## Finding 3 — Non-Latin attachment filenames (P1)

### Correction

- Added a safe `Content-Disposition` builder with a sanitized ASCII fallback.
- Path characters, quotes, semicolons, backslashes, and control characters are neutralized in the fallback.
- The original normalized name is emitted using RFC 5987 `filename*=UTF-8''...` encoding, supporting Korean and other non-Latin names without Starlette's Latin-1 header failure.

### Regression coverage

- `test_attachment_download_uses_an_ascii_safe_rfc5987_filename` covers Korean/non-Latin text, spaces, quotes, and CR/LF control characters.

Initial RED run: three failures, including HTTP 500 for the Korean filename. Targeted GREEN run: three passed.

## Finding 4 — Default list includes PASS cases (P2)

### Correction

- The default backend review-list query omits `review_decision == "PASS"`.
- Authorized direct detail access remains available for PASS cases.

### Regression coverage

- `test_default_review_list_hides_pass_cases_but_detail_remains_available`

Initial RED run returned the PASS case. GREEN run returned an empty list while detail returned HTTP 200.

## Finding 5 — Snapshot ledger evidence and legacy references omitted (P2)

### Correction

- Added `RiskReviewSnapshotEvidence` to render copied ledger evidence as a read-only table.
- Structured `standards_evidence` is rendered when present.
- Legacy `package.references` is rendered as the fallback standards basis when structured evidence is empty.
- All evidence remains inside the immutable transfer snapshot card.

### Regression coverage

- `RiskReviewSnapshotEvidence.test.mjs` compiles the real TSX component, server-renders non-empty ledger evidence and a legacy K-IFRS reference, and asserts the visible document number, account, description, title, and link.

## Finding 6 — Business risk-code invariant and UUID browser routes (P2)

### Correction

- Transfer rejects a missing or invalid source code unless it matches `^(AS|LI|EQ|SA|CO)_YYYYMMDD_NNN$`.
- Per-company business-code uniqueness is enforced through an atomic shared-state key and legacy collision check.
- The copied case code remains immutable in its base snapshot.
- Review detail lookup accepts the business code under the authenticated company scope while retaining UUID compatibility for internal API relationships.
- Browser routes, list links, and post-transfer navigation use the encoded business risk code; internal case UUIDs are not user-facing route identifiers.

### Regression coverage

- `test_transfer_rejects_missing_or_invalid_business_risk_codes`
- `test_transfer_rejects_a_duplicate_business_risk_code_within_the_company`
- `test_persistent_transfer_rejects_a_legacy_case_with_the_same_business_code`
- `test_review_detail_accepts_the_business_risk_code_as_its_route_identifier`
- `RiskReviewWorkspace.test.mjs`

## Final verification

### Backend full suite

Command from `backend`:

```powershell
$env:ARIP_SKIP_DATABASE='1'
$env:PYTHONPATH='.'
& 'C:\Users\POSCOFUTUREM\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pytest tests -q -p no:cacheprovider --basetemp=.pytest-tmp-final-source-scope
```

Output:

```text
........................................................................ [ 90%]
........                                                                 [100%]
80 passed in 1.59s
```

### Frontend tests

Command from `frontend/src/pages`:

```text
node --test
```

Output:

```text
tests 19
pass 19
fail 0
duration_ms 1227.2279
```

### Frontend production build

Command from `frontend`:

```text
npm run build
```

Output:

```text
tsc -b && vite build
11821 modules transformed
dist/assets/index-Cf5Id9wz.js  737.19 kB | gzip: 224.91 kB
built in 6.56s
```

The build exited 0. Vite emitted its existing advisory that the main minified chunk exceeds 500 kB.

### Diff validation

`git diff --check` and `git diff --cached --check` exited 0 with no whitespace errors for the owned changes.

### Optional lint status

`npm run lint` was attempted during the fix wave but ESLint 9 could not start because the repository has no `eslint.config.js|mjs|cjs`. This pre-existing tooling issue is not claimed as a passing verification and was not expanded into unrelated work.

## Commit range

- Reviewed baseline: `7ce0216`
- Core correctness/security fixes: `baed83f`
- Server-verified principal scope and frontend authenticated-company fix: `619ec09`
- Source-risk prerequisite scope and authorized RiskListPage: `bb947dc`
