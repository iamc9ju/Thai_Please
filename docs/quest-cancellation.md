# Consumer quest cancellation (FR-C07)

Approved behavior: consumers can cancel their own ACTIVE, unexpired assignment after a confirmation showing server-provided eligibility in Asia/Bangkok. No points are issued, the assignment cannot resume, and cancellation does not restart or refund the seven-day cycle.

## API

- `GET /api/v1/consumer/quests/:assignmentId/cancellation`: own assignment preview `{ assignmentId, nextEligibleAt }`.
- `POST /api/v1/consumer/quests/:assignmentId/cancel`: empty JSON object; returns `{ assignmentId, nextEligibleAt, status: "CANCELLED" }`. Requires a consumer session, JSON content type and trusted Origin.
- IDs are validated positive database identifiers. Foreign/missing assignment returns 404. Non-active, expired, or policy-cancelled assignments return 409. Additional request properties are rejected.
- POST is naturally idempotent by assignment: an already USER_CANCELLED assignment returns its original eligibility without updating its cancellation timestamp or emitting another success event. A preview of that assignment also remains available for uncertain-response retries.

## Persistence and concurrency

Existing `user_quests.cancelled_at`, `cancellation_reason`, and `next_eligible_at` are used; no migration is needed. `USER_CANCELLED` retains the cycle; existing system-policy cancellation reasons retain their exemptions. For historical null eligibility only, derive assigned_at + configured cycleDays (currently seven) and persist it during cancellation. Never derive from the cancellation time.

The existing generation advisory lock serializes with proposal selection, including legacy null cycles. A `FOR UPDATE` assignment lock and explicit READ COMMITTED transaction serialize with reward completion. If completion wins, cancellation conflicts. If cancellation wins, completion observes CANCELLED and issues no reward. Paid receipts are not modified.

## Operations and recovery

Successful first cancellation emits `quest_cancelled_by_consumer` with user, assignment, and next eligibility identifiers. Persisted user identity, cancellation timestamp and reason are the durable audit record. Inspect those fields when investigating disputes; never clear eligibility to resolve a routine user cancellation. Reconcile that USER_CANCELLED assignments have no completion/reward ledger entry. This change introduces no administrator refund operation.

Deploy backend before frontend. On rollback, hide the UI action but retain USER_CANCELLED cycle handling; reverting that handling would incorrectly refund existing cancellations. Do not reactivate assignments or remove their audit metadata.

## Validation

`quests.repository.integration.spec.ts` uses an isolated random PostgreSQL schema, with real row locks and cleanup. Coverage includes cross-account rejection, simultaneous retries, expiry boundary, original cooldown, legacy timestamp fallback, system-policy exemptions, and cancellation versus completion in both orders and concurrently. The remote database run uses `--testTimeout=30000` because the fixture and selection workflow span multiple database round trips; application transaction limits are unchanged.

HTTP controller tests cover session identity, roles, trusted Origin, input validation and response contract. Browser component/API tests cover the confirmation timestamp, no mutation on dismissal, disabled duplicate submission, retry after uncertain response, conflict/access errors, response validation and history refresh. Native modal focus containment is browser-provided; tests simulate modal activation in jsdom, not a full browser visual check.
