import { isUnexpired } from '../../common/time/expiry.js';

export function isCouponUsable(
  status: 'ACTIVE' | 'EXPIRED' | 'USED',
  expiresAt: Date,
  now: Date,
): boolean {
  return status === 'ACTIVE' && isUnexpired(expiresAt, now);
}
