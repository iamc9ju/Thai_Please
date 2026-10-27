-- FR-AUTH-02: allow one merchant to declare multiple controlled business types.
-- Existing merchants remain valid and receive an empty set for later review.
BEGIN;

ALTER TABLE "merchants"
  ADD COLUMN "merchant_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "merchants"
  ADD CONSTRAINT "merchants_merchant_types_values_check"
  CHECK (
    "merchant_types" <@ ARRAY[
      'FOOD_BEVERAGE',
      'OTOP',
      'GENERAL_GOODS',
      'COMMUNITY_ENTERPRISE',
      'VILLAGE_COMMUNITY_FUND',
      'PUBLIC_TRANSPORT',
      'SMALL_LEGAL_ENTITY',
      'OTHER'
    ]::TEXT[]
  ) NOT VALID;

ALTER TABLE "merchants"
  VALIDATE CONSTRAINT "merchants_merchant_types_values_check";

COMMIT;

-- Post-deploy validation:
-- SELECT COUNT(*) FROM "merchants" WHERE "merchant_types" IS NULL;
-- SELECT "merchant_id", "merchant_types" FROM "merchants" ORDER BY "merchant_id" LIMIT 20;
--
-- Roll-forward recovery: retain the additive column. Older application versions ignore it.
