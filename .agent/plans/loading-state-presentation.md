# Outcome

All page and section data-loading states show the same visible spinner, text, card styling and accessible status through one shared component.

## Requirements

- NFR-UI-03: wallet initial/history loading includes the same visible circular spinner and text as quests and rewards; cover the reported missing-spinner regression.
- NFR-UI-04: migrate consumer overview/wallet/orders/quests/rewards, merchant catalog/orders/wallet/dashboard, admin tabs and app/session fallback to a shared component. Keep existing localized labels; add a merchant catalog loading label.
- NFR-A11Y-01: polite status, busy indicator, decorative spinner hidden from assistive technology and reduced-motion support.
- Non-goals: change request lifecycle, business behavior, button pending indicators, financial operations or APIs.

## Current State

Request cancellation is guarded, but loading presentation is duplicated. Wallet has text only, orders use skeletons, other pages have spinners with varying styles.

## Invariants and Risks

Presentation only. Preserve pending/error/success conditions and all earlier uncommitted work. No migrations, authorization or value movement changes.

## Decisions

Use one LoadingState component with a localized label and shared semantic color tokens. Use the same card for page and section loads. Leave action-button spinners separate because they indicate submission, not data loading.

## Execution Steps

1. Primary, level 2: add component and migrate the identified states.
2. Primary: verify wallet regression, shared presentation/accessibility and migrated page integrations.
3. Primary: frontend tests, typecheck/build, lint, formatting and diff review.

## Verification

- NFR-UI-03: added a wallet initial-loading spinner assertion. Ran it against the original WalletView: failed because the spinner element was missing. Restored the fix; the complete suite passes.
- NFR-UI-04: all enumerated page/section loading branches now render LoadingState; source audit leaves separate spinners only on action buttons. Existing parameterized page lifecycle tests additionally assert the shared visible spinner and label.
- NFR-A11Y-01: LoadingState test asserts visible label, busy/polite status, decorative spinner and motion-safe animation.
- `corepack pnpm --filter @thai-please/web test`: 20 files, 99 tests passed.
- `corepack pnpm --filter @thai-please/web build`: TypeScript and Vite production build passed.
- `node node_modules/oxlint/bin/oxlint --type-aware src/` (web): exit 0, nine existing effect/dependency warnings, no rules disabled.
- Prettier applied to changed/new files; `git diff --check` passed. No live browser visual inspection performed.

## Rollout and Recovery

Frontend-only; no migration. Revert the presentation change independently of the earlier lifecycle fix if needed.

## Progress Log

- 2026-10-27: identified the wallet text-only state and enumerated all page/section loading branches.
- 2026-10-27: completed the shared presentation migration, wallet regression and accessibility assertions. Preserved earlier lifecycle changes. Validation complete with the lint warnings and browser-inspection limitation documented above.

## Open Questions

None.
