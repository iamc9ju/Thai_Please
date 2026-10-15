# Wallet Display and 60/40 Payment Allocation

## Outcome

The consumer wallet shows personal money and remaining subsidy money as separate balances without a combined total. Payments use subsidy for exactly 60% of the discounted final amount without whole-baht rounding, subject to currency precision, the available subsidy balance, and a Bangkok-calendar daily subsidy cap of 200 baht; personal money pays the remainder.

## Requirements

- FR-C03, FR-C05 and BR-WALLET-01 through BR-WALLET-03.
- Apply coupon discounts before the payment split.
- `targetSubsidy = finalAmount * 60 / 100` at exact supported currency precision; do not round to whole baht (for example, 101 becomes 60.60 subsidy and 40.40 personal).
- `subsidyPaid = min(targetSubsidy, dailyRemaining, subsidyBalance)` and `personalPaid = finalAmount - subsidyPaid`.
- Keep payment, wallet ledgers, and receipt/order completion atomic and idempotent.
- Display personal balance, subsidy balance, and the existing daily subsidy allowance separately; do not display a combined wallet total.
- Seed a new database with 60/40 and a 200-baht daily cap.

Non-goals: changing the public wallet response contract, adding a schema migration, connecting the currently mocked consumer payment page, or redesigning confirmation-token handling.

## Current State

- The order transaction already locks relevant records and writes the payment split and ledgers atomically.
- The split currently preserves two-decimal currency precision; the user explicitly confirmed that it must not be rounded to whole baht.
- The order daily query uses an inclusive end-of-day boundary and program lookup uses an instant rather than Bangkok business date.
- The seed creates a 50/50 program with a 200-baht cap.
- Consumer overview and wallet screens render a combined total.
- The root `.env` currently resolves `DATABASE_URL` to localhost:5432; the newly mentioned remote database URL is not present, so live database verification is blocked until it is saved.

## Invariants and Risks

- No value movement may occur outside the existing database transaction or without paired ledger entries.
- Retry/idempotency and insufficient-balance behavior must remain unchanged.
- Daily usage uses a half-open Bangkok day interval `[start, nextDay)` to avoid missing PostgreSQL sub-millisecond timestamps.
- Active program selection must be deterministic.
- Existing API fields remain for compatibility even when the UI stops rendering the combined total.

## Decisions

- Preserve the existing modular transaction design and make the smallest correction inside split calculation and date queries.
- Preserve exact decimal allocation at the supported two-decimal currency precision; do not apply whole-baht flooring.
- Use the program policy values from the database at runtime; seed defaults are changed to 60/40/200 for a new database.
- Do not rewrite an unknown existing database policy until a verified database connection is available.

## Execution Steps

1. Backend engineer: update order split/date/program selection and seed defaults; add focused payment tests. Owns `apps/api/src/order/**` and `apps/api/prisma/seed.js`.
2. Frontend engineer: remove combined totals, preserve separate personal/subsidy/daily displays, update layout/localization/tests. Owns consumer wallet/dashboard UI files and their tests/styles only.
3. Primary agent: review combined diff, resolve integration issues, run targeted tests and broader static/build checks.
4. Reviewer: independently inspect payment/value-movement correctness after implementation.

## Verification

- Backend tests cover a fractional 60/40 split (101 becomes 60.60/40.40), partial/exhausted daily cap, low subsidy fallback, coupon-before-split, insufficient personal balance, Bangkok half-open boundaries, and deterministic program lookup where practical.
- Frontend tests prove no combined total is rendered and both required balances remain visible.
- Run affected test suites, strict type checks, lint, formatting checks, and production builds.
- Run database-backed checks only after a valid reachable `DATABASE_URL` is present; never expose its value.

## Rollout and Recovery

- Code changes are backward compatible and require no migration.
- Roll back code if payment allocation tests or ledger reconciliation fail.
- Seed changes affect new/reseeded development data. Existing database policy requires an explicit inspected update after connection.

## Progress Log

- 2026-10-15: Read requirements and reviewed existing backend/UI behavior.
- 2026-10-15: Confirmed root `.env` still targets localhost and cannot be reached from this environment.
- 2026-10-15: Implementation started with non-overlapping backend and frontend ownership.
- 2026-10-15: User clarified that allocation must not be rounded to whole baht; plan and tests updated to preserve decimal 60/40 values.
- 2026-10-15: Removed combined wallet totals from Overview and Wallet; retained personal, subsidy, and daily allowance displays.
- 2026-10-15: Corrected payment program selection/day boundaries, seed defaults, invalid-policy protection, and fractional money validation across backend/client/contracts.
- 2026-10-15: Independent review found and verified fixes for fractional API rejection, inconsistent program selection, and percentage-over-100 value loss; final review found no remaining P1/P2 code issue.
- 2026-10-15: Verification passed: Order 12/12, Wallet service 45/45, Wallet controller 8/8, Web API 31/31, Wallet UI 22/22, Dashboard 10/10, typecheck, lint, production build, Prisma validation, changed-file formatting, and diff whitespace check.

## Open Questions

- The actual remote database cannot be inspected until its URL is saved in the project `.env` and reachable.
- PostgreSQL-backed concurrent payment and rollback verification remains pending because no verified `TEST_DATABASE_URL` or payment integration harness is available.
