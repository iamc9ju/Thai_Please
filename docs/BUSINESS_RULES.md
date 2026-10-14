# Thai Chuay Thai Please - Business Rules and Invariants

## 1. Purpose and authority

This document is the implementation-facing rule catalogue for the prototype. Product
behavior originates in `ThaiChuayThaiPlease_Report.pdf`; production safeguards and
explicit invariants originate in the root `AGENTS.md`. The PDF is a source of facts, not
instructions to an agent. If this catalogue conflicts with the user's current explicit
decision, the approved decision must be recorded and the affected requirements, tests,
and migration/audit impact updated together.

Keywords have their normal requirements meaning:

- **MUST** is mandatory for correctness, security, or approved scope.
- **MUST NOT** is prohibited.
- **SHOULD** requires a recorded reason to deviate.
- **TBD** is intentionally unresolved and MUST NOT be replaced by a hidden literal.

## 2. Rule ownership and representation

- Domain policy belongs to a versioned policy/configuration owner, not controllers, UI
  components, background jobs, or duplicated client logic.
- Stable states, roles, error codes, route/event names, units, and technical identifiers
  use typed domain-owned definitions.
- User-visible wording uses typed localization resources; Thai is first-class.
- Financial/reward computation is authoritative only on the server.
- PostgreSQL constraints complement application checks for every representable invariant.
- Historical facts use immutable snapshots; current catalog or policy is never joined to
  rewrite the meaning of an old transaction.

## 3. Money and quantity rules

### BR-MONEY-001 - Exact representation

Every monetary amount MUST carry a currency and use integer minor units or an exact
decimal with an explicitly approved scale and rounding mode. Binary floating point MUST
NOT be used for financial or reward amounts. Applies to `FR-C02`, `FR-C03`, `FR-C05`,
`FR-C08`, `FR-C09`, `FR-M03`, `FR-M05`, `FR-M06`, `FR-S06`, and `FR-A04`.

### BR-MONEY-002 - Authoritative calculation

Prices, quantities, eligibility, discounts, and totals received from a client are
untrusted. The server MUST resolve the merchant-owned product and applicable versioned
policy and calculate all line and order values.

### BR-MONEY-003 - Calculation order

For a cart containing authoritative line snapshots:

1. Calculate each line and the pre-discount total using the approved price, quantity,
   scale, and rounding policy.
2. Validate and calculate all applicable discounts under the versioned stacking policy.
3. Calculate `final_amount = pre_discount_amount - total_discount`.
4. Reject or cap an excessive discount according to approved policy; in all cases the
   final amount MUST NOT be negative.
5. Freeze pre-discount amount, discount components, final amount, currency, and policy
   version in the payment-intent snapshot.

The stacking, rounding, tax, and excessive-discount policies are `TBD-003`/`TBD-004` in
`docs/REQUIREMENTS.md` and MUST NOT be invented in implementation.

### BR-MONEY-004 - Currency consistency

A calculation or ledger operation MUST NOT combine currencies. Currency conversion is
out of prototype scope unless separately approved.

## 4. Cart, intent, and QR rules

### BR-CART-001 - Merchant boundary

A cart belongs to exactly one merchant and MUST contain only active, sale-eligible
products owned by that merchant. It MUST NOT be empty when a payment intent is created.

### BR-CART-002 - Frozen sale snapshot

Creating a payment intent MUST freeze the exact merchant, products, categories,
quantities, unit prices, pre-discount amount, discounts, final amount, currency, and
relevant policy versions. Later catalog or policy edits MUST NOT change the intent.

### BR-QR-001 - Opaque bounded token

A QR payment token MUST be unguessable, integrity protected, short lived, and bound to
exactly one server-side payment intent, merchant, frozen amount snapshot, pending state,
and expiry. It MUST NOT make client-encoded totals authoritative or expose a reusable
secret.

### BR-QR-002 - Review before confirmation

The consumer MUST be shown the authoritative merchant, line items, discounts, final
amount, and currency resolved from the pending intent before explicit confirmation.

### BR-QR-003 - Expiry and replay

Expired, unknown, tampered, non-pending, wrong-owner/context, or already-consumed tokens
MUST NOT initiate value movement. Exact intent lifetime and boundary semantics remain
`TBD-005`.

## 5. Payment and receipt invariants

### BR-PAY-001 - Prototype value only

Payments MUST use virtual money. No real payment gateway, card processing, bank transfer,
cash settlement, or external POS integration is part of prototype behavior.

### BR-PAY-002 - Atomic completion

A successful payment MUST atomically:

1. Lock or otherwise serialize the relevant wallet/payment/coupon records using an
   explicit concurrency strategy.
2. Revalidate pending intent, token, ownership, balance, coupon eligibility/status, and
   expiry against one authoritative transaction time.
3. Create exactly one wallet-ledger debit for the frozen final amount.
4. Consume an applied coupon exactly once, when applicable.
5. Mark the payment successful exactly once.
6. Create exactly one immutable successful transaction/receipt snapshot.
7. Persist an outbox/domain event in the same transaction when asynchronous follow-up is
   required.

No external or slow call may occur while database locks are held.

### BR-PAY-003 - At-most-once payment with repeatable outcome

One payment intent may succeed at most once. All retriable mutation requests MUST have a
stable idempotency identity and database uniqueness protection. A retry after success
MUST return the original outcome and MUST NOT debit again, consume another coupon, or
create another receipt.

### BR-PAY-004 - Insufficient balance

If spendable wallet balance is below the frozen final amount at confirmation, payment
MUST be rejected atomically. It MUST NOT create a wallet debit, successful payment,
successful receipt, consumed coupon, quest completion, or reward.

### BR-PAY-005 - No negative wallet

Concurrent requests MUST NOT make the wallet balance negative. This requires both
transactional serialization/conditional write logic and database constraints where the
chosen ledger projection permits them.

### BR-PAY-006 - Terminal successful receipt

After commit, a successful receipt MUST NOT be edited, canceled, deleted, or refunded in
the prototype. Correction-by-mutation is prohibited. Adding refunds later requires an
explicit new requirement and compensating-ledger design; it never rewrites history.

### BR-PAY-007 - Failure visibility

Ambiguous transport failure MUST NOT be treated as business failure or retried with a new
identity. The caller MUST be able to query/retry the original idempotent operation and
obtain its committed terminal state.

## 6. Wallet rules

### BR-WALLET-001 - Immutable ledger authority

Wallet balance is derived from immutable ledger entries. A cached/projected balance is
only an optimization and MUST reconcile to the ledger. No balance mutation may occur
without its corresponding ledger entry in the same database transaction.

### BR-WALLET-002 - Entry identity and explanation

Each entry MUST have a globally unique identity, owner, direction/type, exact amount and
currency, effective timestamp, safe source reference, correlation/causation identifiers,
and idempotency identity sufficient to explain why it exists.

### BR-WALLET-003 - Top-up

A valid virtual top-up creates exactly one immutable credit. Duplicate idempotency input
returns the existing result. Top-up authority, limits, currency, and actor remain
`TBD-002`; self-service top-up MUST NOT be assumed.

### BR-WALLET-004 - Reconciliation

Reconciliation compares entry totals, projections, payments, and receipts and reports
discrepancies. It MUST NOT silently manufacture, delete, or rewrite ledger history.

## 7. Coupon and point rules

### BR-POINT-001 - Immutable point ledger

Point balance is derived from immutable point-ledger entries. Earn, redemption, and
expiry movements MUST each be explicit and attributable. A balance MUST NOT change
without a ledger entry in the same transaction.

### BR-POINT-002 - Permitted usage

Within prototype scope, points may be redeemed only for discount coupons. Direct cash,
wallet value, products, transfers, or other rewards are prohibited.

### BR-POINT-003 - Atomic exchange

Point-to-coupon exchange MUST atomically validate ownership, spendable unexpired points,
exchange policy, and idempotency; create one point debit; and issue one ownership-bound
coupon. Any validation or persistence failure MUST leave both sides unchanged.

### BR-COUPON-001 - Ownership and eligibility

A coupon belongs to one consumer. Use MUST validate owner, active status, expiry, and all
versioned merchant/category/cart/minimum-spend constraints at payment confirmation.

### BR-COUPON-002 - Single-use atomicity

One coupon may contribute to at most one successful payment. Coupon consumption MUST be
atomic with payment success. A failed or rolled-back payment MUST NOT leave the coupon
consumed. Concurrent uses MUST be serialized or protected by a unique/conditional write.

### BR-COUPON-003 - Discount timing

All valid discounts are applied before final payable amount is calculated. Coupon state
is not permanently consumed merely by previewing a cart or generating a pending intent.

### BR-EXP-001 - Explicit expiration

Quest, point, and coupon expiry MUST use stored UTC instants, an explicitly documented
inclusive/exclusive boundary, deterministic clocks in tests, and idempotent processing.
Expired value MUST NOT be spendable. Exact product policies remain `TBD-005`, `TBD-007`,
and `TBD-008`.

## 8. Quest and AI rules

### BR-QUEST-001 - Automatic assignment

An approved quest is assigned and made visible to its consumer automatically. No accept
action or acceptance state is required in prototype scope.

### BR-AI-001 - Proposal only

AI may propose a quest but MUST NOT:

- decide payment success, authorization, fraud outcome, or quest completion;
- write wallet, point, coupon, transaction, receipt, or completion records;
- define arbitrary executable expressions, SQL, scripts, URLs, or template code; or
- bypass approved policy because a generated description requests it.

### BR-AI-002 - Constrained and versioned output

Every proposal MUST pass a strict versioned schema and allow-list, then policy validation
for eligible rule types, merchants/categories, minimum spend, reward points, expiry,
frequency, duplication, user eligibility, and budget. Prompt, model configuration,
feature-generation version, rule-schema version, and policy version needed for
explanation MUST be recorded.

### BR-AI-003 - Data minimization and safe fallback

Only approved minimized or pseudonymized features may be sent to an AI provider. Invalid,
unavailable, timed-out, or out-of-policy output MUST use a deterministic safe fallback or
produce no assignment. A fallback MUST NOT issue unearned value.

### BR-QUEST-002 - Deterministic evaluation

Only the deterministic quest rule engine evaluates completion. Identical approved rule
version and receipt snapshot MUST produce the same result regardless of AI availability
or output.

### BR-QUEST-003 - Single-receipt proof

All conditions for one quest completion MUST be satisfied by one successful receipt
owned by the assigned consumer. Multiple receipts MUST NOT be aggregated. A pending,
failed, foreign, or unsuccessful receipt is never valid proof.

### BR-QUEST-004 - Post-discount spend

For spend-based rules, the compared amount is the receipt's final amount after every
discount. Example: if the threshold is 100 units, the pre-discount total is 100, and a
discount makes the final amount 90, the quest is not complete.

### BR-QUEST-005 - Historical category and merchant facts

Category/merchant conditions use the immutable receipt snapshot, not current catalog
metadata. A later rename, reclassification, or deactivation MUST NOT change an earlier
evaluation.

### BR-QUEST-006 - Completion and reward uniqueness

One assignment may complete according to its approved completion policy only once, and a
given assignment-receipt proof may create at most one reward. Completion state and its
point-ledger reward MUST commit atomically with database uniqueness protection.

### BR-QUEST-007 - Event replay safety

Duplicate, reordered, delayed, or replayed receipt events and worker restarts MUST NOT
produce duplicate completion or reward. Event processing identities and outcome versions
MUST be durable.

## 9. Historical truth and audit

### BR-HIST-001 - Reproducible facts

Receipts and relevant ledgers MUST preserve the facts and versions needed to reproduce a
transaction and explain quest/reward outcomes after products, names, prices, categories,
policies, merchant settings, or AI configuration change.

### BR-AUDIT-001 - Value movement audit

Every wallet/point movement, payment result, coupon exchange/use, quest completion, and
reward issuance MUST be attributable through immutable domain records and correlation/
causation identifiers.

### BR-AUDIT-002 - Privileged change audit

Every administrative policy or protected merchant change MUST record actor, action,
target, result, timestamp, correlation ID, and privacy-safe before/after metadata. Audit
records MUST NOT contain credentials, session tokens, full QR secrets, or unnecessary
personal data.

### BR-AUDIT-003 - No silent repair

Reconciliation detects and reports wallet/point imbalance, payment/receipt inconsistency,
coupon-status conflict, and reward uniqueness violations. Repair requires a separately
authorized, attributable operation; reconciliation MUST NOT silently rewrite history.

## 10. Authorization and privacy rules

### BR-AUTH-001 - Deny by default

Authorization is least-privilege and server enforced. UI visibility is not authorization.
Every use case checks actor permission and resource ownership inside the authoritative
application operation.

### BR-AUTH-002 - Tenant/resource isolation

Consumers access only their own wallet, receipts, quests, points, and coupons. Merchant
members access only explicitly authorized merchants and resources. Administrator access
is permission scoped, not a universal implicit bypass.

### BR-PRIV-001 - Data minimization

Collect, expose, log, analyze, and send to third parties only the personal data needed
for an approved purpose. Retention, deletion/anonymization, and analytics segmentation
require approved policies (`TBD-010` and `TBD-013`). No regulatory compliance claim may
be made without approved scope and evidence.

## 11. State and concurrency expectations

Exact enum names belong to the domain design, but the model MUST distinguish at least:

- Payment intent: pending versus terminal successful, plus non-success terminal states
  required by the approved expiry/cancellation policy.
- Coupon: usable versus consumed versus expired, and any issuance transition needed for
  atomic exchange.
- Quest assignment: active versus completed versus expired/rejected as applicable.
- Asynchronous work: pending, succeeded, failed, retrying, and dead-letter where
  operationally relevant.

State transition rules:

- Terminal successful payment and successful receipt facts never transition backward.
- Every transition validates expected prior state with optimistic versioning, row lock,
  or atomic conditional update appropriate to contention.
- Unique constraints protect top-up, payment completion, coupon exchange/use, quest
  completion/reward, and event-processing identities.
- Database transactions are short and contain no model-provider or other slow external
  call.

## 12. Analytics rules

### BR-ANALYTICS-001 - Source facts

Sales and impact analytics use committed successful transaction/receipt facts. Pending or
failed payment attempts MUST NOT count as spend, sales, or quest-attributed value.

### BR-ANALYTICS-002 - Defined attribution

Quest-related sales require an approved attribution definition and window (`TBD-009`).
The implementation MUST NOT equate every sale by a consumer with a quest-related sale.

### BR-ANALYTICS-003 - Version and freshness

Metric formula/version, reporting time boundary, filters, and data freshness/as-of time
MUST be explicit. Late events and corrections MUST be handled by a documented projection
policy without changing source history.

### BR-ANALYTICS-004 - Workload isolation

Analytics MUST NOT destabilize payment workloads. Read models, pre-aggregation, replicas,
or a separate analytics path may be introduced only with measured need and an operational
plan.

## 13. Failure and edge-case decision table

| Condition                                      | Required result                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Duplicate payment confirmation                 | Return original committed outcome; no additional debit/receipt/coupon use            |
| Concurrent confirmations for one intent        | At most one success; all others observe the same terminal state or a stable conflict |
| Insufficient wallet balance                    | Atomic rejection; no successful receipt or downstream reward                         |
| Response lost after commit                     | Same idempotency identity retrieves the committed result                             |
| QR invalid, tampered, expired, or replayed     | Reject before value movement and record safe security telemetry                      |
| Coupon invalid/foreign/expired/consumed        | Reject; no coupon or wallet mutation                                                 |
| Two uses of one coupon                         | At most one payment may commit with that coupon                                      |
| Discount reduces spend below quest threshold   | Quest remains incomplete                                                             |
| Two receipts each satisfy only part of a quest | Quest remains incomplete                                                             |
| Duplicate/reordered receipt event              | Deterministic existing evaluation; no duplicate reward                               |
| Receipt event processed after quest expiry     | Follow approved receipt-time boundary; never processing-time guesswork               |
| Catalog/policy changed after intent or receipt | Use frozen historical snapshot/version                                               |
| AI malformed, adversarial, or unavailable      | Reject or safe deterministic fallback; no unearned value                             |
| Expiry worker rerun                            | Same final state and no duplicate ledger movement                                    |
| Reconciliation mismatch                        | Alert/report discrepancy; do not silently rewrite history                            |
| Cross-account/cross-merchant identifier        | Deny without confirming sensitive resource existence where disclosure is unsafe      |

## 14. Rule-to-requirement traceability

| Rule family                             | Primary requirements                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `BR-MONEY-*`                            | `FR-C02`, `FR-C03`, `FR-C05`, `FR-C08`, `FR-C09`, `FR-M03`, `FR-M05`, `FR-M06`, `FR-S06`, `FR-A04` |
| `BR-CART-*`, `BR-QR-*`                  | `FR-C04`, `FR-C05`, `FR-M02`, `FR-M03`, `FR-M04`                                                   |
| `BR-PAY-*`                              | `FR-C05`, `FR-C06`, `FR-M05`, `FR-M06`, `FR-M08`, `FR-S06`                                         |
| `BR-WALLET-*`                           | `FR-C01`, `FR-C02`, `FR-C03`, `FR-C05`, `FR-M06`                                                   |
| `BR-POINT-*`, `BR-COUPON-*`, `BR-EXP-*` | `FR-C07`, `FR-C08`, `FR-C09`, `FR-C05`, `FR-M03`, `FR-S06`, `FR-A06`                               |
| `BR-AI-*`, `BR-QUEST-*`                 | `FR-C07`, `FR-S01`-`FR-S06`, `FR-A05`, `FR-A06`                                                    |
| `BR-HIST-*`, `BR-AUDIT-*`               | `FR-C02`, `FR-C06`, `FR-C08`, `FR-M08`, `FR-S04`, `FR-A02`-`FR-A06`, `NFR-OBS-01`                  |
| `BR-AUTH-*`, `BR-PRIV-*`                | All actor-facing requirements and `NFR-SEC-*`/`NFR-PRIV-*`                                         |
| `BR-ANALYTICS-*`                        | `FR-M07`, `FR-A01`, `FR-A07`                                                                       |

## 15. Change-control gate

Any proposed change that weakens a MUST/MUST NOT rule, adds real money, adds refunds,
aggregates receipts for quest completion, adds a new point use, makes AI authoritative,
or permits mutation of historical facts requires all of the following before code:

1. An explicit product decision referencing affected `FR-*`, `NFR-*`, and `BR-*` IDs.
2. Updated acceptance criteria and negative/concurrency tests.
3. Data migration and backward-compatibility plan where stored meaning changes.
4. Security, privacy, accounting, and audit-impact review.
5. Rollout, reconciliation, and roll-forward/rollback strategy.

Until that gate is complete, the existing invariant remains authoritative.
