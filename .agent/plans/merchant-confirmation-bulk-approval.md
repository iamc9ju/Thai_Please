# Merchant confirmation and bulk pending approval

## Outcome

FR-A02/FR-M01: pending-store view has Approve All; approve/reject require a
reviewable confirmation dialog, cancellation issues no request, duplicate clicks
cannot submit twice, and batch results report partial failure honestly.

## Current State

Existing admin merchant list and individual endpoints, audited per-store locked
transaction. User asks only merchant workflow; preserve AI and account/password
work and unrelated edits. No migration or new permission/infrastructure.

## Requirements and Decisions

Approve All targets only PENDING merchants in the displayed confirmed snapshot;
new arrivals are excluded until refresh. Confirm count/names before executing.
Use existing endpoints sequentially, one transaction/audit per merchant. Optional
expectedStatus is checked under the existing row lock so a concurrent rejection
or suspension cannot be overwritten by stale batch approval. Existing API callers
remain compatible. Show successes/failures and refresh without disguising partial
success. Native dialog provides focus containment/Escape/focus return.

## Invariants and Risks

No actual production approval during tests. All permissions remain server-side.
No batch atomicity claim. Expected-state mismatch fails before wallet/role writes.
Batch pending lock is in-memory UI only, never authoritative server state.

## Execution Steps

Primary Level 3: guarded API snapshot condition; localized accessible dialog and
UI orchestration; regression tests; static/build checks and documentation.

## Verification

Passed: 18 admin page tests covering confirm/cancel/reject/bulk-pending/partial failure/duplicate submit/search/type; 22 admin API tests including expected-state conflicts; four HTTP E2E tests verifying registration type persistence. API/web typecheck/build passed. Lint passed with pre-existing frontend warnings.

## Rollout and Recovery

Deploy API before or together with web for expectedStatus support. No database
migration. Revert UI independently; successful approvals remain audit facts.

## Progress Log

2026-10-28: Reviewed existing merchant handler/API/tests and scoped batch semantics.

## Open Questions

None. All means pending merchants in the confirmed list snapshot.

## Added scope: search and merchant type

User requested search and a store-type filter. Search/filter are local over the
existing status-scoped list; bulk approval confirms only visible pending stores.
Discovered merchantType was accepted by signup but discarded. Add nullable
merchants.merchant_type VARCHAR(100) through additive migration
20261028090000_add_merchant_type, persist the existing registration input, and
return it in admin list. Old stores remain null/unknown; no inferred backfill.
Deploy this migration before the generated API client starts reading the column.
No default, index, rewrite or data loss. Bounded five-second DDL lock wait. Revert
application reads if rollback needed; leave the nullable column intact. Validation
query checks information_schema.columns for correct type/nullability. No AI
migrations, passwords or account-role changes. Executing only this SQL migration
and resolving only its history avoids running pending AI migrations.

2026-10-28 complete: native dialog and per-request UI lock integrated. Filtered
pending snapshot is confirmed before execution. Added regression coverage and
updated API guidance/checklist. Applied only merchant-type SQL and resolved only
its migration history. Verified nullable VARCHAR(100) and real pending-list read.
No live approval, rejection, account/password change or AI migration was executed.
Remaining legacy stores have unknown type; actual metadata must be supplied,
not inferred. No manual browser interaction or PostgreSQL concurrency test claimed.
