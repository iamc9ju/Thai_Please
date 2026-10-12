import { describe, expect, it } from 'vitest';
import { calculateFinalAmount } from './pricing.js';

describe('server-side pricing (FR-M03)', () => {
  it('applies coupon discount before final amount and never goes negative', () => {
    expect(calculateFinalAmount(100, 10)).toEqual({
      discount: 10,
      finalAmount: 90,
    });
    expect(calculateFinalAmount(5, 10)).toEqual({
      discount: 5,
      finalAmount: 0,
    });
  });
});
