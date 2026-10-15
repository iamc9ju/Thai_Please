# Gemini quest generation

## Outcome / acceptance

FR-C07, FR-S01–05, FR-A05: Admin generates for an active consumer with UUID idempotency key; consumer reads only own assignments. Summaries/candidates follow policy. Gemini ranks only eligible candidates. Persist assignment plus immutable policy/audit snapshot, reserve budgets atomically; replay never duplicates. No payment/reward completion or daily scheduler in this increment, as established in conversation.

## Current state

Nest modular monolith, Prisma PostgreSQL, cookie AuthGuard/RolesGuard. Policy is consumed by generation. Extend the existing quest_generation_logs with durable claim/audit/reservation metadata and an optional assignment link; preserve legacy rows and their generation IDs. Do not introduce a second audit table.

## Risks / decisions

Level 4 transactional assignment boundary. Independent bounded workers own Gemini provider and pure candidate math; primary owns integration, repository, migration, authorization and verification. Never call network within a transaction. Global PostgreSQL advisory transaction lock serializes short budget/claim/finalize writes; durable pending leases reserve budget and stop duplicate calls. Recheck active/duplicate/eligibility/catalog/budget on finalize. No process-local authoritative state. Expired pending leases cannot finalize. No production data/network calls during tests; PostgreSQL tests use an isolated schema if a local test DB is available.

## Steps

1. Inspect requirements/config/auth/schema (complete).
2. Add pure summary/candidates and Gemini adapter in parallel; add generation-run migration and five main Nest files.
3. Integrate contracts, environment, assets, documentation and tests.
4. Run unit, type, lint/build and real PostgreSQL migration/concurrency tests; risk review; record limitations accurately.

## Verification

Negative payload/provider coverage, monetary allocation, cutoff/ownership, unauthorized roles, no PII, duplicate request, concurrent assignment/budget, expiry/lease, fresh migration and current build. Model live quality cannot be claimed without configured key and external evaluation.

## Rollout / recovery

Apply additive migration before enabling module use. Existing quests/logs unchanged. Config optional; generation without key fails safely. Revert app then retain additive table for audit; no destructive rollback. Lease recovery by new request under global lock after pending expiration; no automatic value issuance. Schema includes checks/FKs/indexes; no backfill required. Small new-table lock risk only. Validation queries in runbook.

## Progress

2026-10-16: Implementation complete for the scoped manual Admin generation and Consumer list. Independent provider/candidate work integrated and reviewed. API unit/HTTP-contract suite: 102 passed; 5 opt-in PostgreSQL cases skipped there and independently run against a random disposable schema: 5 passed. Existing HTTP E2E: 2 passed. TypeScript passed, lint passed without warnings, Nest production build passed; policy asset verified in dist/src/quests/config. Prisma client generated from source. git diff --check passed. Review found and fixed fractional-average rounding, missing candidate conditions in provider payload, stale leases, credential/model pairing, retry classification, policy/candidate snapshot mismatch, catalog row races and pre-history idempotent replay. Regression tests cover these boundaries. No Gemini live call or app-schema migration was performed. Manual setup and residual limitations documented in docs/ai/QUEST_BACKEND_TH.md.

## Open questions

No policy authority missing; user authorized defaults. API key/model deployment settings user-owned. Existing payment completion remains separate work and must not be claimed delivered.

## Build asset regression

2026-10-16: Runtime reported ENOENT at dist/quests/config/quest-policy.json. Current tsconfig.build.json has rootDir src, so the explicit asset outDir dist/src was incorrect. Set asset outDir dist and enable watchAssets. Added `test:build` Node smoke test that constructs the compiled QuestsService and therefore loads/validates the actual packaged policy, without DB/AI calls. Production build and compiled smoke test both passed. Prior asset-path verification did not instantiate the compiled service and was insufficient; use this regression test after build going forward.

## Revision: consolidate existing audit table

2026-10-16: User explicitly requests using quest_generation_logs instead of a second run table. Replace the unapplied run-table migration with an additive ALTER of existing logs. Preserve generation_id and all legacy rows/fields; generated_quest_id becomes nullable, existing scores/reason/generated_at are reused. Legacy rows use status LEGACY; only non-legacy rows require run metadata and state consistency. Request UUID remains unique, assignment is unique, budget/lease behavior unchanged. Never drop an existing live run table or rewrite applied migrations; previous migration was not applied to app schema in this session. Verify both empty and legacy-row upgrade, concurrency, failure records and all regression checks before completion.

Consolidation completed: old unapplied migration and its empty directory removed; Prisma model and repository target the existing log. Legacy upgrade preserves existing score/reason/quest ID. 102 API tests passed; 6 real PostgreSQL integration tests passed independently, including legacy preservation and absence of a run table, also with Asia/Bangkok session timezone. Explicit UTC conversion protects reused generated_at; qualifying consumer-role rows are locked during finalization. Prisma generation, TypeScript, lint and build passed. App database unchanged; only disposable test schemas were created/deleted. Migration rollout still required before using the module.
