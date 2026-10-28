# Merchant Navigation Page Split

## Outcome

The merchant portal keeps its current behavior while `MerchantPos.tsx` becomes a navigation/state coordinator and each navbar surface is owned by a focused view module.

## Requirements

- Supports `FR-M02` through `FR-M08` without changing API contracts or payment behavior.
- Split POS, QR, and Orders markup into dedicated modules; reuse the existing Wallet and Dashboard modules.
- Preserve cart, active QR order, payment polling, receipts, product CRUD, loading, error, and success states.
- Preserve the responsive navbar and all existing accessible names used by tests.
- Non-goals: API, database, authorization, pricing, wallet, payment, and visual redesign changes.

## Current State

- `MerchantPos.tsx` owns the merchant shell, catalog loading, POS/product CRUD, QR lifecycle, order polling, receipt loading, and an inline orders view.
- Wallet and Dashboard already live in `views/MerchantWalletView.tsx` and `views/MerchantDashboardView.tsx`.
- `MerchantPos.test.tsx` covers catalog loading, product mutation, category visibility, and order creation behavior.

## Invariants and Risks

- The server remains authoritative for product prices and order totals.
- The active QR and polling state must survive navbar changes, so they remain owned by the shell.
- Components receive typed callbacks and display data only; they do not duplicate API calls owned by the shell.
- Orders may continue to fetch independently when its view mounts.
- No persistence, value movement, or authorization boundary changes.

## Decisions

- Keep the navbar/header and cross-view state in `MerchantPos.tsx`.
- Extract `MerchantSalesView`, `MerchantQrView`, and `MerchantOrdersView` into `views/`.
- Keep product add/edit dialogs with the sales view because they belong to catalog/POS navigation.
- Keep API orchestration in the current owner unless a view was already independently loading its own data.
- Reject route-level navigation for now because the portal currently uses local tab state and changing URLs is outside scope.

## Execution Steps

1. Complete — Identified state and callbacks required by each navbar view.
2. Complete — Extracted POS/catalog markup and dialogs into `MerchantSalesView`.
3. Complete — Extracted QR status and receipt actions into `MerchantQrView`.
4. Complete — Moved the inline order history implementation into `MerchantOrdersView`.
5. Complete — Reduced `MerchantPos.tsx` to shell, state orchestration, and view composition.
6. Complete — Preserved tests and ran formatting, tests, typecheck, lint, and build.

## Verification

- Merchant component tests cover catalog, category display, product CRUD, cart/order creation, and extracted view composition.
- Run Web tests, typecheck, lint, and production build.
- Review the diff for accidental API or business-rule changes.

## Rollout and Recovery

- Frontend-only refactor with no migration or data rollout.
- Recovery is a source rollback; API and database remain compatible throughout.

## Progress Log

- 2026-10-27: Inspected repository rules and created the refactor plan before editing implementation files.
- 2026-10-27: Split the POS, QR, and Orders surfaces into dedicated view files; retained the existing Wallet and Dashboard view files.
- 2026-10-27: Web typecheck passed; all 86 Web tests passed; production build passed. Lint completed with nine pre-existing `set-state-in-effect`/dependency warnings, including the order-history warning moved unchanged with its component.
- 2026-10-27: Clarified the POS category requirement: the filter now derives categories from products visible under the current status filter, hides empty categories, and shows “ทั้งหมด” only when at least two populated categories remain. Web tests increased to 87 and passed.
- 2026-10-27: Added a confirmation dialog before deactivating an active product; cancel performs no mutation and activation remains immediate. Web tests increased to 88 and passed.
- 2026-10-27: Kept QR payment out of the navbar and added a safe, dedicated browser tab that displays each newly created payment QR while retaining the existing in-app payment-status flow. Web tests increased to 91 and passed.
- 2026-10-27: Merchant order history now receives `qrExpiresAt` from the API and derives an expired display state as “ยกเลิกการชำระ” with a red cancellation icon. Pending metrics and filters exclude expired QR orders. API tests reached 174 passing and Web tests reached 92 passing.
- 2026-10-27: Added database-backed merchant order-history filtering. The Web UI exposes a compact year/month picker beside Refresh and translates the selected month into validated `Asia/Bangkok` start/end boundaries; “ทุกเดือน” clears it. API tests remain at 174 passing, Web tests increased to 93 passing, and both production builds and typechecks pass.
- 2026-10-27: Replaced the merchant-wallet day-range controls with one shared year/month picker for both order-income and wallet-ledger tabs. The wallet overview API now filters bill-level income rows with the same Bangkok month boundaries while lifetime balance and summary totals remain unchanged. Web tests increased to 94 passing; API tests remain at 174 passing.

## Open Questions

- None. Existing local-tab behavior and visual structure are preserved.

## Requirement Evidence

- `FR-M02`–`FR-M05`: `MerchantSalesView`, `MerchantQrView`, and the existing `MerchantPos.test.tsx` coverage.
- `FR-M06`: existing `MerchantWalletView` remains composed by the navbar shell.
- `FR-M07`: existing `MerchantDashboardView` remains composed by the navbar shell.
- `FR-M08`: `MerchantOrdersView` owns order history and receipt presentation.
