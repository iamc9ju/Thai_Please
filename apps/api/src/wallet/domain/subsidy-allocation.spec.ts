import { describe, expect, it } from 'vitest';
import { allocateSubsidy } from './subsidy-allocation.js';

describe('subsidy allocation (FR-C03, BR-PAY-002)', () => {
  it('allocates 60/40 for an eligible 100-baht payment', () => {
    expect(
      allocateSubsidy({
        finalAmount: 100,
        subsidyBalance: 1_000,
        personalBalance: 1_000,
        subsidyUsedToday: 0,
        dailySubsidyCap: 200,
        subsidyPercent: 60,
      }),
    ).toEqual({ subsidyPaid: 60, personalPaid: 40, sufficient: true });
  });

  it('caps daily subsidy at 200 and falls back to personal balance', () => {
    expect(
      allocateSubsidy({
        finalAmount: 100,
        subsidyBalance: 820,
        personalBalance: 1_000,
        subsidyUsedToday: 180,
        dailySubsidyCap: 200,
        subsidyPercent: 60,
      }),
    ).toEqual({ subsidyPaid: 20, personalPaid: 80, sufficient: true });
  });

  it('reports insufficient personal funds without changing input state', () => {
    expect(
      allocateSubsidy({
        finalAmount: 100,
        subsidyBalance: 1_000,
        personalBalance: 39,
        subsidyUsedToday: 0,
        dailySubsidyCap: 200,
        subsidyPercent: 60,
      }).sufficient,
    ).toBe(false);
  });
});
