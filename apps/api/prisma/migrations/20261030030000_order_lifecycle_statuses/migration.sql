-- Migration: Support full order lifecycle statuses (DRAFT, CHECKED_OUT, PENDING, PAID, FAILED, EXPIRED)
BEGIN;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('DRAFT', 'CHECKED_OUT', 'PENDING', 'PAID', 'FAILED', 'EXPIRED'));

-- Immediately transition any overdue pending orders to EXPIRED
UPDATE orders
SET status = 'EXPIRED'
WHERE status IN ('PENDING', 'CHECKED_OUT')
  AND qr_expires_at IS NOT NULL
  AND qr_expires_at <= CURRENT_TIMESTAMP;

COMMIT;
