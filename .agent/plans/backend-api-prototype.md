# Backend API Prototype ExecPlan

## Outcome

Deliver the versioned NestJS REST API in `apps/api` for consumer identity, wallets and subsidy, merchant POS, payment intents and QR review, atomic virtual-wallet payment, immutable receipts, quests, points, coupons, and dashboards. Generate OpenAPI from source, persist authoritative state in PostgreSQL through Prisma, provide safe demo seed data, and verify the required business rules with deterministic tests.

## Requirements

Primary coverage: `FR-C01`-`FR-C07`, `FR-M01`-`FR-M05`, `FR-S01`-`FR-S03`, and the dashboard portion of `FR-A01`; `NFR-SEC-01`, `NFR-SEC-02`, `NFR-SEC-04`, `NFR-DATA-01`-`03`, `NFR-MAINT-01`-`02`, `NFR-AUD-01`-`02`, and `NFR-REL-01`.

Acceptance criteria supplied by the user:

- Existing users log in with a 13-digit citizen ID only; there is no public registration, email, or password endpoint.
- One wallet exists per user. The initial subsidy grant is 1,000 integer baht, recorded once in an immutable ledger.
- Payment applies a 60% subsidy share subject to a 200-baht daily subsidy cap calculated from that day's ledger entries; unavailable quota falls back to personal balance.
- Coupon discount is frozen before the final amount and deterministic quest evaluation uses that post-discount amount from one receipt only.
- QR/payment intent, coupon, point, and quest expiry are explicit and tested. Payments, top-ups, coupon exchange/use, and reward issuance are idempotent.
- Paid receipts are immutable and the prototype exposes no refund path.
- Swagger/OpenAPI, safe `.env.example`, migration, seed, endpoint documentation, and automated tests are delivered together.

Non-goals: real money, external POS, refunds, public user registration, AI authority over completion/value, and production deployment.

## Current State

The repository is a pnpm monorepo. `apps/api` is a NestJS 12 application with Prisma 7/PostgreSQL, strict TypeScript, request IDs, a global exception filter, validated environment configuration, and health endpoints. Its Prisma schema currently contains only generator/datasource declarations. Product rules and architecture require a modular monolith, immutable ledgers, idempotency, snapshots, outbox records, and PostgreSQL-backed state. The worktree already contains a user change to `.env.example`; it currently includes a credential-like URL and must be sanitized without disturbing unrelated settings.

## Invariants and Risks

- Wallet/point movements require append-only ledger rows and unique business references. Cached balances, if used for row locking, must update in the same transaction.
- Payment completion must lock records in deterministic order, enforce idempotency, prevent negative balances, consume a coupon once, freeze a receipt, and write outbox events atomically.
- Public tokens/IDs must not make financial authority client-controlled. QR tokens are opaque hashes with server-side expiry and one intent binding.
- Citizen ID is sensitive and must never appear in tokens or logs. Prototype authentication will return an opaque database-backed bearer session with expiry.
- Integer baht and `THB` are explicit user-approved prototype policy; subsidy ratio, cap, expiries, and demo top-up bounds are validated environment configuration.
- Auto-increment integer primary keys are required by the user's latest SQL decision. Opaque session/QR/idempotency values prevent sensitive enumeration at public trust boundaries.
- Tests that claim PostgreSQL atomicity/concurrency require an actual test database. Unit/contract tests may use isolated domain collaborators but cannot substitute for database claims.

## Decisions

- Preserve NestJS, Prisma, pnpm, request/error conventions, and modular-monolith boundaries.
- Implement cohesive domain modules with DTO validation, application services, and Prisma repositories/transactions. Controllers contain no financial rules.
- Use a wallet balance projection for locking plus an immutable ledger as authority; every projection mutation and ledger entry commits together.
- Use opaque random bearer sessions for the prototype rather than encoding user IDs. Store only a SHA-256 token hash.
- Store QR token hashes, frozen order/receipt snapshots, idempotency records, and outbox records in PostgreSQL.
- Use a constrained deterministic mock quest-proposal provider based on transaction/category history. The deterministic rule engine alone completes quests.
- Reject unknown fields globally and use stable machine-readable domain errors.

Rejected: copying the prior Fastify/in-memory prototype, mutable balance without ledgers, client-authoritative totals, and testing transaction safety only with mocks.

## Execution Steps

1. **Foundation and policy (primary, Level 4):** sanitize configuration, define typed policy/constants/errors/auth guard, and update Swagger security. Expected output: validated startup settings and centralized transport/security behavior.
2. **Schema and migration (primary, Level 4):** model users/sessions, merchant membership/catalog, wallet and point ledgers/projections, carts/intents, coupon ownership, receipts, quests, idempotency, outbox, and audit records with constraints/indexes. Expected output: forward migration and generated Prisma client.
3. **Identity/wallet/catalog/POS (primary, Level 3):** add owner-scoped auth/user/wallet APIs, idempotent top-up, merchant/category/product APIs, carts/items/coupon selection, checkout and QR review.
4. **Payment/receipt (primary, Level 4):** add serializable/locked atomic payment, 60/40 subsidy allocation and daily cap from ledger, immutable receipt/history, retry outcome, and paid-state protections.
5. **Quest/point/coupon/analytics (primary, Level 4):** add mock proposal abstraction, auto-assignment, deterministic one-receipt evaluation, point reward/expiry-aware balance, atomic coupon exchange/use, merchant and social-impact dashboards.
6. **Seed/docs/tests (primary, Level 3):** add safe demo data, OpenAPI DTOs/errors/auth documentation, endpoint/setup docs, deterministic unit/contract/E2E coverage, and requirement traceability.
7. **Verification/review (primary, Level 4):** run targeted tests, database validation/migration checks when a local test database is available, lint, strict typecheck, E2E, build, dependency audit, and diff/security review.

## Verification

- Required named cases: citizen login, one-user-one-wallet, one-time grant 1,000, 60/40, daily cap 200, personal fallback, discount-before-quest (`100 - 10 = 90` fails threshold `100`), one-order quest, coupon one-time/expiry, point redeem/expiry, QR expiry, paid immutability/no refund.
- Add idempotency/retry, insufficient-funds rollback, cross-owner access, tampered/unknown token, and duplicate reward coverage.
- Commands: `pnpm db:validate`, targeted Vitest suites, `pnpm --filter @thai-please/api typecheck`, `lint`, `test`, `test:e2e`, `build`, then root `pnpm verify` where environment permits.
- PostgreSQL integration evidence will use local Compose only, never an unverified remote credential.

## Rollout and Recovery

Apply the additive initial migration before starting the API, then seed only non-production/demo environments. The migration creates new tables and does not backfill existing business data because none exists. Recovery is roll-forward by correcting the initial migration before shared deployment; after deployment, use additive corrective migrations rather than destructive rollback. Monitor health readiness, payment failures, idempotency conflicts, ledger/projection reconciliation, coupon conflicts, quest reward uniqueness, and outbox backlog.

## Progress Log

- 2026-10-06: Inspected repository, root instructions, product requirements, business rules, architecture, ADRs, current API foundation, and dirty worktree. Confirmed NestJS/Prisma stack and identified the credential-like `.env.example` value.
- 2026-10-06: ExecPlan created before implementation as required by `.agent/PLANS.md`.
- 2026-10-06: Added the Prisma/PostgreSQL schema, generated migration, database constraints and immutability triggers, demo seed, opaque session/QR authentication boundary, domain modules, OpenAPI controllers, and documentation.
- 2026-10-06: Added domain tests for 60/40 subsidy allocation, daily cap/fallback, post-discount pricing and quest evaluation, point redemption/expiry, coupon expiry/single-use state, paid-order immutability, citizen login, OpenAPI paths/auth, and schema invariants.
- 2026-10-06: Verification passed: API unit suite 15/15, OpenAPI/schema contract suite 4/4, strict typecheck, type-aware lint, Prisma validate, Nest production build, formatting check, and production dependency audit with no known vulnerabilities.
- 2026-10-06: Real-PostgreSQL migration/concurrency and full database E2E remain unexecuted because this host has no PostgreSQL listener and Docker Desktop/daemon is unavailable. No remote credential was used. This is a verification blocker, not a claimed pass.

## Requirement-to-evidence summary

- `FR-C01`, `FR-C02`: owner-scoped overview/wallet/history, citizen-only session login, idempotent top-up, one-wallet schema constraint, and one-time seed grant; unit/schema-contract evidence passes.
- `FR-C03`, `FR-M02`-`FR-M04`: frozen snapshots, opaque expiring QR, server-side pricing, serializable locked payment, 60/40 and daily-cap domain evidence, idempotency and immutable receipt schema; unit/contract/build evidence passes, PostgreSQL runtime evidence pending.
- `FR-C04`: receipt snapshot tables, owner checks, no refund route, application guard and PostgreSQL immutability triggers; domain/OpenAPI/schema-contract evidence passes.
- `FR-C05`-`FR-C07`, `FR-S01`-`FR-S03`: constrained mock provider, automatic assignment, deterministic single-receipt/post-discount rule, allocation-based point expiry/redemption, one-time coupon use, and unique rewards; domain evidence passes, PostgreSQL runtime evidence pending.
- `FR-M01`, `FR-M05`, `FR-A01`: merchant membership checks, product audit events, merchant dashboard, and admin-only social-impact dashboard; contract/type/lint/build evidence passes, database E2E pending.

## Open Questions

- Production identity proofing, account recovery, merchant/admin provisioning, advanced coupon stacking, tax/rounding, analytics attribution, and deployment SLOs remain outside this prototype. The user's explicit decisions authorize citizen-ID-only prototype login, integer-baht policy, subsidy rules, and the requested expiry-configured demo behavior; these defaults remain configuration owned and replaceable.
