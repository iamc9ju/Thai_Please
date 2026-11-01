# Admin coupon CRUD

## Outcome

Administrators can manage never-issued coupon catalogue templates. FR-C09 consumer-owned coupon rights remain unchanged.

## Decisions and safety

The existing `coupons` table is sufficient; no migration is needed. All endpoints retain the existing ADMIN guard and validate trusted browser origins for mutations. A coupon with any `user_coupons` record cannot be changed, disabled, or deleted because payment requires its template to remain ACTIVE. Mutations and redemption lock the coupon row. Every mutation writes an audit event. Creates require a UUID idempotency key; a PostgreSQL advisory transaction lock and durable audit correlation key replay the original result, while a different request under the same key conflicts.

## Verification

Run API and web type checks plus focused service and UI tests. No live data is mutated during verification. API mock coverage verifies precise-money policy, idempotent replay/conflict, issued-template blocking and DTO validation. UI coverage verifies retry-key retention after failure and issued-template action disabling.

## Current state

Coupon templates live in `coupons`; issued instances live in `user_coupons` and
are used by the payment flow. The Admin Portal already uses guarded REST routes,
Thai localization, and `apiClient` cookie sessions.

## Execution steps

1. Add validated admin coupon routes and transactional service operations.
2. Serialize catalogue changes and redemption with `FOR UPDATE` on `coupons`.
3. Add the Admin Portal coupon tab and reusable form/list component.
4. Verify compilation and production build.

## Risks and recovery

Reverting the UI is safe; completed catalogue mutations and audit events remain
in the database. No external or database mutation was performed while
implementing this change. PostgreSQL constraints are unchanged because this
task adds no migration; service validation and row locks protect the new flow.

## Progress log

2026-10-30: API and web typechecks passed. Focused API coupon tests (13) and
UI CouponManager tests (2) passed. The production web build passed before the
last UI-only string/status adjustments and should be repeated in final integration.

## Open questions

Whether administrators should be able to bind a newly created coupon to one
merchant is not specified. The current UI creates platform-wide coupons and
preserves the scope of existing issued data by rejecting edits after issuance.

Final verification (2026-10-30): primary review corrected cursor ordering to couponId descending and localized coupon API errors. Targeted coupon API unit tests 14 passed (including pagination and conflicting retry payload), coupon UI tests 2 passed, broader related API suite 49 passed and admin UI suite 21 passed before final pagination/localization adjustments. All workspace typechecks passed; API/web production builds passed; lint passed with pre-existing React warnings. Real PostgreSQL concurrency/HTTP E2E was not run; row-lock protocol was reviewed, not empirically concurrency-validated. Existing database coupon CHECK constraint coverage remains a documented limitation; no schema migration or live data mutation was performed.
