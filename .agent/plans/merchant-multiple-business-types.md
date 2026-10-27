# Merchant Multiple Business Types

## Outcome

Merchant registration supports selecting and persisting one or more controlled business types. A shop can declare combinations such as food/beverage and OTOP, and the stored values remain available for approval and future eligibility checks.

## Requirements

- Maps to `FR-AUTH-02` Merchant Registration.
- Replace the single-value `merchantType` contract with required `merchantTypes`.
- Accept only allow-listed business types, reject empty, duplicate, and unknown values server-side.
- Persist the selected values on `merchants` without adding a new core table.
- Preserve existing merchant rows through a forward-safe additive migration.
- Update Web registration to an accessible multi-select dropdown with checkboxes and selected-value chips.
- Non-goal: product-level multi-category tagging; products continue to use one `category_id`.

## Current State

- The Web form renders a single native select and sends `merchantType: string`.
- The API DTO accepts `merchantType` but `AuthService.registerMerchant` discards it.
- `merchants` has no business-type column.
- `product_categories` classifies products, not merchant registration eligibility.

## Invariants and Risks

- Existing merchant data must remain valid; the new column starts as an empty array for legacy rows.
- Values are untrusted input and must be validated against one server-owned allow-list.
- Registration remains atomic: identity, role, merchant, and wallet writes rollback together.
- A database array is selected for the prototype to honor the existing 15-table constraint. A normalized join table is a future option if types become admin-managed entities.

## Decisions

- Add PostgreSQL `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]` mapped to Prisma `String[]`.
- Use a controlled multi-select checkbox dropdown in the Web UI.
- Keep business types distinct from product categories.
- Store `OTHER` detail in the existing merchant description for now; no additional free-text type field is introduced in this change.

## Execution Steps

1. Add shared API business-type constants, DTO array validation, Prisma field, and SQL migration.
2. Persist and return `merchantTypes` from merchant registration.
3. Change Web contract, validation, localization, and registration UI to multi-select.
4. Update unit/E2E/Web tests and requirements documentation.
5. Validate migration, formatting, tests, typechecks, lint, and builds.

## Verification

- API DTO/unit tests reject empty or invalid business types.
- Registration E2E proves multiple values persist on one merchant.
- Web tests prove multiple selections are submitted.
- Run Prisma validation, API/Web tests, typechecks, lint, and builds.

## Rollout and Recovery

- Deploy migration before the API version that writes `merchant_types`.
- Existing rows receive an empty array and remain readable.
- Roll-forward recovery is preferred. Removing the column is data-destructive and requires an explicit rollback decision.

## Progress Log

- 2026-10-28: Confirmed the current UI/API accepts one value and the database does not persist it. Selected an additive PostgreSQL array migration to avoid a sixteenth core table.
- 2026-10-28: Added the shared business-type contract, Prisma field, allow-list constraint migration, API validation/persistence, accessible Web multi-select, Admin approval display, and regression tests.
- 2026-10-28: Applied `20261028003000_add_merchant_business_types` directly to the configured Neon database and marked it applied. A read-only pull confirmed `merchants.merchant_types` and its check constraint exist.
- 2026-10-28: Final verification passed: API unit 183/183, API E2E 4/4, Web 97/97, API/Web/contracts typechecks, API/Web builds, lint, Prisma validation, and `git diff --check`. Web lint reports nine pre-existing warnings and no errors.

## Open Questions

- Pre-existing migration-history drift remains: Neon records `20261027090000_retire_product_merchant_quests`, which is absent locally, while two empty local migration directories are not recorded remotely. This feature migration is applied, but the historical drift should be reconciled from the original migration artifact before relying on plain `prisma migrate deploy` for all future releases.
