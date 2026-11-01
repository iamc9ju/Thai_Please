# Consumer profile database integration

## Outcome

FR-C01 displays the signed-in consumer's persisted identity, phone and registration address without mock content.

## Requirements

Authenticated database read; masked citizen ID; localized missing values, loading, failed/retry and permission-denied states. Never substitute mock data.

## Current State

ProfileView uses session name/ID and hardcoded phone/address. User already persists registration fields. Existing users routes have session and role guards.

## Invariants and Risks

Read only; select necessary fields using session userId only. Consumer role required. No financial effects, schema changes or mutation audit events.

## Decisions

Add GET /users/me/profile without changing the login session contract. Share response contract and validate at the browser boundary. Existing settings become explicitly disabled.

## Execution Steps

1. Primary Level 2: contract, guarded controller, selected-field query.
2. Primary Level 2: adapter, localized states, remove mock banner.
3. Primary: tests and checks.

## Verification

Test scoped lookup, masking, missing records, guards; UI loading/data/empty/error/retry/denied. Run affected tests, typecheck, lint and builds.

## Rollout and Recovery

Add API before web; no migration. Revert code together if needed; stored data unchanged.

## Progress Log

2026-10-28: inspected guard, schema, view and API patterns; implementation started.

2026-10-28: implemented guarded selected-field Prisma read, shared contract, OpenAPI response DTO, browser validation and cancellable view reads; removed mock banner and phone/address. Profile/API/dashboard tests: 19 web tests and 3 API tests passed. API and contracts typecheck passed; standalone API build passed. Workspace lint completed with warnings. Web typecheck/build blocked by existing errors in MerchantPos.tsx, MerchantPos.test.tsx and MerchantWalletView.tsx outside this change. No live PostgreSQL/browser journey was run. FR-C01 automated evidence covers data mapping, masking, scope query, guard metadata, actual/empty/error/retry/denied states and invalid API responses. Production readiness remains limited by the unrelated web build errors and absent live verification.

## Open Questions

Password change and policy content remain outside this profile read request; show unavailable settings honestly.
