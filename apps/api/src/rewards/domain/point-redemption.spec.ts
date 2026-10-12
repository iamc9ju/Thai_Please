import { describe, expect, it } from 'vitest';
import { planPointRedemption } from './point-redemption.js';

describe('point redemption and expiry (FR-C06, FR-C07)', () => {
  const now = new Date('2026-10-06T00:00:00.000Z');
  it('excludes expired allocations and rejects insufficient unexpired points', () => {
    const result = planPointRedemption(
      [{ id: 1, remainingAmount: 100, expiresAt: now }],
      100,
      now,
    );
    expect(result).toEqual({ sufficient: false, deductions: [] });
  });
  it('consumes the earliest-expiring allocations first', () => {
    const result = planPointRedemption(
      [
        {
          id: 2,
          remainingAmount: 80,
          expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        },
        {
          id: 1,
          remainingAmount: 40,
          expiresAt: new Date('2026-12-01T00:00:00.000Z'),
        },
      ],
      100,
      now,
    );
    expect(result).toEqual({
      sufficient: true,
      deductions: [
        { id: 1, amount: 40 },
        { id: 2, amount: 60 },
      ],
    });
  });
});
