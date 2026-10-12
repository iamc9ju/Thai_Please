import { describe, expect, it } from 'vitest';
import { isCouponUsable } from './coupon-rule.js';

describe('single-use coupon expiry rule (FR-C07)', () => {
  const now = new Date('2026-10-06T00:00:00.000Z');
  it('accepts only an active coupon before the exclusive expiry boundary', () => {
    expect(isCouponUsable('ACTIVE', new Date(now.getTime() + 1), now)).toBe(
      true,
    );
    expect(isCouponUsable('ACTIVE', now, now)).toBe(false);
    expect(isCouponUsable('USED', new Date(now.getTime() + 1), now)).toBe(
      false,
    );
  });
});
