export const FundType = {
  PERSONAL: 'PERSONAL',
  SUBSIDY: 'SUBSIDY',
  MERCHANT: 'MERCHANT',
} as const;

export type FundType = (typeof FundType)[keyof typeof FundType];

export const TransactionType = {
  TOPUP: 'TOPUP',
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

export const BANGKOK_TIMEZONE = 'Asia/Bangkok';
export const BANGKOK_TZ_OFFSET_HOURS = 7;

export const TOPUP_LIMITS = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 50_000,
} as const;
