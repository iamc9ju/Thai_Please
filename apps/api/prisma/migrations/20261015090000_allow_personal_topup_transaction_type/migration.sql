-- FR-C02: expand the ledger transaction type constraint without rewriting rows.
-- The legacy TOPUP value remains readable for backward-compatible idempotent replay.
BEGIN;

ALTER TABLE "wallet_transactions"
  DROP CONSTRAINT IF EXISTS "wallet_transactions_transaction_type_check";

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_transaction_type_check"
  CHECK (
    "transaction_type" IN (
      'PERSONAL_TOPUP',
      'SUBSIDY_GRANT',
      'PAYMENT',
      'PAYMENT_PERSONAL',
      'PAYMENT_SUBSIDY',
      'MERCHANT_SALE_CREDIT',
      'MERCHANT_WITHDRAWAL',
      'MERCHANT_WITHDRAWAL_CREDIT',
      'ADJUSTMENT',
      'EXPIRY',
      'TOPUP'
    )
  ) NOT VALID;

ALTER TABLE "wallet_transactions"
  VALIDATE CONSTRAINT "wallet_transactions_transaction_type_check";

COMMIT;

-- Post-deploy validation:
-- SELECT conname, convalidated
-- FROM pg_constraint
-- WHERE conname = 'wallet_transactions_transaction_type_check';
--
-- Roll-forward recovery: keep this widened constraint when PERSONAL_TOPUP rows exist.
-- Rolling back application code does not require narrowing the accepted values.
-- If validation fails, this transaction restores the pre-migration constraint.
