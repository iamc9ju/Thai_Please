# Repository Structure and Foundation Hardening ExecPlan

## Outcome

Restructure the active authentication, registration, and consumer slices so ownership is explicit, the web application is feature-oriented, configuration is validated, authentication avoids unsafe defaults, API routing is consistently versioned, and the repository quality gates describe commands that actually exist. Preserve the current user-visible flows while making later domain work safer.

## Requirements

This refactor supports `FR-C01` and the identity prerequisites shared by consumer, merchant, and administrator flows. It primarily addresses `NFR-SEC-01`, `NFR-MAINT-01`, `NFR-API-01`, and `NFR-TEST-01`.

Acceptance criteria:

1. Web code for auth, registration, and consumer dashboard is grouped by feature, with page components reduced to orchestration and cohesive UI sections extracted.
2. API configuration is validated at startup and contains no committed JWT fallback secret.
3. Password storage uses a password-specific adaptive hash and existing unsafe hashes are not silently accepted as production-safe.
4. Public API routes have one versioned prefix and documentation, proxying, and tests agree with it.
5. User-management endpoints are authenticated and role-authorized, or removed from the public surface when no approved use case exists.
6. Root verification invokes only implemented checks, with API unit and E2E coverage added for the changed security boundary.
7. Existing visual behavior and Thai localization remain intact.

Non-goals:

- Implementing wallet, payment, coupon, point, quest, merchant POS, or administrator policy behavior.
- Changing the Prisma data model or rewriting migration history.
- Selecting deployment infrastructure or introducing a global client state library.
- Completing registration persistence without an approved registration contract.

## Current State

- The pnpm workspace contains `apps/web`, `apps/api`, `packages/contracts`, and `packages/config`.
- The web application has global authentication context, but its three main pages and global stylesheet are large and organized by screen rather than a consistent feature boundary.
- The API reads environment variables directly, defaults to a committed JWT secret, hashes passwords with SHA-256, and exposes user endpoints without guards.
- README, CI environment, API controllers, and runtime defaults disagree about prefix and port.
- `packages/contracts` contains only health types and is not yet the generated transport contract described by the architecture.
- Root `verify` requests an API `test:e2e` script that is absent.
- Migration directories exist without migration files; migration history will not be changed in this plan.

## Invariants and Risks

- Authentication changes must not expose credentials, tokens, citizen IDs, or internal errors.
- Existing sessions may become invalid when JWT configuration is made mandatory; local development must receive an explicit example value.
- Password-hash migration requires an explicit compatibility strategy. This plan will not silently reinterpret existing SHA-256 values.
- Route prefix changes affect the Vite proxy and browser API paths and must be changed atomically.
- Component extraction must preserve accessibility labels, focus behavior, responsive layout, and localization keys.
- The working tree cannot currently be inspected through Git because the checkout reports a permission error; no unrelated file will be deleted or overwritten.

## Decisions

- Use feature-local components under `apps/web/src/features/<feature>` and reserve `components/ui` for proven cross-feature primitives.
- Keep CSS selectors stable during component extraction, then split the stylesheet by feature without a simultaneous visual redesign.
- Use Nest `ConfigModule` with a Zod startup schema and a namespaced configuration owner.
- Use Node's built-in `scrypt` with a versioned encoded format to avoid adding a native dependency while still using a password-specific KDF.
- Establish the global prefix in bootstrap; controllers own only resource-relative paths.
- Protect user administration behind authentication and an explicit administrator-role guard.
- Add focused tests before broadening contracts generation; OpenAPI client generation remains a follow-up because it needs an artifact policy decision.

## Execution Steps

1. Record baseline command results for formatting, lint, type checks, tests, and builds.
2. Add validated API configuration and normalize API versioning, CORS, port, cookies, session TTL, and JWT settings.
3. Replace SHA-256 password creation/verification with versioned scrypt helpers and define the handling of legacy hashes.
4. Add role authorization for user-management endpoints and stable error handling for the affected flow.
5. Repair API test scripts and add targeted auth/config/authorization tests.
6. Reorganize web source into auth, registration, and consumer feature boundaries; extract cohesive components while preserving behavior.
7. Split global styles into tokens/base and feature styles while preserving selector behavior.
8. Align Vite proxy, README, `.env.example`, contracts, and CI with the actual versioned API.
9. Run narrow checks, then `pnpm verify`; review the diff and document residual risks.

## Verification

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- API authentication/configuration unit tests and API E2E tests
- `pnpm build`
- `pnpm verify`
- Manual source review for secrets, SHA-256 password use, unguarded user routes, hardcoded API prefixes, untranslated UI copy, and accessibility regressions

Database migration validation is excluded because this plan makes no schema change; the unexplained empty migration directories remain a documented follow-up.

## Rollout and Recovery

- Apply route/config/auth changes atomically within the monorepo.
- Existing development sessions are disposable and may be invalidated after the JWT configuration change.
- Existing SHA-256 password rows require a deliberate reset or migration; do not deploy the new verifier against populated environments until that path is approved.
- Component and stylesheet work is behavior-preserving and can be reverted independently from API hardening if visual regression appears.
- No destructive database or filesystem operation is authorized by this plan.

## Progress Log

- 2026-10-13: Repository inspected; inconsistencies in auth security, API prefixing, verification scripts, feature ownership, and documentation recorded.
- 2026-10-13: Plan created before implementation.
- 2026-10-13: Web source moved under `app`, `features`, and `styles`; auth provider/hook/context ownership split; login, registration, and consumer UI sections extracted without changing selectors.
- 2026-10-13: Added validated environment configuration, mandatory JWT secret, consistent `/api/v1` prefix, versioned health endpoints, scrypt password service, administrator authorization for user management, and stricter registration validation.
- 2026-10-13: Added API unit and E2E test commands, five API unit tests, and one versioned health E2E test. Updated CI, README, `.env.example`, and the lockfile.
- 2026-10-13: `pnpm verify` passed: Prisma schema validation, formatting, lint, strict type checks, 10 unit/component tests, one API E2E test, and web/API production builds.

## Open Questions

- Whether existing environments contain SHA-256 password hashes that require an online migration or forced reset.
- Whether public self-registration or administrator-only account creation is the approved product behavior.
- Whether OpenAPI artifacts should be checked in or generated only during CI/build.
- Whether the empty migration directories are incomplete local work; they will be preserved.
- CSRF protection for cookie-authenticated mutations still requires an approved browser/session threat-model decision; `SameSite=Lax` remains the current partial control.
