-- Expand only: old stores remain null; no inferred backfill, default or index.
-- Deploy before API reads merchant_type. Recovery: roll back readers, keep column.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "merchants" ADD COLUMN "merchant_type" VARCHAR(100);
COMMIT;
