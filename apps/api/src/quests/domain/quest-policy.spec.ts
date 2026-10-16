import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseQuestPolicy,
  QUEST_COMPLETION_INVARIANTS,
} from './quest-policy.js';

function fixture() {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL('../config/quest-policy.json', import.meta.url),
      'utf8',
    ),
  );
  return parseQuestPolicy(raw);
}

describe('FR-C07 / FR-S03 quest policy', () => {
  it('loads the committed versioned policy with exact rational multipliers', () => {
    const policy = fixture();
    expect(policy.version).toBe('quest-policy-v1');
    expect(policy.candidates.spendMultipliers).toEqual([
      { numerator: 1, denominator: 1 },
      { numerator: 3, denominator: 2 },
    ]);
    expect(QUEST_COMPLETION_INVARIANTS.receiptCount).toBe(1);
  });
  it('rejects unknown properties and attempts to override invariants', () => {
    expect(() =>
      parseQuestPolicy({ ...fixture(), allowMultipleReceipts: true }),
    ).toThrow();
    expect(() =>
      parseQuestPolicy({
        ...fixture(),
        completion: {
          ...fixture().completion,
          receiptCount: 2,
        },
      }),
    ).toThrow();
  });
  it('rejects unsupported types and duplicate types', () => {
    const p = fixture();
    expect(() =>
      parseQuestPolicy({
        ...p,
        candidates: { ...p.candidates, types: ['VISITS'] },
      }),
    ).toThrow();
    p.candidates.types = ['MIN_SPEND', 'MIN_SPEND'];
    expect(() => parseQuestPolicy(p)).toThrow();
  });
  it('rejects zero and fractional denominators', () => {
    for (const denominator of [0, 1.5]) {
      const p = fixture();
      p.candidates.spendMultipliers = [{ numerator: 1, denominator }];
      expect(() => parseQuestPolicy(p)).toThrow();
    }
  });
  it('rejects contradictory windows, spend bounds and candidate caps', () => {
    const p = fixture();
    p.candidates.recentHistoryDays = p.candidates.historyDays + 1;
    expect(() => parseQuestPolicy(p)).toThrow();
    const q = fixture();
    q.candidates.minimumSpendMinorUnits =
      q.candidates.maximumSpendMinorUnits + 1;
    expect(() => parseQuestPolicy(q)).toThrow();
    const r = fixture();
    r.candidates.maximumTotal = r.candidates.maximumPerType - 1;
    expect(() => parseQuestPolicy(r)).toThrow();
  });
  it('rejects budgets too small to fund an allowed reward', () => {
    for (const field of [
      'globalDailyReservationBudgetPoints',
      'globalOutstandingReservationBudgetPoints',
    ] as const) {
      const p = fixture();
      p.rewards[field] = 1;
      expect(() => parseQuestPolicy(p)).toThrow();
    }
  });
  it('rejects invalid schedules and unbounded provider attempts', () => {
    const p = fixture();
    p.assignment.dailyHour = 24;
    expect(() => parseQuestPolicy(p)).toThrow();
    const q = fixture();
    q.selection.maximumAttemptsPerGeneration = 4;
    expect(() => parseQuestPolicy(q)).toThrow();
  });
  it('rejects unsafe monetary integers and negative points', () => {
    const p = fixture();
    p.candidates.maximumSpendMinorUnits = Number.MAX_SAFE_INTEGER + 1;
    expect(() => parseQuestPolicy(p)).toThrow();
    const q = fixture();
    q.rewards.pointsByType.MIN_SPEND = -20;
    expect(() => parseQuestPolicy(q)).toThrow();
  });
});
