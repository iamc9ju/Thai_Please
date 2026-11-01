# Merchant sales list

## Outcome and requirements

FR-A01 (existing dashboard labels this FR-A07): preview five merchants, open all merchants in an accessible modal, search names, sort sales ascending/descending before pagination, ten rows per page. No financial calculations or mutations change.

## Current state

The existing social-impact aggregate loads participating merchants and paid orders but truncates merchant results to ten. Frontend previously renders that array directly. Existing admin dialog establishes native dialog and focus restoration patterns.

## Invariants and risks

Read-only administrator surface using existing authorization. No schema, ownership or value-movement changes. Existing aggregation loads the reporting dataset in memory; returning the merchant summaries increases response size. This implementation uses client pagination over that existing aggregate, so server pagination remains a scaling limitation.

## Decisions

Reuse the current report/date selection and response shape. Isolate list UI in MerchantSales; use native modal focus containment, Escape dismissal and focus restoration. Keep five preview rows, ten modal rows, reset page on search/sort and stable tie ordering.

## Execution steps

Primary agent owns implementation and verification (level 2). Remove top-ten truncation; extract preview/dialog; add owned Thai copy; add component interactions and API regression tests. Implementation completed; checks in progress.

## Verification

Component test covers five-row preview, ten-row pagination, global ascending sort, name filtering, no matches and close. API test covers 24 merchants beyond the former cap. Run existing dashboard tests, relevant API tests, formatting, type checks and lint.

## Rollout and recovery

Additive UI behavior and compatible response shape; no migration or data recovery needed. Revert these files to restore former report behavior.

## Progress log

2026-10-30: Implemented report/list UI and tests. Verification in progress. Plan recorded during implementation; no architecture or authorization changes.

## Open questions

None for current UX. A dedicated server-paginated report is needed if report size warrants it.

2026-10-30 verification: web dashboard/component tests 20 passed; API service tests 14 passed; component rerun after pagination buttons 1 passed. Web/API type checks passed. Web build passed. Web lint passed with pre-existing warnings outside the new component. Initial dashboard run failed on temporary file access; authorized rerun passed. Client pagination scalability limitation remains as recorded above.
