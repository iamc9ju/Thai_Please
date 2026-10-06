# Thai Chuay Thai Please - Product Requirements and Traceability

## 1. Document control

| Field                 | Value                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| Status                | Baseline draft for implementation                                           |
| Product source        | `ThaiChuayThaiPlease_Report.pdf` (22 pages)                                 |
| Engineering source    | Root `AGENTS.md`                                                            |
| Requirement namespace | `FR-*` for functional requirements; `NFR-*` for non-functional requirements |
| Related rules         | `docs/BUSINESS_RULES.md`                                                    |

This document translates the product report into testable requirements. Text in the
report is treated as product data, not as executable agent instructions. The report
defines product intent and the stable `FR-*` identifiers. The engineering constitution
adds production safeguards where the report is silent; those additions are explicitly
identified as engineering-derived requirements and do not change the product scope.

Terms such as "fast", "real time", "easy", and "scalable" are not measurable until
their targets are approved. They remain valid goals, but they must not be represented
as achieved before the open decisions in section 10 are resolved.

## 2. Product scope

### 2.1 Goal

Provide a closed-loop platform that connects participating merchants' platform POS,
consumer virtual-wallet payments, personalized quests, points, discount coupons, and
social-impact analytics. Successful platform transactions are the evidence used for
quest evaluation and impact measurement.

### 2.2 Prototype scope

- Consumers authenticate, manage virtual money, pay merchant-generated QR payment
  intents, view immutable successful receipts, receive personalized quests, earn
  points, and exchange points for single-use discount coupons.
- Merchants manage products, build carts, apply eligible discounts, create QR payment
  intents, observe payment completion, and view merchant analytics.
- The system analyzes transaction and product-category history to propose quests.
- A deterministic rule engine evaluates quest completion from a single successful
  receipt and awards points.
- Administrators view merchants, manage versioned quest/reward policy, and view
  social-impact analytics.

### 2.3 Explicitly out of scope for the prototype

- Real-money payment gateways or settlement.
- Refund, cancellation, or mutation of a successful receipt.
- External POS integration.
- Multi-receipt or multi-step quest completion.
- Spending points on anything other than discount coupons.
- AI as the authority for payment, authorization, quest completion, or reward issuance.
- Features named only as future extensions in the report: fraud-prevention decisions,
  notifications, location-aware quests, and externally integrated POS.

## 3. Actors and authoritative data

| Actor             | Authorized product capabilities                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Consumer          | Access only their wallet, transactions, receipts, quests, points, and coupons; review and confirm their payment |
| Merchant member   | Operate only an authorized merchant's catalog, POS, payment status, and analytics                               |
| Administrator     | View merchant information, manage quest/reward policy, and view platform social-impact analytics                |
| AI quest service  | Produce schema-constrained quest proposals; never approve value movement                                        |
| Quest rule engine | Deterministically evaluate approved quest rules against successful receipt snapshots                            |
| System jobs       | Process expiry, reconciliation, analytics, and reliable events idempotently                                     |

Authoritative totals, ownership, role, prices, discounts, payment status, coupon status,
quest completion, and balances are computed or verified server-side. Client-supplied
values are requests or display data, never authoritative facts.

## 4. Functional requirements

The `AC` identifiers below are stable acceptance-criterion identifiers. Each criterion
requires authorization and input-validation tests in addition to the behavior stated.

### FR-C01 - Consumer account overview

The system shall allow an authenticated consumer to view their virtual-wallet balance,
point balance, assigned quests, and owned coupons.

- `FR-C01-AC01`: Given an authenticated consumer, when the overview is requested, then
  the system returns only data owned by that consumer.
- `FR-C01-AC02`: Wallet and point balances shown in the overview equal the corresponding
  immutable ledger totals or a reconciled projection of those ledgers.
- `FR-C01-AC03`: Quests expose condition, reward, status, and expiry; coupons expose
  discount terms, status, and expiry.
- `FR-C01-AC04`: Loading, empty, stale, error, and permission-denied states are
  distinguishable without exposing internal errors.
- Edge cases: no wallet activity, no quests, no coupons, expired items, stale projection,
  cross-account identifier, and revoked session.
- Verification: API authorization/contract integration tests; ledger projection tests;
  consumer overview end-to-end test; accessibility check.

### FR-C02 - Virtual-money top-up and wallet history

The system shall support prototype virtual-money top-up and show wallet transaction
history.

- `FR-C02-AC01`: A valid top-up creates exactly one immutable wallet-ledger credit and
  exposes the resulting transaction in the owner's history.
- `FR-C02-AC02`: Repeating the same top-up request with the same idempotency identity
  returns the original outcome and does not create another credit.
- `FR-C02-AC03`: Invalid, unauthorized, zero, negative, overflow, or unsupported-currency
  amounts are rejected without value movement.
- `FR-C02-AC04`: History is owner-scoped, ordered deterministically, paginated, and
  sufficient to explain the displayed balance.
- Edge cases: concurrent retry, timeout after commit, maximum accepted amount, expired
  session, and reconciliation mismatch.
- Verification: wallet domain unit tests; PostgreSQL transaction/idempotency integration
  tests; owner authorization and history contract tests; top-up end-to-end test.

### FR-C03 - Scan, review, and pay by QR

The system shall allow a consumer to scan a platform POS QR payment token, review the
authoritative cart snapshot and discounts, and explicitly confirm payment using virtual
money.

- `FR-C03-AC01`: A valid, unexpired QR token resolves to one pending server-side payment
  intent containing merchant, immutable cart snapshot, discounts, and final amount.
- `FR-C03-AC02`: Confirmation debits the consumer wallet and completes the payment at
  most once in one transaction; retries return the original outcome.
- `FR-C03-AC03`: Insufficient balance rejects atomically and creates neither a successful
  receipt nor a successful transaction.
- `FR-C03-AC04`: Tampered, expired, already-consumed, wrong-merchant, or unknown tokens
  cannot move value.
- `FR-C03-AC05`: The final amount is recalculated server-side after all valid discounts;
  no client-provided total is trusted.
- `FR-C03-AC06`: Pending and terminal outcomes are deterministic and duplicate UI
  submission cannot cause duplicate debit.
- Edge cases: two concurrent confirmations, QR expiry during review, coupon becoming
  unavailable before confirmation, price/catalog changes after intent creation, timeout
  after commit, and consumer attempting to pay another consumer's intent.
- Verification: payment state-machine unit tests; real-PostgreSQL concurrency,
  isolation, and replay tests; QR security contract tests; scan-and-pay end-to-end tests.

### FR-C04 - Spending history and immutable receipt

The system shall show the consumer's successful spending transactions and receipt
details.

- `FR-C04-AC01`: History contains only the authenticated consumer's successful payments
  and is deterministically paginated.
- `FR-C04-AC02`: A receipt records the immutable merchant, line-item, category, quantity,
  unit-price, pre-discount amount, discount, final amount, currency, and transaction-time
  facts required to reproduce the sale.
- `FR-C04-AC03`: A successful receipt cannot be edited, canceled, deleted, or refunded
  through the prototype product paths.
- `FR-C04-AC04`: Later catalog, merchant, coupon, or policy changes do not alter receipt
  facts.
- Edge cases: missing projection, renamed/deactivated product, deleted consumer request,
  cross-account access, and duplicate payment retry.
- Verification: receipt immutability and ownership integration tests; history contract
  tests; receipt end-to-end test.

### FR-C05 - Automatically assigned personalized quests

The system shall automatically display personalized AI-proposed quests with conditions,
point rewards, and expiry, without requiring consumer acceptance.

- `FR-C05-AC01`: An approved quest assignment becomes visible to its owner immediately
  after assignment without an accept action.
- `FR-C05-AC02`: Each displayed quest exposes a human-readable localized description and
  the exact deterministic rule, reward, status, and expiry represented by that text.
- `FR-C05-AC03`: Invalid, out-of-policy, duplicate, or unparseable AI output is rejected
  and cannot create an active quest or award value.
- `FR-C05-AC04`: One consumer cannot view another consumer's assignment or behavioral
  features.
- Edge cases: no transaction history, AI unavailable, invalid proposal, duplicate
  generation cycle, immediate expiry, and policy changed after assignment.
- Verification: proposal-schema and policy unit tests; assignment idempotency integration
  tests; AI failure-path tests; quest-list end-to-end test.

### FR-C06 - Point balance and history

The system shall allow a consumer to view point balance and point earning/use history.

- `FR-C06-AC01`: The displayed point balance equals immutable point-ledger entries or a
  reconciled projection.
- `FR-C06-AC02`: History distinguishes earn, redeem, and expiry entries, with safe source
  references and timestamps sufficient to explain the balance.
- `FR-C06-AC03`: Point history is owner-scoped, deterministically ordered, and paginated.
- `FR-C06-AC04`: Expired points are not spendable and expiry processing cannot debit the
  same point allocation more than once.
- Edge cases: partial allocation expiry policy unresolved, simultaneous reward and
  redemption, zero balance, and reconciliation mismatch.
- Verification: point-ledger unit/integration tests; authorization/contract tests;
  history end-to-end test.

### FR-C07 - Exchange points for and use a coupon

The system shall allow a consumer to exchange eligible points for a discount coupon,
view coupon status, and use each coupon once.

- `FR-C07-AC01`: A valid exchange atomically creates one point-ledger debit and one
  ownership-bound coupon; a retry creates neither a second debit nor a second coupon.
- `FR-C07-AC02`: Insufficient or expired points reject the exchange without issuing a
  coupon or changing the ledger.
- `FR-C07-AC03`: Coupon use validates ownership, eligibility, active status, expiry, and
  applicable merchant/category/amount constraints at payment confirmation.
- `FR-C07-AC04`: Coupon consumption and successful payment are atomic; a failed payment
  does not leave a coupon consumed.
- `FR-C07-AC05`: Concurrent attempts to use one coupon produce at most one successful
  payment using that coupon.
- Edge cases: coupon expires during checkout, incompatible cart, repeated exchange,
  concurrent use, payment failure, and cross-account coupon identifier.
- Verification: exchange/redemption domain tests; real-PostgreSQL concurrency and
  rollback tests; authorization contract tests; redeem-and-use end-to-end test.

### FR-M01 - Merchant product management

The system shall allow an authorized merchant member to add and manage platform POS
products, including name, price, and category.

- `FR-M01-AC01`: Create/update/deactivate operations validate required product fields,
  precise non-negative price, supported currency, and an allowed category.
- `FR-M01-AC02`: Merchant members can mutate only products belonging to merchants for
  which they have the required permission.
- `FR-M01-AC03`: Product changes affect future carts only and never rewrite historical
  cart or receipt snapshots.
- `FR-M01-AC04`: Product mutation emits an attributable audit event without logging
  sensitive data.
- Edge cases: duplicate name policy unresolved, deactivated category, product referenced
  by an open cart, concurrent update, and cross-merchant access.
- Verification: validation/domain tests; ownership and optimistic-concurrency integration
  tests; merchant catalog end-to-end test.

### FR-M02 - POS cart construction and totals

The system shall allow an authorized merchant member to select products and quantities,
build a cart, and calculate sale totals.

- `FR-M02-AC01`: The server resolves products, validates sale eligibility and quantity,
  and calculates line totals and pre-discount total using precise monetary arithmetic.
- `FR-M02-AC02`: The cart belongs to one merchant and cannot contain products from another
  merchant.
- `FR-M02-AC03`: Creation of a payment intent freezes the exact cart/pricing snapshot to
  be reviewed and paid.
- `FR-M02-AC04`: Invalid, inactive, unavailable, zero, negative, fractional-when-disallowed,
  or excessive quantity is rejected according to approved policy.
- Edge cases: price changed while cart is open, repeated line, product deactivation,
  empty cart, and concurrent merchant edits.
- Verification: pricing domain tests; cart repository/ownership integration tests; POS
  cart end-to-end test.

### FR-M03 - Discount application before final total

The system shall validate and apply an eligible coupon/discount before calculating the
final payable amount.

- `FR-M03-AC01`: Discount eligibility and amount are computed server-side from versioned
  rules; client-provided discount totals are ignored.
- `FR-M03-AC02`: The payment-intent snapshot records pre-discount amount, each applied
  discount, and final amount.
- `FR-M03-AC03`: Final amount cannot be negative and follows an approved rounding and
  discount-stacking policy.
- `FR-M03-AC04`: An invalid, expired, consumed, unauthorized, or inapplicable coupon is
  rejected with a stable error and no coupon state change.
- Edge cases: discount exceeds subtotal, multiple-discount stacking policy unresolved,
  exact-expiry boundary, and cart changes after validation.
- Verification: discount calculation unit/property tests; coupon constraint integration
  tests; discounted checkout end-to-end test.

### FR-M04 - QR payment intent and merchant status

The system shall generate a QR payment token from the frozen final amount and show the
merchant when the consumer payment succeeds.

- `FR-M04-AC01`: QR generation creates one pending payment intent bound to the merchant,
  cart snapshot, final amount, currency, expiry, and unguessable integrity-protected token.
- `FR-M04-AC02`: The token contains no secret or mutable client-authoritative sale data
  and cannot be replayed for another intent.
- `FR-M04-AC03`: Merchant status changes reflect the committed payment state and never
  report success before wallet debit and receipt creation commit.
- `FR-M04-AC04`: Expired or canceled-pending intent behavior is deterministic; a successful
  intent remains immutable.
- Edge cases: merchant opens multiple status views, delayed event, polling retry,
  disconnect after consumer commit, and token disclosure.
- Verification: intent/token unit and security tests; payment transaction/outbox
  integration tests; merchant QR/status end-to-end test.

### FR-M05 - Merchant dashboard

The system shall provide authorized merchant analytics for sales amount, transaction
count, top-selling products, coupon use, and quest-related sales.

- `FR-M05-AC01`: Metrics use committed successful transactions and immutable receipt
  facts, with documented metric definitions and time boundaries.
- `FR-M05-AC02`: Results are scoped to the authorized merchant and selected supported
  filters.
- `FR-M05-AC03`: Empty, loading, error, stale-data, and no-permission states are explicit;
  displayed refresh/as-of time identifies analytics freshness.
- `FR-M05-AC04`: Analytics processing cannot block or weaken transactional payment paths.
- Edge cases: no transactions, late projection/event, timezone boundary, deactivated
  product, and transaction attributed to a quest.
- Verification: metric-definition unit tests; aggregate/projection integration tests;
  merchant isolation and dashboard end-to-end tests.

### FR-S01 - Personalized quest proposal

The system shall analyze transaction history and product-category data to produce a
personalized quest proposal.

- `FR-S01-AC01`: Input features are minimized and may include purchase dates, pre/post-
  discount spend, categories, frequency, merchant affinity, and quest history as allowed
  by approved privacy policy.
- `FR-S01-AC02`: Output conforms to a versioned constrained schema containing only
  allow-listed rule types, reward points, and expiry.
- `FR-S01-AC03`: Policy validation bounds eligibility, category/merchant targets, minimum
  spend, reward, expiry, frequency, duplication, and budget before assignment.
- `FR-S01-AC04`: Prompt/model/feature/rule/policy versions needed to explain an assignment
  are recorded without storing unnecessary personal data.
- `FR-S01-AC05`: Unavailable or invalid AI output uses a deterministic safe fallback that
  cannot issue unearned value.
- Edge cases: sparse history, adversarial output, unsupported rule, policy-budget breach,
  duplicate generation, and provider timeout.
- Verification: schema/policy/adversarial evaluation tests; privacy review; generation
  idempotency integration tests; monitored fallback test.

### FR-S02 - Deterministic quest completion

The quest engine shall evaluate each quest against one successful receipt; monetary
conditions use the final amount after every discount.

- `FR-S02-AC01`: Only a committed successful receipt owned by the assigned consumer and
  within the assignment's active time window may prove completion.
- `FR-S02-AC02`: All quest conditions must be satisfied by the same receipt snapshot;
  values from multiple receipts are never aggregated in prototype scope.
- `FR-S02-AC03`: Spend thresholds compare against the receipt's final post-discount amount
  in the same currency and approved precision.
- `FR-S02-AC04`: Evaluation is deterministic for the recorded rule and receipt versions,
  safe to retry, and auditable.
- `FR-S02-AC05`: AI output or model judgment cannot override evaluation outcome.
- Edge cases: exact threshold, discount lowers total below threshold, receipt at expiry
  boundary, category snapshot differs from current catalog, repeated/reordered event,
  and already-completed assignment.
- Verification: rule-engine table/property tests; event replay/idempotency integration
  tests; single-receipt and post-discount end-to-end tests.

### FR-S03 - Reward issuance and expiry

The system shall automatically award points once when a quest succeeds and manage quest,
point, and coupon expiry.

- `FR-S03-AC01`: Completion status and exactly one immutable point-ledger reward are
  committed atomically for a unique assignment-and-receipt proof.
- `FR-S03-AC02`: Duplicate, reordered, delayed, or replayed evaluation cannot create an
  additional reward.
- `FR-S03-AC03`: Quest, point, and coupon expiry uses stored UTC instants, an explicit
  inclusive/exclusive boundary, and idempotent processing.
- `FR-S03-AC04`: Expired value/status is not usable; expiry history remains auditable and
  reconciliation reports rather than silently rewrites inconsistencies.
- Edge cases: worker crash after commit, exact expiry instant, concurrent redemption and
  expiry, late receipt event, and policy change after assignment.
- Verification: transaction/unique-constraint integration tests; concurrency and crash-
  recovery tests; deterministic-clock expiry tests; reward end-to-end test.

### FR-A01 - Administration and social-impact analytics

The system shall allow authorized administrators to view merchant data, manage quest and
reward policy, and view a social-impact dashboard.

- `FR-A01-AC01`: Administrative routes deny by default and require explicit least-
  privilege permissions; every policy mutation records actor, action, target, result,
  timestamp, correlation ID, and safe before/after metadata.
- `FR-A01-AC02`: Policy is validated and versioned; changes apply prospectively according
  to an approved effective-time rule and do not silently rewrite existing assignments.
- `FR-A01-AC03`: Dashboard metrics support approved time, merchant, and category filters
  and include the report-defined measures in section 7.
- `FR-A01-AC04`: Dashboard data exposes its metric version and freshness/as-of time and
  does not expose unnecessary consumer-level personal data.
- Edge cases: concurrent policy update, invalid budget, partial projection lag,
  unauthorized staff, empty period, and merchant with no transactions.
- Verification: admin policy unit/integration tests; authorization and audit negative
  tests; metric validation tests; admin dashboard end-to-end test.

## 5. Non-functional requirements

The first seven groups translate the report's NFR table. Additional groups are required
by the engineering constitution to make the system safe to operate. Numeric service
targets remain TBD unless explicitly approved.

| ID             | Requirement                                                                                                                                                                                        | Origin               | Evidence required                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `NFR-PERF-01`  | POS, wallet, and payment-confirmation interactions shall meet approved latency and throughput targets under the approved load profile.                                                             | Report               | Load-test report with dataset, concurrency, percentiles, and pass/fail target; targets TBD |
| `NFR-PERF-02`  | I/O shall have explicit timeouts; retries shall be bounded, back off with jitter, and be restricted to retry-safe/idempotent operations.                                                           | Engineering          | Configuration tests, failure-injection test, metrics                                       |
| `NFR-SEC-01`   | Authentication, least-privilege RBAC/ABAC, and resource ownership shall protect every actor and object.                                                                                            | Report + engineering | Positive/negative authorization matrix and end-to-end tests                                |
| `NFR-SEC-02`   | QR tokens shall be short-lived, unguessable, integrity protected, single-intent-bound, and replay resistant.                                                                                       | Report + engineering | Threat model, token tampering/expiry/replay tests                                          |
| `NFR-SEC-03`   | Cookie mutations shall use CSRF protection, CORS shall be allow-listed, and risky endpoints shall have actor-aware abuse controls.                                                                 | Engineering          | Security configuration and abuse tests                                                     |
| `NFR-SEC-04`   | Secrets shall stay outside source and logs; SQL shall be parameterized; browser output shall be safely encoded; dependencies shall be scanned.                                                     | Engineering          | Secret/SAST/dependency scans and injection tests                                           |
| `NFR-DATA-01`  | Wallet, point, coupon, payment, transaction, and receipt states shall remain transactionally consistent.                                                                                           | Report               | Real-PostgreSQL transaction, constraint, concurrency, and reconciliation tests             |
| `NFR-DATA-02`  | Successful receipts and value ledgers shall be immutable and historical facts reproducible.                                                                                                        | Report + engineering | Constraint/repository tests and audit queries                                              |
| `NFR-DATA-03`  | Money and rewards shall use explicit currency/units and exact arithmetic, never binary floating point.                                                                                             | Engineering          | Type/schema checks and calculation property tests                                          |
| `NFR-UX-01`    | Merchant POS shall minimize sale-flow friction; consumers shall clearly see wallet, quest, point, coupon, and payment states.                                                                      | Report               | Approved usability criteria and moderated test; criteria TBD                               |
| `NFR-UX-02`    | Changed journeys shall provide loading, empty, stale, error, success, and permission-denied states and prevent duplicate submission.                                                               | Engineering          | Component/end-to-end tests                                                                 |
| `NFR-ACC-01`   | Web flows shall target WCAG 2.2 AA, semantic HTML, keyboard operation, visible focus, sufficient contrast, labels, and live feedback.                                                              | Engineering          | Automated and manual accessibility checks                                                  |
| `NFR-I18N-01`  | User-visible copy shall use typed localization resources with Thai as a first-class locale.                                                                                                        | Engineering          | Localization-key/type check and UI tests                                                   |
| `NFR-SCALE-01` | Stateless API instances and durable PostgreSQL-backed state shall allow horizontal API scaling as users, merchants, products, transactions, and quests grow.                                       | Report + engineering | Architecture review and representative scale/load test                                     |
| `NFR-SCALE-02` | Jobs shall be idempotent, concurrency bounded, retry bounded, and expose failed/dead-letter states where relevant.                                                                                 | Engineering          | Replay/load/failure tests and queue/job metrics                                            |
| `NFR-MAINT-01` | POS, wallet, quest, AI, coupon, analytics, identity, catalog, payment, receipt, point, and administration responsibilities shall remain explicit modular boundaries.                               | Report + engineering | Dependency/architecture checks and review                                                  |
| `NFR-MAINT-02` | Strict TypeScript, versioned REST/OpenAPI, reviewed migrations, and production validation shall be enforced in CI.                                                                                 | Engineering          | CI checks, generated-contract drift check, migration validation                            |
| `NFR-AUD-01`   | Wallet and point history shall explain every balance from immutable ledger entries.                                                                                                                | Report               | Reconciliation tests and audit query demonstration                                         |
| `NFR-AUD-02`   | Privileged actions and value movement shall produce structured, attributable, privacy-safe audit events.                                                                                           | Engineering          | Audit schema and negative/positive integration tests                                       |
| `NFR-REL-01`   | Correctness shall hold under duplicate/reordered/delayed events, partial failure, concurrent value operations, and process restarts.                                                               | Engineering          | Concurrency, replay, and fault-injection tests                                             |
| `NFR-REL-02`   | Deployment shall define liveness, readiness, graceful shutdown, migration safety, job drain, backup, and tested restore.                                                                           | Engineering          | Operational tests/runbooks; RPO/RTO TBD                                                    |
| `NFR-OBS-01`   | Structured logs, metrics, and traces shall carry correlation/causation IDs and redact credentials, tokens, QR secrets, and unnecessary personal data.                                              | Engineering          | Telemetry tests and redaction review                                                       |
| `NFR-OBS-02`   | Alerts/dashboards shall cover payment outcomes, reconciliation, duplicate prevention, coupon conflicts, quest evaluation, reward issuance, job failure/lag, database saturation, and AI rejection. | Engineering          | Dashboard/alert definitions and runbooks                                                   |
| `NFR-PRIV-01`  | Personal data shall be minimized, purpose limited, retained/deleted by approved policy, and not unnecessarily sent to AI providers.                                                                | Engineering          | Data inventory, privacy review, retention tests; policy TBD                                |
| `NFR-AI-01`    | AI output shall be untrusted, schema validated, policy bounded, explainably versioned, and unable to write authoritative value records.                                                            | Engineering          | Schema/policy/adversarial evaluation suite                                                 |

## 6. Cross-requirement journeys

| Journey                 | Requirement coverage                   | Required terminal evidence                                                       |
| ----------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| Consumer overview       | `FR-C01`, `FR-C05`, `FR-C06`, `FR-C07` | Owner-scoped balances and current quest/coupon states                            |
| Virtual top-up          | `FR-C02`                               | One wallet credit, retry-safe outcome, visible history                           |
| Merchant cart to QR     | `FR-M01`, `FR-M02`, `FR-M03`, `FR-M04` | Frozen priced cart and pending single-use intent                                 |
| Consumer review and pay | `FR-C03`, `FR-C04`, `FR-M04`           | One debit, one successful payment, one immutable receipt, merchant success state |
| Insufficient balance    | `FR-C03`                               | Rejection with no debit and no successful receipt                                |
| Quest generation        | `FR-S01`, `FR-C05`, `FR-A01`           | Policy-valid assignment visible without acceptance                               |
| Quest completion        | `FR-S02`, `FR-S03`, `FR-C06`           | One qualifying receipt, one completion, one reward ledger entry                  |
| Point-to-coupon loop    | `FR-C06`, `FR-C07`, `FR-M03`           | One point debit, owned coupon, at-most-once atomic use                           |
| Merchant analytics      | `FR-M05`                               | Merchant-scoped metrics from successful receipt facts                            |
| Social impact           | `FR-A01`, `FR-M05`                     | Versioned, freshness-labeled aggregates with approved filters                    |

## 7. Metric catalogue required by the report

Metric formulas, attribution windows, timezone, inclusion/exclusion, and handling of
projection lag must be approved before implementation. The dashboard shall not invent
these definitions.

- Merchant impact: merchants with at least one successful transaction; merchants with
  quest-attributed sales.
- Economic activity: total final spend; quest-attributed final spend; average sales per
  merchant.
- Consumer activity: active consumers; repeat-purchase rate.
- Gamification: quests assigned; quests completed; quest-completion rate.
- Rewards: points issued; points used; coupon redemption rate; coupon usage rate.
- Distribution: share of sales by merchant and product category.
- AI effectiveness: quest-completion rate by quest type and consumer segment.
- Required views: KPI cards, daily/weekly spend trend, merchant/category bars, funnel
  from assigned quest through coupon use, merchant ranking, and time/merchant/category
  filters.

## 8. Minimum test traceability

Every implementation change shall cite its requirement and acceptance-criterion IDs.
At minimum:

- Domain unit tests cover money, discounts, quest rules, state transitions, and expiry.
- PostgreSQL integration tests cover constraints, ledgers, atomicity, isolation,
  idempotency, outbox behavior, and concurrent payment/coupon/reward operations.
- Contract tests cover OpenAPI schemas, stable error codes, unknown-field rejection,
  authentication, authorization, and ownership.
- End-to-end tests cover every journey in section 6, including negative paths.
- Security tests cover cross-account access, role escalation, token tampering/replay,
  expired resources, injection, CSRF/CORS configuration, rate limits, and data leakage.
- AI tests cover schema validity, policy compliance, adversarial output, regression,
  duplicate generation, budget safety, and unavailable-provider fallback.
- Analytics tests use fixed datasets and independently calculated expected metrics.

## 9. Global edge-case catalogue

The following conditions must be considered wherever applicable and cannot be dismissed
by a sequential happy-path test:

- Duplicate HTTP requests, events, jobs, and callback delivery.
- Two requests attempting the same wallet debit, coupon use, or reward issuance.
- Commit succeeds but response/event publication is interrupted.
- Events arrive late, duplicated, or out of order.
- Resource expires exactly at confirmation/evaluation time.
- Policy, product, price, category, or merchant metadata changes after snapshot creation.
- Authorization changes during an active session or workflow.
- Amount overflow, invalid precision, currency mismatch, zero/negative amount, and
  rounding boundary.
- Projection/cache is stale or reconciliation finds a discrepancy.
- AI output is absent, malformed, adversarial, out of policy, or duplicated.
- Analytics periods cross UTC/user/reporting timezone boundaries.

## 10. Assumptions and unresolved product decisions

No item below may be silently converted into a hardcoded policy. Until approved, use a
versioned, validated configuration only where a safe reversible default is explicitly
authorized; otherwise block the affected production capability.

| ID        | Open decision                                                                                                                   | Affected requirements                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `TBD-001` | Authentication method, identity proofing, session duration, recovery, and consumer/merchant/admin provisioning                  | `FR-C01`, all authorization            |
| `TBD-002` | Virtual-money top-up authority, limits, currency, minor-unit scale, and whether top-up is self-service or admin/demo controlled | `FR-C02`, `FR-C03`                     |
| `TBD-003` | Supported currencies, rounding mode, tax treatment, and price/quantity limits                                                   | `FR-M01`-`FR-M04`                      |
| `TBD-004` | Coupon types, stacking order, caps, eligibility, minimum spend, merchant funding, and discount allocation                       | `FR-C07`, `FR-M03`                     |
| `TBD-005` | QR/payment-intent lifetime, cancellation of pending intents, and the exact inclusive/exclusive expiry boundary                  | `FR-C03`, `FR-M04`                     |
| `TBD-006` | Quest generation cadence, allowed rule types, policy bounds, reward budget, duplicate definition, and AI provider/model         | `FR-C05`, `FR-S01`, `FR-A01`           |
| `TBD-007` | Quest eligibility window and whether the receipt timestamp or processing timestamp determines on-time completion                | `FR-S02`, `FR-S03`                     |
| `TBD-008` | Point expiry model (per allocation or balance policy), consumption ordering, and point-to-coupon exchange catalogue             | `FR-C06`, `FR-C07`, `FR-S03`           |
| `TBD-009` | Reporting timezone, metric formulas, quest-sale attribution, consumer segment definitions, and analytics freshness              | `FR-M05`, `FR-A01`                     |
| `TBD-010` | SLOs, load profile, data-volume forecast, availability, RPO/RTO, and retention/deletion policy                                  | All NFRs                               |
| `TBD-011` | Merchant membership roles/permissions and admin permission granularity                                                          | `FR-M01`-`FR-M05`, `FR-A01`            |
| `TBD-012` | Product-category taxonomy, category ownership, stock/inventory behavior, duplicate product naming, and fractional quantities    | `FR-M01`, `FR-M02`, `FR-S01`, `FR-S02` |
| `TBD-013` | Exact policy for consumer account deletion/anonymization while retaining auditable financial facts                              | `FR-C01`-`FR-C07`, `NFR-PRIV-01`       |
| `TBD-014` | Usability success criteria and target-device/browser support                                                                    | `NFR-UX-01`, `NFR-ACC-01`              |

## 11. Completion rule

A requirement is complete only when all its acceptance criteria are implemented, its
authoritative server and database invariants are enforced, negative and concurrency
paths are verified where relevant, contracts and operational telemetry are current, and
the evidence is linked to the corresponding `FR-*`, `NFR-*`, and `AC` identifiers. A UI
happy path alone is never completion.
