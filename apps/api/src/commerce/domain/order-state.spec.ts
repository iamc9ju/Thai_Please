import { describe, expect, it } from 'vitest';
import { isOrderMutable } from './order-state.js';

describe('paid order immutability (FR-C04)', () => {
  it('allows edits only while an order is draft', () => {
    expect(isOrderMutable('DRAFT')).toBe(true);
    expect(isOrderMutable('CHECKED_OUT')).toBe(false);
    expect(isOrderMutable('PAID')).toBe(false);
    expect(isOrderMutable('EXPIRED')).toBe(false);
  });
});
