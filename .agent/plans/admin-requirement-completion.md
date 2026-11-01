# Non-account admin operations

## Outcome

Complete supported non-account admin workflows with the existing blue/white theme.

## Requirements

FR-A01: refresh/retry and stale requests cannot replace another tab's result.
FR-A02/FR-M01: merchant status actions have transactional status checks; inactive
stores cannot manage catalog. FR-A04: edit unused subsidy policies, preserve
used policies, validate dates and supported THB/Asia/Bangkok values. FR-A05: show
stored proposal/candidate and assignment evidence with truthful nullable provenance;
filter eligible consumers before individual generation. FR-A06: explicit ACTIVE
quest counts and histories/expiry/empty states. FR-A07: clearly distinguish
cumulative totals from selected trend period. User explicitly excludes ALL account,
identity and password modifications; FR-A03 remains unchanged.

## Current State

Existing seven-tab admin portal has working APIs. Account/password attempts were
cancelled by user; all changes in those files were removed. There is no durable
audit table or batch job infrastructure. Currency/calendar are fixed by prototype.

## Invariants and Risks

No live database mutations, migration, new accounts, credentials or password work.
Historical receipts/ledgers/policy must not be rewritten. Server validates all
mutations; stale UI responses cannot replace current tab results. AI content is
untrusted, output is allowlisted and React renders text safely. Merchant sanctions
must not suspend an owner's other roles or merchants.

## Decisions

Preserve current individual generation; cohort filter does not run bulk jobs.
Expose missing evidence honestly instead of inferring generic validation success.
Supported currency/calendar are fixed, not configurable FX. Protect used policy
via transaction and lock; new economic terms use a new program. Keep existing
structured audit logs; durable audit storage remains a documented requirement gap.

## Execution Steps

1. Completed: primary implements program editor and safe data-loading/UI states.
2. Completed: architect adds merchant catalog status enforcement and regressions.
3. In progress: engineer enhances admin service program policy, diagnostics and counts.
4. Pending: primary integrates exact contracts, runs final suites and updates checklist.

## Verification

Program editor tests: 3 passed. Quest details: 2 passed. Admin page tests including
navigation/filter/retry and stale responses: 11 passed before latest monitoring
additions. Catalog tests: 6 passed. Web typecheck passed; lint had existing warnings
and new FormData warnings (subsequently corrected). Final API/web tests, lint,
build and HTTP E2E pending after backend integration. No live mutation E2E claim.

## Rollout and Recovery

No migration or backfill. Deploy API/web together. Rollback view changes without
rewriting data. Merchant reactivation is an authorized lifecycle action, not a
manual database edit. Preserve referenced programs, create a replacement version.

## Progress Log

- 2026-10-28: Requirements/schema review and bounded agent workstreams established.
- 2026-10-28: User excluded account/password work. Restored only tracked auth files
  clean before this turn, removed new account files and abandoned endpoint wiring.
- 2026-10-28: Program editor, cohort filter, diagnostic UI, stale-request regression,
  monitoring dates/empty states and explicit reporting-window copy implemented.
- 2026-10-28: Inactive merchant catalog access blocked; six unit regressions passed.

## Open Questions

Durable segment batch jobs, granular admin permissions and database-backed audit
remain outside the non-account scope and require separate requirement decisions.

## Resumed scope: FR-A06 only (2026-10-28)

The user paused all AI work and requested the points/coupon monitoring screen be
made usable. Reproduced live P2022 (`user_quests.cancelled_at` absent) through a
read-only AdminService call. Replaced broad scalar includes in the three recent
history queries and nested point-source relations with explicit selects. Added
stable ID ordering, corrected a trend-window hint incorrectly shown on this
screen, and added a regression preventing cancellation metadata reads.

Acceptance evidence: 20 admin API tests and 13 admin page tests passed; API/web
production builds passed. A repeated real read-only database call successfully
returned summary plus quest/point/coupon histories. No AI changes, credential
changes, migration, financial/reward mutations, or new policy in this resumed
scope. Database schema drift remains for its separate quest migration; this
report no longer reads unused cancellation columns. Final browser interaction
was not performed and no full requirement completion is claimed.
