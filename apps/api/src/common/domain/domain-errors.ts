import { HttpException, HttpStatus } from '@nestjs/common';

export const DOMAIN_ERRORS = {
  alreadyPaid: ['ORDER_ALREADY_PAID', 'The order is already paid.'],
  citizenNotFound: ['INVALID_CREDENTIALS', 'The citizen ID was not found.'],
  couponExpired: ['COUPON_EXPIRED', 'The coupon has expired.'],
  couponInvalid: [
    'COUPON_NOT_USABLE',
    'The coupon is not usable for this payment.',
  ],
  forbidden: ['FORBIDDEN', 'The requested resource is not available.'],
  idempotencyConflict: [
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was reused with different input.',
  ],
  insufficientBalance: [
    'INSUFFICIENT_PERSONAL_BALANCE',
    'The personal wallet balance is insufficient.',
  ],
  insufficientPoints: [
    'INSUFFICIENT_POINTS',
    'The unexpired point balance is insufficient.',
  ],
  invalidAmount: [
    'INVALID_AMOUNT',
    'The amount is outside the supported range.',
  ],
  invalidIdempotencyKey: [
    'INVALID_IDEMPOTENCY_KEY',
    'A valid Idempotency-Key header is required.',
  ],
  invalidOrderState: [
    'INVALID_ORDER_STATE',
    'The order is not in the required state.',
  ],
  invalidProduct: [
    'INVALID_PRODUCT',
    'The product is unavailable for this merchant.',
  ],
  notFound: ['NOT_FOUND', 'The requested resource was not found.'],
  paidImmutable: [
    'PAID_ORDER_IMMUTABLE',
    'Paid orders and receipts cannot be edited, cancelled, or refunded.',
  ],
  qrExpired: ['QR_EXPIRED', 'The payment QR has expired.'],
  qrInvalid: ['QR_INVALID', 'The payment QR is invalid.'],
  unauthorized: ['UNAUTHORIZED', 'A valid bearer session is required.'],
} as const;

export class DomainException extends HttpException {
  constructor(
    error: readonly [code: string, message: string],
    status: HttpStatus,
  ) {
    super({ code: error[0], message: error[1] }, status);
  }
}
