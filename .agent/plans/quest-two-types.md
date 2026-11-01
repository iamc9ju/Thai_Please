# Two cross-store quest types

## Outcome / requirements

User explicitly removes named/exact-product and merchant-restricted quests. FR-C07 / FR-S01–03 / FR-S06: new generation and completion allow only MIN_SPEND and CATEGORY_SPEND. Category identity remains the system category ID; any eligible shop can prove a quest with one paid after-discount receipt. Policy v2 caps 4/type, 8 total. No product name matching or taxonomy extension.

## Current state

Four-type policy v1, ranking adapter, candidate engine and repository; completion evaluator now exists and is invoked after payment. UI displays live and historical quests. Initial working tree clean. Existing log migration is applied per user's prior confirmation, so never edit that migration.

## Invariants / decisions

Keep receipts/point ledgers/completed quests immutable. Add cancellation metadata on assignments; a forward migration cancels only ACTIVE assignments of removed types, without changing their condition, expiry, reward or completion facts. Preserve completed/expired history and generation audit. New evaluator refuses removed types even before migration. Cancelled assignments cannot earn rewards or retain outstanding budget. Never apply migration to user's app DB autonomously. No new table. Short row update locks may block concurrent completion; WHERE ACTIVE and row locking ensures either pre-cutover completion or cancellation, not both. Migration timestamps UTC and explicit reason identify policy retirement. No automatic replacement assignment or point rewrite.

## Ownership / steps

Primary owns repository, service integration, completion, migration/schema, requirements/docs, integration tests and final verification. Candidate worker exclusively owns policy/schema/candidates/provider and their tests. UI worker exclusively owns consumer quest view/types/copy/tests. Independent review after integration for reward/migration risk.

## Verification

Reject removed types at policy/provider/persistence/evaluator boundaries; supported types succeed across shops using snapshot category/discount allocation. Regression on stale v1 claims. Migration tests preserve completed history/points and cancel only ACTIVE removed assignments idempotently; generation budget and completion tests against isolated PostgreSQL. Run web/API tests, strict types, lint and builds proportionately.

## Rollout / recovery

Stop old API/workers, apply additive migration in a controlled window, then restart code supporting CANCELLED with v2 policy (list selects the new columns). Do not delete old product/merchant columns needed to display history. No rollback by reactivating retired quests; fix forward, retain audit and cancellation facts. Global log/assignment locks are short. Legacy daily assignments remain counted for their original date; cancellation does not mint replacement value or refund spent rewards. Only unexpired ACTIVE assignments are cancelled; stale ACTIVE rows already expired retain their original facts and display as EXPIRED.

## Progress

2026-10-27: inspected requirements/current implementation, delegation boundaries established; implementation in progress.

Completed: policy/schema/candidates/provider narrowed to two types; prompt version v2 shared between adapter/log; removed merchant/product summaries from AI boundary. UI cancellation/history/cross-store copy integrated. New database constraint protects new rule writes while preserving historical rows. Migration adds only two cancellation columns and retires unexpired active removed/bound rules. Independent review found and fixed stale-expiry cancellation, missing cancellation metadata, product-count catalog dependency and prompt version drift. Candidate worker interrupted before writing; primary completed those bounded edits. Initial parallel HTTP test timeout resolved by one-worker rerun without changing timeout/checks.

Evidence: 180 API tests passed (8 opt-in DB cases skipped there); independently all 8 PostgreSQL cases passed against isolated disposable schema, including migration preservation, cross-store completion and concurrent reward retry. All 85 web tests passed; targeted quest UI 7 passed. API TypeScript passed; API lint clean; web lint exit 0 with existing warnings in unrelated views/auth files, none in changed quest files. API/web production builds and compiled policy smoke test passed. No live AI calls or live app DB mutations. Requirement mapping: FR-C07/UI and cancellation tests; FR-S01–03/new allow-list and provider rejection tests; FR-S06/cross-store deterministic and DB exactly-once reward tests. Migration must still be applied by user before restarting app.

## Open questions

None blocking: user approved removal and prior proposal to cancel active removed quests with reason. Existing assignments are not mutated in the live DB in this turn; migration remains reviewable and user-applied.
