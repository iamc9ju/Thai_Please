import { describe, expect, it } from 'vitest';
import { parseQuestPolicy } from './domain/quest-policy.js';
import {
  buildQuestInput,
  type EligibleCatalog,
  type PurchaseFact,
} from './quest-candidates.js';

it('accepts zero-priced snapshot lines without dividing by zero', () => {
  const asOf = new Date('2026-10-16T01:00:00Z');
  const input = buildQuestInput(
    [
      {
        id: '1',
        merchantId: '1',
        paidAt: new Date('2026-10-15T01:00:00Z'),
        finalMinor: 0n,
        items: [{ id: '1', productId: '1', categoryId: '1', lineMinor: 0n }],
      },
    ],
    {
      products: new Set(['1']),
      merchants: new Set(['1']),
      categories: new Set(['1']),
    },
    [],
    policy,
    asOf,
  );
  expect(input.summary.totalSpendMinor).toBe('0');
  expect(input.candidates).toEqual([]);
});

const policy = parseQuestPolicy({
  version: 'quest-policy-v1',
  candidates: {
    types: [
      'MIN_SPEND',
      'CATEGORY_SPEND',
      'PRODUCT_PURCHASE',
      'MERCHANT_SPEND',
    ],
    historyDays: 30,
    recentHistoryDays: 7,
    minimumHistoryOrders: 3,
    minimumTargetOrders: 2,
    spendMultipliers: [
      { numerator: 1, denominator: 1 },
      { numerator: 3, denominator: 2 },
    ],
    spendBasis: {
      MIN_SPEND: 'WHOLE_ORDER_AVERAGE',
      CATEGORY_SPEND: 'TARGET_CATEGORY_AVERAGE',
      MERCHANT_SPEND: 'TARGET_MERCHANT_AVERAGE',
    },
    currency: 'THB',
    minorUnitsPerMajor: 100,
    minimumSpendMinorUnits: 1,
    maximumSpendMinorUnits: 100_000,
    rounding: 'CEIL_MINOR_UNIT',
    targetSelection: 'PREVIOUSLY_PURCHASED_ACTIVE_ONLY',
    targetOrdering: 'FREQUENCY_DESC_LAST_PURCHASE_DESC_ID_ASC',
    maximumPerType: 4,
    maximumTotal: 16,
    insufficientHistory: 'DEFER',
  },
  selection: {
    scoreMinimum: 0,
    scoreMaximum: 100,
    criteria: 'PURCHASE_RELEVANCE_AND_ACHIEVABLE_CHALLENGE',
    tieBreak: 'LOWER_SPEND_THEN_CANDIDATE_ID_ASC',
    providerFailure: 'DEFER',
    maximumAttemptsPerGeneration: 2,
  },
  assignment: {
    maximumActivePerUser: 1,
    maximumNewPerUserPerDay: 1,
    scheduleTimezone: 'Asia/Bangkok',
    dailyHour: 8,
    dailyMinute: 0,
    durationDays: 7,
    duplicateCooldownDays: 7,
    duplicateIdentity: 'TYPE_AND_TARGET',
    cooldownStartsAt: 'COMPLETION_OR_EXPIRY',
    nextQuest: 'NEXT_DAILY_RUN_AFTER_FINALIZATION',
  },
  rewards: {
    pointsByType: {
      MIN_SPEND: 20,
      CATEGORY_SPEND: 20,
      PRODUCT_PURCHASE: 20,
      MERCHANT_SPEND: 20,
    },
    pointValidityDays: 90,
    globalDailyReservationBudgetPoints: 2000,
    globalOutstandingReservationBudgetPoints: 14000,
    budgetExhausted: 'DEFER',
    reserveAt: 'ASSIGNMENT',
    releaseAt: 'EXPIRY_OR_REWARD_ISSUANCE',
  },
  completion: { maximumAssignmentsPerReceipt: 1 },
});

const catalog: EligibleCatalog = {
  merchants: new Set(['1', '2']),
  products: new Set(['11', '12']),
  categories: new Set(['101', '102']),
};
const asOf = new Date('2026-10-16T00:00:00.000Z');

function receipt(
  id: string,
  daysAgo: number,
  finalMinor: bigint,
  merchantId = '1',
  items: PurchaseFact['items'] = [
    { id: `${id}-a`, productId: '11', categoryId: '101', lineMinor: 100n },
  ],
): PurchaseFact {
  return {
    id,
    merchantId,
    paidAt: new Date(asOf.getTime() - daysAgo * 86_400_000),
    finalMinor,
    items,
  };
}

describe('buildQuestInput', () => {
  it('uses only the [asOf - 30 days, asOf) receipt window and reports the recent count', () => {
    const result = buildQuestInput(
      [
        receipt('1', 30, 100n),
        receipt('2', 29, 100n),
        receipt('3', 7, 100n),
        receipt('4', 6, 100n),
        receipt('5', 0, 100n),
      ],
      catalog,
      [],
      policy,
      asOf,
    );
    expect(result.summary.purchases30d).toBe(4);
    expect(result.summary.purchases7d).toBe(2);
    expect(result.summary.totalSpendMinor).toBe('400');
  });

  it('allocates a discounted receipt with largest remainder so category totals equal the final total', () => {
    const split = receipt('1', 3, 101n, '1', [
      { id: '1-a', productId: '11', categoryId: '101', lineMinor: 100n },
      { id: '1-b', productId: '12', categoryId: '102', lineMinor: 100n },
    ]);
    const result = buildQuestInput(
      [split, receipt('2', 2, 100n), receipt('3', 1, 100n)],
      catalog,
      [],
      policy,
      asOf,
    );
    const categories = new Map(
      result.summary.categories.map((entry) => [
        entry.id,
        entry.totalSpendMinor,
      ]),
    );
    expect(categories.get('101')).toBe('251');
    expect(categories.get('102')).toBe('50');
    expect(
      [...categories.values()].map(BigInt).reduce((a, b) => a + b, 0n),
    ).toBe(301n);
  });

  it('applies the ratio before rounding a fractional average for every spend candidate type', () => {
    const facts = [
      receipt('1', 2, 5000n, '1', [
        { id: '1-a', productId: '11', categoryId: '101', lineMinor: 5000n },
      ]),
      receipt('2', 1, 5001n, '1', [
        { id: '2-a', productId: '11', categoryId: '101', lineMinor: 5001n },
      ]),
      receipt('3', 1, 5000n, '2', [
        { id: '3-a', productId: '12', categoryId: '102', lineMinor: 5000n },
      ]),
    ];
    const result = buildQuestInput(facts, catalog, [], policy, asOf);
    const byType = (type: string) =>
      result.candidates.filter((candidate) => candidate.type === type);

    expect(
      byType('MIN_SPEND').map((candidate) => candidate.minimumSpendMinor),
    ).toContain('7501');
    expect(
      byType('CATEGORY_SPEND')
        .filter((candidate) => candidate.targetId === '101')
        .map((candidate) => candidate.minimumSpendMinor),
    ).toContain('7501');
    expect(
      byType('MERCHANT_SPEND')
        .filter((candidate) => candidate.targetId === '1')
        .map((candidate) => candidate.minimumSpendMinor),
    ).toContain('7501');
  });

  it('blocks an active duplicate and a completed duplicate during its cooldown', () => {
    const facts = [
      receipt('1', 3, 100n),
      receipt('2', 2, 100n),
      receipt('3', 1, 100n),
    ];
    const result = buildQuestInput(
      facts,
      catalog,
      [
        {
          type: 'CATEGORY_SPEND',
          targetId: '101',
          status: 'ACTIVE',
          expiresAt: new Date('2026-10-20T00:00:00.000Z'),
          completedAt: null,
        },
        {
          type: 'PRODUCT_PURCHASE',
          targetId: '11',
          status: 'COMPLETED',
          expiresAt: new Date('2026-10-10T00:00:00.000Z'),
          completedAt: new Date('2026-10-14T00:00:00.000Z'),
        },
      ],
      policy,
      asOf,
    );
    expect(
      result.candidates.some(
        (candidate) =>
          candidate.type === 'CATEGORY_SPEND' && candidate.targetId === '101',
      ),
    ).toBe(false);
    expect(
      result.candidates.some(
        (candidate) =>
          candidate.type === 'PRODUCT_PURCHASE' && candidate.targetId === '11',
      ),
    ).toBe(false);
  });

  it('limits candidates per type and overall after deterministic frequency ordering', () => {
    const broadCatalog: EligibleCatalog = {
      merchants: new Set(['1', '2', '3']),
      products: new Set(['11', '12', '13']),
      categories: new Set(['101', '102', '103']),
    };
    const facts = [
      receipt('1', 5, 100n, '1', [
        { id: 'a', productId: '11', categoryId: '101', lineMinor: 100n },
      ]),
      receipt('2', 4, 100n, '2', [
        { id: 'b', productId: '12', categoryId: '102', lineMinor: 100n },
      ]),
      receipt('3', 3, 100n, '3', [
        { id: 'c', productId: '13', categoryId: '103', lineMinor: 100n },
      ]),
      receipt('4', 2, 100n, '1', [
        { id: 'd', productId: '11', categoryId: '101', lineMinor: 100n },
      ]),
      receipt('5', 1, 100n, '2', [
        { id: 'e', productId: '12', categoryId: '102', lineMinor: 100n },
      ]),
      receipt('6', 1, 100n, '3', [
        { id: 'f', productId: '13', categoryId: '103', lineMinor: 100n },
      ]),
    ];
    const constrained = parseQuestPolicy({
      ...policy,
      candidates: { ...policy.candidates, maximumPerType: 2, maximumTotal: 3 },
    });
    const result = buildQuestInput(facts, broadCatalog, [], constrained, asOf);
    expect(result.candidates).toHaveLength(3);
    expect(
      result.candidates.filter((candidate) => candidate.type === 'MIN_SPEND'),
    ).toHaveLength(2);
  });

  it('rejects receipts whose final total cannot be explained by positive line amounts', () => {
    expect(() =>
      buildQuestInput([receipt('1', 1, 101n)], catalog, [], policy, asOf),
    ).toThrow('exceeds item total');
  });
});
