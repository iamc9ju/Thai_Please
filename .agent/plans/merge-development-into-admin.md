# Merge development into admin

## Outcome

Resolve the ongoing merge of development 4247db7 into admin b9a451c, preserving
both branches' compatible features and passing relevant tests/builds before a
merge commit. No new product features, live migration or account changes.

## Requirements

FR-A02/FR-M01: retain search, bulk confirmations, expectedStatus row-lock checks
and store suspension. FR-A04: preserve referenced program safety. FR-A06: keep
explicit monitoring projections (P2022 fix). Incoming requirements add multi-type
merchant registration, loading lifecycle, consumer profile and proposal selection;
retain their existing implementations/contracts without redesigning AI.

## Current State

Nine conflicted files, no separate unstaged user changes reported by initial git
status; all other incoming changes staged. .env.example deletion and changed
AGENTS are incoming tracked changes, not generated actions. Do not modify .env.

## Invariants and Risks

Preserve legacy merchant_type nullable column and incoming merchant_types array;
never rewrite already applied migrations. Incoming registration uses allow-listed
array values; legacy scalar reads remain compatible. No running migrations against
live DB. Preserve expectedStatus/transactions/reward projections. Don't weaken
checks or drop tests to make merge pass. Inspect pending dependency lockfile needs.

## Decisions

Resolve localization by retaining both shell keys and incoming quest-audit keys.
Use incoming contracts for new proposal selection while preserving existing admin
operations. Prefer one request-lifecycle mechanism over duplicated stale handling.

## Execution Steps

1. Architect merge_auth_schema owns schema, auth DTO/service and registration E2E.
2. Architect merge_admin_service owns admin service only.
3. Engineer merge_admin_frontend owns dashboard, types and dashboard tests.
4. Primary owns localization, integration, dependency readiness, final verification,
   staging conflict resolutions and completing the authorized merge.

## Verification

Passed: no conflict markers; Prisma validate/generate; API/web strict typechecks; API 224 tests passed (11 opt-in database tests skipped), web 155 tests passed, HTTP E2E four tests passed, production builds and lint (existing frontend warnings). Resolved source formatting and reviewed contracts. No live database changes or migrations.

## Rollout and Recovery

This is source integration only. Existing additive migrations remain separately
reviewable/deployable; no automatic migration command. Keep both history parents.
Never abort/reset or overwrite unrelated data. If blocked, preserve merge state.

## Progress Log

2026-10-28: Identified all nine conflicts and assigned non-overlapping ownership.
Localization conflict resolved by retaining both feature sets.

## Open Questions

None initially; material requirement conflicts require explicit evidence/decision.

2026-10-28: Resolved nine files, retained both merchant columns, incoming validated
merchantTypes registration and backward-readable legacy type. Admin filters match
any new type and old scalar values. Used LoadingState/useLatestRequest while
preserving confirmations/expectedStatus, program safety and P2022 monitoring fix.
AI incoming proposal handling delegates to existing QuestsService; no new AI
algorithm. Corrected audit targetId frontend type to string|null to match API.
Frozen lockfile install passed supply-chain verification. Preparing authorized
merge commit after final source-format and marker checks. New incoming migrations
remain unapplied to live database; deployment must apply them separately.
