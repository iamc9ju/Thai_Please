# Quest proposal selection ExecPlan

## Outcome

Consumers receive up to three validated AI-generated quests and select one. Personal funds after discounts determine history and completion. One selection starts a seven-day entitlement cycle. No live database mutations during implementation.

## Requirements and acceptance

User explicitly authorizes replacing automatic assignment and total-final-spend quest semantics (FR-C07, FR-S01–06 by capability; verify exact document references). AI proposes only supported type/category/personal amount; Backend controls20points/7days and deterministic completion. No business100baht ceiling. Summary30days and quest history90days/latest10; no PII. Reuse logs, preserve immutable receipt/ledger history. Up to2provider calls total; retain partial valid offers; failure consumes no reward entitlement. Consumer ownership, transactional one-choice selection, budget and retry enforcement required.

## Current state

Nest quests service claims generation logs then synchronously ranks deterministic candidates and finalizes assignment. Repository uses global transaction advisory lock and exactly-once reward logic. Policyv2 and consumer list reflect automatic final-spend quests. Web has existing quests page, typed client and localized copy. Working tree initially clean; design doc already committed by user between turns.

## Invariants and risks

No external provider inside transactions; only constrained validated proposals cross boundary. Auth/CSRF/ownership remain. Selection and reservations atomic; immutable receipts/points untouched; migration cancels only outstanding legacy active quests with audit. Durable logs and bounded leases allow recovery; background work must expose pending/failure and reclaim expired lease, no authoritative in-memory state. No secrets printed.

## Decisions

- Primary handles orchestration/service/controller/contracts/docs/integration; three bounded workers handle domain/provider/policy, repository/schema, frontend respectively (AGENTS routing Level3/4 risk).
- Defaults pending user adjustment: offers24hours, failures cooldown15minutes, max3sets/day; cycle7days after selection, no refresh while READY; history90days/latest10; dedup type/category/amount7days.
- Personal share allocation uses exact largest-remainder proportional allocation over snapshot items, same function for history/completion. User approved personal-contribution semantics; payment facts themselves unchanged.
- Keep request-key idempotency and log leases. Generation dispatched after POST with DB PENDING state; failed worker recorded, expired lease safely finalized before next attempt. Evaluate existing approved job mechanism before adding infrastructure.

## Execution steps

1. [done] Interfaces, policy, summarized features, constrained provider and validation.
2. [done] Proposal durable state/migration, selection transaction, personal history/completion.
3. [done] Proposal panel/client/localization/consumer tests.
4. [done] Service/controller async workflow and OpenAPI DTOs, requirements/runbook; integration and old-writer retirement.
5. [done] Final verification and evidence summary; independent review findings implemented.

## Verification

Record commands/results as executed, not planned passes. Test positive/negative AI output, partial retry bounds, personal allocation/median, authorization/ownership, select retries/concurrency,7day exclusive boundaries, offer expiry, budgets/reward once. API/web typecheck/build/lint and domain/UI/service/controller tests. Existing PostgreSQL test runner only against disposable schema, never modify connected development data.

## Rollout and recovery

Stop old generation workers/API, back up target, reviewed migration deploy, regenerate Prisma and build API/web together, verify ready/selection/payment with demo account. Cancellation of old active definitions is explicit user-requested policy migration; completed/expired/history/rewards preserved. Roll forward; do not automatically restore cancelled quests or run old automatic generator. Document locking/backfill validation in migration/runbook.

## Progress log

- 2026-10-28: Read plan standard/current modules, confirmed user implementation authority, delegated nonoverlapping workers; plan created before edits.
- 2026-10-28: Replaced scoring with bounded proposal generation/refill. Logs act as durable queue without external queue infrastructure. Queued jobs resume after restart; started jobs with missing outcomes terminalize FAILED on lease expiry, deliberately avoiding provider replay beyond2calls. This refines the earlier broad “reclaim expired lease” wording.
- 2026-10-28: Reviewer found alternate automatic assignment in registration, admin and seed. Removed registration/seed automatic assignments and fake generation logs; legacy admin endpoint delegates to the same queue with Origin/JSON/UUID checks. Admin UI now reports pending/ready and displays bounded proposal/validation audit.
- 2026-10-28: Reviewer findings fixed: DB unique indexes for one receipt/one assignment reward with migration audit guards; explicit amount basis required for new quest writers; stale READY with no valid proposals persists FAILED and can retry after15minutes; queued policy mismatch fails before provider. Selected definitions store rule version and personal basis.
- 2026-10-28: API unit/contract suite199passed/10opt-in database tests skipped; separate isolated PostgreSQL suite10passed after fixing test actor isolation (shared actor had legitimately hit rate limit). Web suite109passed at that point; added admin audit test then targeted admin4/panel8passed. HTTP simulated lifecycle4passed after upgrading fixture to selection and personal-spend contracts. These transport simulations do not replace real repository tests.
- 2026-10-28: API tsc/build/lint and Prisma validate passed; compiled policy smoke1passed. Initial compiled smoke ran while artifact absent, subsequent direct rerun passed after build available. Web build passed; web lint exits0 with existing unrelated effect/dependency warnings, new panel warnings corrected and awaiting recheck. Parallel tests initially timed out under load; sequential worker suites pass without weakening timeouts.
- 2026-10-28 final: web full suite110passed/21files with maxWorkers1; API latest orchestration10passed and controller/audit targeted16passed before adding history regression; prior API full suite199passed. Real isolated PostgreSQL10passed, HTTP lifecycle4passed, compiled smoke1passed. API tsc/lint/build and web tsc/build passed; final web lint has no warnings in new panel and retains existing unrelated warnings. Prisma validate and git diff --check passed. Changed files formatted. No application DB migration applied and no real provider invocation.

## Acceptance evidence and limits

- FR-C07: consumer panel tests cover READY reuse, pending polling, partial sets, one selection, idempotency retry and permission failures; controller binds user identity and enforces trusted mutation origin.
- FR-S01–03: domain/provider tests cover exact personal allocation, purchase distribution, versioned history, strict invalid output and dedup; orchestration tests cover2calllimit,partial/failure and no provider inside HTTP request.
- FR-S04–05/FR-A05: persistedqueue/lease/selection/idempotency/policy/budget checked against isolatedPostgreSQL; admin audit strips arbitrary model content; old direct-assignment paths retired.
- FR-S06: personal/state split and concurrent exactly-once completion checked in domain and PostgreSQL; migration preserves completed history/ledger and cancels only legacy outstanding assignments.
- No real Gemini request, no app database migration or seed, no production deployment, no claim of calibrated personalization quality or fairness. Manual provider smoke and user-target migration remain rollout actions documented in runbook.

## Open questions

No blocking product questions: user delegated reasonable defaults previously and asks to proceed. Technical discoveries may change storage/job approach; record evidence here before changes. No claim of production readiness without PostgreSQL verification.

Implementation and local verification complete. Remaining rollout actions are the reviewed target migration and an actual Gemini smoke with the user's configured backend key; follow QUEST_PROPOSALS_RUNBOOK_TH.md. Existing deployment pipeline/security scan coverage was not expanded by this task.
