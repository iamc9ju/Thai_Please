export const FundType = {
  PERSONAL: 'PERSONAL',
  SUBSIDY: 'SUBSIDY',
  MERCHANT: 'MERCHANT',
} as const;

export type FundType = (typeof FundType)[keyof typeof FundType];

export const TransactionType = {
  PERSONAL_TOPUP: 'PERSONAL_TOPUP',
  SUBSIDY_GRANT: 'SUBSIDY_GRANT',
  PAYMENT: 'PAYMENT',
  PAYMENT_PERSONAL: 'PAYMENT_PERSONAL',
  PAYMENT_SUBSIDY: 'PAYMENT_SUBSIDY',
  MERCHANT_SALE_CREDIT: 'MERCHANT_SALE_CREDIT',
  MERCHANT_WITHDRAWAL: 'MERCHANT_WITHDRAWAL',
  MERCHANT_WITHDRAWAL_CREDIT: 'MERCHANT_WITHDRAWAL_CREDIT',
  ADJUSTMENT: 'ADJUSTMENT',
  EXPIRY: 'EXPIRY',
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

/** ค่าเดิมที่อาจมีอยู่ใน ledger ก่อน FR-C02; ใช้เพื่ออ่าน replay เท่านั้น */
export const LegacyTransactionType = {
  PERSONAL_TOPUP: 'TOPUP',
} as const;

export const BANGKOK_TIMEZONE = 'Asia/Bangkok';
export const BANGKOK_TZ_OFFSET_HOURS = 7;

export const TOPUP_LIMITS = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 50_000,
  IDEMPOTENCY_KEY_MIN_LENGTH: 8,
  IDEMPOTENCY_KEY_MAX_LENGTH: 128,
} as const;

export const WITHDRAWAL_LIMITS = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 500_000,
  IDEMPOTENCY_KEY_MIN_LENGTH: 8,
  IDEMPOTENCY_KEY_MAX_LENGTH: 128,
} as const;

export const DASHBOARD_TREND_DAYS = {
  DEFAULT: 7,
  MIN: 1,
  MAX: 30,
} as const;

export const DASHBOARD_TREND_PAGE_LIMITS = {
  DEFAULT: 5,
  MAX: 30,
} as const;

export const WALLET_TRANSACTION_PAGE_LIMITS = {
  DEFAULT: 20,
  MAX: 100,
} as const;
