import { readFileSync } from 'node:fs';
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
      categories: new Set(['1']),
    },
    [],
    policy,
    asOf,
  );
  expect(input.summary.totalSpendMinor).toBe('0');
  expect(input.candidates).toEqual([]);
});

const policy = parseQuestPolicy(
  JSON.parse(
    readFileSync(
      new URL('./config/quest-policy.json', import.meta.url),
      'utf8',
    ),
  ) as unknown,
);
policy.candidates.minimumSpendMinorUnits = 1;

const catalog: EligibleCatalog = {
  categories: new Set(['101', '102']),
};
const asOf = new Date('2026-10-16T00:00:00.000Z');

it('generates only cross-store spend/category candidates and ignores cancelled cooldowns', () => {
  const facts = [
    receipt('1', 3, 100n, '1'),
    receipt('2', 2, 100n, '2'),
    receipt('3', 1, 100n, '1'),
  ];
  const input = buildQuestInput(
    facts,
    catalog,
    [
      {
        type: 'CATEGORY_SPEND',
        targetId: '101',
        status: 'CANCELLED',
        completedAt: null,
        expiresAt: new Date('2099-01-01T00:00:00Z'),
      },
    ],
    policy,
    asOf,
  );
  expect(input.candidates.length).toBeGreaterThan(0);
  expect(
    input.candidates.every(
      (c) => c.type === 'MIN_SPEND' || c.type === 'CATEGORY_SPEND',
    ),
  ).toBe(true);
  expect(
    input.candidates.some(
      (c) => c.type === 'CATEGORY_SPEND' && c.targetId === '101',
    ),
  ).toBe(true);
  expect(input.candidates.length).toBeLessThanOrEqual(8);
  expect(input.summary).not.toHaveProperty('merchants');
  expect(input.summary).not.toHaveProperty('products');
});

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
          type: 'MIN_SPEND',
          targetId: null,
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
      result.candidates.some((candidate) => candidate.type === 'MIN_SPEND'),
    ).toBe(false);
  });

  it('limits candidates per type and overall after deterministic frequency ordering', () => {
    const broadCatalog: EligibleCatalog = {
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
