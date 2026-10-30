BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "merchants" m
    CROSS JOIN LATERAL unnest(m."merchant_types") AS legacy_code
    WHERE NOT EXISTS (
      SELECT 1
      FROM "merchant_category_assignments" a
      JOIN "merchant_categories" c
        ON c."merchant_category_id" = a."merchant_category_id"
      WHERE a."merchant_id" = m."merchant_id"
        AND c."category_code" = legacy_code
    )
  ) OR EXISTS (
    SELECT 1
    FROM "merchants" m
    WHERE m."merchant_type" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "merchant_category_assignments" a
        JOIN "merchant_categories" c
          ON c."merchant_category_id" = a."merchant_category_id"
        WHERE a."merchant_id" = m."merchant_id"
          AND c."category_name" = m."merchant_type"
      )
  ) THEN
    RAISE EXCEPTION 'Legacy merchant category data has not been fully migrated';
  END IF;
END $$;

ALTER TABLE "merchants"
DROP CONSTRAINT IF EXISTS "merchants_merchant_types_values_check";

ALTER TABLE "merchants"
DROP COLUMN "merchant_type",
DROP COLUMN "merchant_types";

COMMIT;
