# ADR-0002: Use immutable ledgers and idempotent value movement

- Status: Accepted
- Date: 2026-10-06
- Decision owners: Architecture, payment, and rewards engineering
- Requirements: `FR-C02`, `FR-C03`, `FR-C04`, `FR-C06`, `FR-C07`, `FR-M03`, `FR-M04`, `FR-S02`, `FR-S03`

## Context

Virtual money, points, and single-use coupons represent value even in the prototype. Requests and events can be retried, duplicated, delayed, or processed concurrently. Mutable balances without an authoritative history cannot explain discrepancies or prove that payment, reward, expiry, or redemption happened once. The product also requires immutable successful receipts and wallet/point transaction histories.

## Decision

Record wallet and point movements as append-only ledger entries in PostgreSQL. Each movement includes an explicit unit/currency, amount, direction, reason, account, immutable business reference, and timestamps. A balance is the sum of valid entries. A stored projection may accelerate reads or enforce locking only when it is updated atomically with the ledger and reconciled continuously.

Every retryable mutation uses a server-enforced idempotency scope and key, canonical request hash, processing state, and persisted outcome. Unique constraints on business references are the final duplicate barrier. Reusing a key for a different canonical request is an error; retrying the same request returns the original outcome.

Payment completion locks the required payment-intent, wallet, and coupon records in a deterministic order and commits the wallet debit, coupon consumption, successful receipt snapshot, state transition, idempotency outcome, and outbox records in one short PostgreSQL transaction. Insufficient funds commits none of the successful-payment facts. Quest reward issuance and point-to-coupon exchange use equivalent atomic ledger-plus-business-record transactions.

Receipt, ledger, and consumed-coupon history is not updated or deleted through normal application paths. Corrections, if later required by an approved requirement, use compensating entries while preserving history; the current prototype has no refund flow.

## Consequences

Benefits:

- balances and rewards are auditable and reproducible;
- duplicate requests/events cannot create duplicate value;
- database constraints protect invariants even if application checks race;
- reconciliation can detect projection or cross-record drift without rewriting history.

Costs and risks:

- writes and storage grow faster than a mutable-balance design;
- lock order, isolation, and indexes require careful testing under concurrency;
- projections, expiry entries, and reconciliation add operational work;
- idempotency retention and replay semantics require explicit policy.

Mitigations include bounded queries, cursor pagination, representative concurrency tests, deterministic lock order, unique business keys, monitored reconciliation, and evidence-based partitioning/archival.

## Alternatives considered

- **Mutable balance only:** rejected because it loses provenance and cannot safely reconcile or explain concurrent failures.
- **Application-only duplicate checks:** rejected because concurrent transactions can pass the same precondition.
- **Distributed locking:** rejected for the baseline because PostgreSQL row locks and uniqueness constraints keep authority in one transactional system.
- **Event sourcing for every domain:** rejected as unnecessary complexity; only value histories and immutable facts require append-only semantics.

## Revisit triggers

Revisit when introducing real money, refunds/chargebacks, multi-currency, external settlement, regulatory accounting, or data volumes that require ledger partitioning. Any change must preserve immutable provenance, exactly-once business effects through idempotency, tested reconciliation, and compatible historical reporting.
