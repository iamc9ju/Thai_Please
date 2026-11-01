# Outcome

Canceled or superseded page loads never replace the current loading, success, or error state.

## Requirements

- NFR-UI-01: only the current read request may publish data, errors, or loading completion; verify with deterministic delayed requests and StrictMode.
- NFR-UI-02: cancellation is preserved by the API client and is not logged as a network failure; real failures and permission errors remain visible.
- Applies to consumer rewards/orders, merchant dashboard/wallet/order history, and admin tab loading. Existing guarded overview, wallet, quests, POS catalog and payment effects are reviewed. No financial or API contract semantics change.

## Current State

CouponsView ignores AbortError, but api-client wraps it as a generic error. Orders and merchant/admin loaders have no stale-result protection. Other consumer effects use local activity flags or request IDs.

## Invariants and Risks

Read lifecycle only; no persistence, authorization, pricing, rewards, or mutation changes. Guard success, catch and finally together so stale requests cannot end the latest spinner. Preserve real API error mapping.

## Decisions

Use one small React read-request lifecycle hook for unguarded page loaders. Starting a read invalidates its predecessor; cleanup cancels it. Pass its signal where the existing API supports cancellation. Existing correct local guards remain valid; avoid unrelated rewrites.

## Execution Steps

1. Primary, level 2: add tested lifecycle hook and preserve API abort errors.
2. Primary, level 2: integrate unguarded page read loaders; retain mutation behavior.
3. Primary: regression tests, full frontend tests, typecheck, lint, build and diff review.

## Verification

- NFR-UI-01: CouponsView StrictMode cancellation regression, parameterized page regressions (consumer orders, merchant dashboard/wallet, admin), merchant order-history regression, hook supersession/unmount tests. Current failures remain visible; rewards retry recovers.
- NFR-UI-02: API tests preserve DOMException and custom cancellation reasons without logging; genuine network and permission failures retain their handling. The AbortError regression was run against HEAD's API client and failed as expected before restoring the fix. The component baseline attempt encountered a sandbox module-loading error; final component tests ran successfully outside that sandbox.
- `corepack pnpm --filter @thai-please/web test`: 19 files, 98 tests passed.
- `node node_modules/typescript/bin/tsc -b --pretty false` (web): passed; final build also includes TypeScript checking.
- `corepack pnpm --filter @thai-please/web build`: passed.
- `node node_modules/oxlint/bin/oxlint --type-aware src/` (web): exit 0, nine warnings about effect state updates and LoginPage dependencies; no rules disabled.
- `git diff --check`: passed. No browser/backend end-to-end run; the failure scenarios are deterministic frontend tests.

## Rollout and Recovery

Frontend-only deployment, no migration or flags. Revert this change to recover. No data recovery required.

## Progress Log

- 2026-10-27: reviewed page effects and existing activity guards; implementation starting.
- 2026-10-27: implemented shared lifecycle guards and API cancellation handling; additionally found and fixed the nested merchant order-history loader. Added accessible loading announcements to skeleton-only order lists. All frontend tests and production build pass. Complete, subject to the documented lint warnings and absence of a browser E2E run.

## Open Questions

None. Runtime backend failures may still produce legitimate error screens.
