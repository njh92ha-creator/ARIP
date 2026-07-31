# Closing Analysis Set status

## Implemented

- A Closing Analysis Set now groups one company's General Ledger and Settlement Schedule for one fiscal year and month.
- The system blocks formal analysis until both source files are mapped, approved and attached.
- General Ledger and Settlement Schedule uploads are retained as separate inputs, then analyzed in one pipeline.
- The pipeline creates reconciliation findings, account-description classification findings, Events, AVI observations and Audit Risks together.
- AVI remains a separate quantitative display, but its observations can link to the Event and Audit Risk for the same account.
- A short-term borrowing account with a long-term borrowing description is raised as a classification, liquidity and disclosure review candidate when it meets the configured materiality threshold.
- Cross-analysis facts are supplied to AI event analysis when external AI is enabled. AI still returns a candidate; it does not make the final accounting conclusion.
- Re-analysis replaces prior findings and AVI observations for the same Closing Analysis Set instead of accumulating duplicate results.
- Exact re-analysis of the same journal lines is skipped, while a same-pattern event from a later close creates a reassessment that can reuse prior Risk Memory without suppressing the current-period review.

## User flow

1. Open **Excel Upload**.
2. Select fiscal year and fiscal month.
3. Upload and approve the mapping for the General Ledger.
4. Upload and approve the mapping for the Settlement Schedule.
5. Select **Run closing analysis**.
6. Review Audit Risk, linked cross-analysis signals, AVI observations and journal drill-down.

## Verification completed

- Backend compile check passed.
- Focused Closing Analysis Set unit test passed.
- Frontend TypeScript check and production build passed.

## Runtime note

Docker Desktop was not available in this development environment at verification time, so the changed containers were not started here. Rebuild and start the local application before using the new flow:

```powershell
docker compose up -d --build backend worker frontend
```

Then open `http://localhost:3000` and use the new **Closing Analysis Set** upload page.
