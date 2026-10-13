# Complete POS and QR Payment Flow

## Outcome

The latest prototype flow is buildable, tested, and safe against duplicate or concurrent payment attempts: a merchant can manage products, create an order and QR code, a consumer can preview and pay once, and the persisted result debits the consumer and credits the merchant atomically.

## Requirements

- `FR-C02`: virtual top-up remains idempotent and ledger-backed.
- `FR-C04`: consumer previews the exact pending order represented by the QR token.
- `FR-C05`: payment uses the final post-discount amount, succeeds at most once, and an authorized retry returns the stored outcome.
- `FR-M02` through `FR-M05`: merchant product/POS/order/QR flow builds and exposes payment status.
- `BR-WALLET-003` and payment invariants in `AGENTS.md`: no balance update without a ledger entry in the same transaction; insufficient funds create no successful payment; coupon use and merchant credit are atomic.

Acceptance criteria:

1. Web typecheck, tests, and production build pass with the QR dependency declared in the web workspace.
2. The payment transaction locks the order, consumer wallet, optional coupon, and merchant wallet in a deterministic order before making value decisions.
3. A retry of an already-paid order by the same consumer returns the original persisted payment outcome without another debit or credit.
4. A retry by another consumer is rejected.
5. Daily subsidy use and balances are recalculated inside the locked transaction.
6. Unit tests cover successful payment, same-consumer replay, and rejected cross-consumer replay; existing wallet and UI tests remain green.
7. Formatting, lint, typecheck, unit tests, build, schema validation, and the feasible E2E checks are run and recorded.

Explicit non-goals:

- Admin portal, merchant approval UI, merchant withdrawal, quest completion, point-to-coupon exchange, analytics, and production observability are separate product increments.
- No real-money gateway or banking integration.
- No destructive migration or production data operation.

## Current State

- `apps/api/src/order/order.service.ts` implements the happy path but resolves balances before the transaction, does not acquire PostgreSQL row locks, and rejects every paid-order retry.
- `apps/web/src/features/merchant/pages/MerchantPos.tsx` imports `qrcode`, but the dependency is absent.
- Strict optional property errors prevent the web workspace from compiling.
- Wallet unit tests exist; order/payment tests do not.
- The latest flow is uncommitted and Prettier reports style failures in 15 files.

## Invariants and Risks

- Order, consumer wallet, coupon, and merchant wallet writes must commit or roll back together.
- Lock order is fixed as order, consumer wallet, optional coupon, then merchant wallet to reduce deadlock risk.
- The payment split must be recomputed after locks; preview remains advisory.
- Coupon ownership, availability, and expiry are revalidated after its row is locked.
- Same-order retry must not create new wallet transactions.
- The existing database schema is sufficient; no migration is planned.
- This closes the current prototype flow but does not establish production readiness without PostgreSQL concurrency integration tests and broader platform features.

## Decisions

- Use parameterized PostgreSQL `SELECT ... FOR UPDATE` queries inside the existing Prisma interactive transaction. Rejected alternative: process-local mutex, because it fails with multiple API replicas.
- Use the order as the stable idempotency boundary for this single-use QR flow. Store/return the paid order result on replay. Rejected alternative: add a request-id table now, because it would require a migration and the QR order already represents one immutable payment intent.
- Keep API response amounts as numbers for the existing frontend contract, while authoritative database writes use Prisma Decimal-compatible values. A broader integer-minor-unit migration remains outside this increment.
- Add focused service tests with transaction mocks now and retain real PostgreSQL concurrency coverage as an explicit residual verification gap if local database infrastructure is unavailable.

## Execution Steps

1. **In progress — Level 3 primary:** fix web dependency and exact optional property errors in `apps/web` and update the lockfile.
2. **Pending — Level 4 primary:** refactor order payment transaction to lock and re-read authoritative records, support safe replay, and recompute subsidy/coupon values under lock.
3. **Pending — Level 3 primary:** strengthen virtual top-up wallet locking and conflict replay handling if required by tests.
4. **Pending — Level 2 primary:** add focused order/payment unit tests and update existing mocks.
5. **Pending — Level 1 primary:** format changed files and resolve static warnings relevant to the latest flow.
6. **Pending — Level 3 reviewer:** risk-review authorization, concurrency, ledger symmetry, coupon single-use, retry behavior, and test gaps.
7. **Pending — Level 3 primary:** run schema validation, formatting, lint, typecheck, unit tests, E2E where supported, and production build; record evidence.

## Verification

- `pnpm db:validate`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @thai-please/api test:e2e`
- `pnpm build`
- Focused OrderService unit tests for success and replay behavior.
- Diff review for hardcoded policy, unsafe logs, cross-merchant access, stale balance decisions, and duplicate ledger writes.

## Rollout and Recovery

- No schema or production data mutation is included.
- Changes are backward-compatible with the existing QR token and API response shape.
- Recovery is a source rollback before deployment. Existing paid orders and ledgers require no backfill.
- If PostgreSQL lock behavior differs in deployment, fail closed and keep the feature unreleased until the real-database concurrency test passes.

## Progress Log

- 2026-10-13: inspected the current uncommitted flow and ran initial checks. Prisma validation and lint passed; formatting, web typecheck, web test loading, and build failed. E2E could not bind a local port in the sandbox.
- 2026-10-13: selected row locking plus order-scoped replay as the completion design.

## Open Questions

- A dedicated client idempotency key and canonical request hash may be required when an order can support more than one mutation shape. The current one-order/one-payment QR contract does not require that schema expansion.
- Real PostgreSQL concurrency tests depend on a reachable disposable database. If unavailable locally, this remains a documented release blocker rather than being simulated with mocks.
