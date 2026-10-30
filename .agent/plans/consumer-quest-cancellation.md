# Consumer quest cancellation

## Outcome

Consumers may cancel their active quest after confirming the exact next eligibility timestamp in Thai local time. Cancellation forfeits the assignment reward and preserves the original entitlement cycle.

## Requirements

FR-C07, FR-S02: owner-only ACTIVE/unexpired cancellation; confirmation before mutation; original seven-day cycle retained; no reward on cancelled assignments. Retries are idempotent. Completed/expired/system-cancelled assignments reject cancellation. Non-goals: administrator entitlement refunds, other quest policy changes.

## Current State

UserQuest already stores cancelledAt, cancellationReason, nextEligibleAt. QuestsRepository.cycle currently excludes all CANCELLED assignments; policy retirement cancellations must remain exempt while user cancellations retain their cycle. Completion locks user_quests. QuestsView displays cancelled history but has no cancellation action.

## Invariants and Risks

Cancellation must serialize with reward completion using the assignment lock. Ownership is checked server-side. Mutation requires consumer role and allowed Origin. No point reversal or balance changes. Legacy missing entitlement timestamps need an explicit server policy. A stale confirmation never bypasses state validation.

## Decisions

GET own assignment cancellation preview returns assignmentId and nextEligibleAt. POST cancel with empty JSON returns the same and CANCELLED status. USER_CANCELLED records voluntary cancellation distinctly from policy retirement. Persisted timestamps and reason plus structured events provide audit evidence. Native modal dialog provides focus containment and keyboard handling.

## Execution Steps

1. Architect owns API repository/controller/service, shared cancellation contracts, backend tests; inspect concurrency and preserve retirement behavior.
2. Root owns web API adapter, localized confirmation dialog, quest view integration, frontend tests and requirements documentation.
3. Root integrates and runs targeted tests/type checks and risk review. The delegated reviewer hit its usage limit, so primary reviewed ownership, row locks, generation serialization, cooldown and UI lifecycle directly.

## Verification

Backend ownership, origin, state, expiry, retry, retained cooldown, concurrency tests. Frontend preview before submit, close without mutation, Thai timestamp, pending duplicate prevention, retry and success refresh. Static checks and affected test suites. Record actual outcomes below.

## Rollout and Recovery

Additive API rollout first, then UI. Existing schema should suffice; verify constraints before implementation. UI rollback hides entry point but persisted USER_CANCELLED history and cooldown must remain preserved. No historical financial records rewritten.

## Progress Log

- 2026-10-30: User approved cancellation with original cycle retained and explicit confirmation timestamp. Backend and frontend ownership separated; implementation in progress.
- 2026-10-30: Implemented API, shared contract, Thai native confirmation dialog, history refresh, and retained USER_CANCELLED cooldown. Primary completed backend integration after delegated agent hit its usage limit.
- Legacy null eligibility resolved as assignedAt + configured cycleDays, persisted only at cancellation; no schema migration. Generation advisory lock added to serialize the legacy transition with selection. READ COMMITTED and assignment row locks serialize cancellation with reward completion.
- Initial frontend test polyfill was corrected for jsdom's missing showModal. HTTP tests needed localhost access outside sandbox. PostgreSQL fixture lacked the existing product recommendation migration; added it to the isolated setup. Remote integration timeout was increased via test command to 30 seconds for network round trips without changing application transaction limits.
- Evidence: full PostgreSQL workflow 17/17 passed, including three completion/cancellation orderings; frontend API/dialog/view 21/21 passed; HTTP controller 7/7 passed; service 11/11 passed. API and web TypeScript checks passed; affected-file lint clean after fixing new warnings. Nest and Vite production builds succeeded. Final targeted DB/HTTP recheck after explicit isolation annotation passed 13/13 selected tests (74 unrelated tests excluded by name filter). Implementation and verification complete.
- FR-C07: confirmation/Thai time, no mutation on dismissal, pending guard, retry, history covered by web tests; ownership/expiry/cooldown/retirement covered by HTTP and PostgreSQL tests. FR-S02: one terminal transition and no cancelled reward covered by real PostgreSQL race tests. Rollout/recovery documented in docs/quest-cancellation.md.

## Open Questions

- None. No administrator refund capability added. Native dialog behavior is covered structurally/component-wise; no manual browser visual QA was performed.
