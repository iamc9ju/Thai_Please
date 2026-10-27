import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseQuestPolicy,
  QUEST_COMPLETION_INVARIANTS,
} from './quest-policy.js';
function fixture() {
  return parseQuestPolicy(
    JSON.parse(
      readFileSync(
        new URL('../config/quest-policy.json', import.meta.url),
        'utf8',
      ),
    ),
  );
}
describe('FR-C07 / FR-S03 proposal policy', () => {
  it('uses personal contribution, selection and bounded generation', () => {
    const p = fixture();
    expect(p.version).toBe('quest-policy-v3');
    expect(p.proposals.maximumCalls).toBe(2);
    expect(p.assignment.cycleDays).toBe(7);
    expect(QUEST_COMPLETION_INVARIANTS.amountBasis).toBe(
      'PERSONAL_AFTER_DISCOUNT',
    );
    expect(QUEST_COMPLETION_INVARIANTS.assignmentMode).toBe(
      'CONSUMER_SELECTION',
    );
  });
  it.each(['PRODUCT_PURCHASE', 'MERCHANT_SPEND'])(
    'rejects retired type %s',
    (type) => {
      const p = fixture();
      expect(() =>
        parseQuestPolicy({
          ...p,
          candidates: { ...p.candidates, types: [type] },
        }),
      ).toThrow();
    },
  );
  it('rejects hidden policy fields and obsolete candidate caps', () => {
    const p = fixture();
    expect(() =>
      parseQuestPolicy({ ...p, allowMultipleReceipts: true }),
    ).toThrow();
    expect(() =>
      parseQuestPolicy({
        ...p,
        candidates: { ...p.candidates, maximumTotal: 8 },
      }),
    ).toThrow();
  });
  it('rejects unbounded calls, invalid histogram and inconsistent reward policy', () => {
    const p = fixture();
    expect(() =>
      parseQuestPolicy({
        ...p,
        proposals: { ...p.proposals, maximumCalls: 3 },
      }),
    ).toThrow();
    expect(() =>
      parseQuestPolicy({
        ...p,
        proposals: {
          ...p.proposals,
          distributionUpperMinorUnits: [10000, 5000],
        },
      }),
    ).toThrow();
    expect(() =>
      parseQuestPolicy({
        ...p,
        rewards: {
          ...p.rewards,
          pointsByType: { MIN_SPEND: 20, CATEGORY_SPEND: 40 },
        },
      }),
    ).toThrow();
  });
  it('rejects reward budgets below one reward and inconsistent cycles', () => {
    const p = fixture();
    expect(() =>
      parseQuestPolicy({
        ...p,
        rewards: { ...p.rewards, globalDailyReservationBudgetPoints: 1 },
      }),
    ).toThrow();
    expect(() =>
      parseQuestPolicy({ ...p, assignment: { ...p.assignment, cycleDays: 1 } }),
    ).toThrow();
  });
});
