import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseQuestPolicy } from './domain/quest-policy.js';
import {
  buildProposalSummary,
  validateProposals,
  proposalRules,
} from './quest-proposals.js';
import type { PurchaseFact, PriorQuest } from './quest-candidates.js';
const policy = parseQuestPolicy(
  JSON.parse(
    readFileSync(
      new URL('./config/quest-policy.json', import.meta.url),
      'utf8',
    ),
  ),
);
const now = new Date('2026-10-28T00:00:00Z');
const catalog = {
  categories: new Set(['1', '2']),
  categoryNames: new Map([
    ['1', 'Food'],
    ['2', 'Goods'],
  ]),
};
function fact(
  id: string,
  personal: bigint,
  final = personal,
  paidAt = new Date('2026-10-20T00:00:00Z'),
): PurchaseFact {
  return {
    id,
    merchantId: '1',
    paidAt,
    personalMinor: personal,
    finalMinor: final,
    items: [{ id, productId: '1', categoryId: '1', lineMinor: final }],
  };
}
const total = (amount: string) => ({
  type: 'MIN_SPEND',
  targetId: null,
  minimumSpendMinor: amount,
});
describe('FR-S01 minimized proposal summary', () => {
  it('shows the normal distribution despite large bills, using personal amounts only', () => {
    const amounts = [
      4000, 4500, 5000, 5000, 5500, 6000, 6000, 6500, 6500, 7000, 7500, 8500,
      4000, 5000, 6000, 7000, 8000, 9000, 11000, 14000, 300000, 300000, 300000,
      300000, 300000,
    ];
    const summary = buildProposalSummary(
      amounts.map((a, i) => fact(String(i + 1), BigInt(a), BigInt(a) * 2n)),
      catalog,
      [],
      policy,
      now,
    );
    expect(summary.purchases.receiptCount).toBe(25);
    expect(summary.purchases.averagePersonalMinor).toBe('65440');
    expect(summary.purchases.medianPersonalMinor).toBe('7000');
    expect(summary.purchases.distribution.map((b) => b.receiptCount)).toEqual([
      18, 2, 0, 5,
    ]);
    expect(JSON.stringify(summary)).not.toContain('merchantId');
  });
  it('allocates discounted personal contribution once across mixed categories', () => {
    const r = fact('1', 5001n, 8001n);
    r.items = [
      { id: '1', productId: '1', categoryId: '1', lineMinor: 6000n },
      { id: '2', productId: '2', categoryId: '2', lineMinor: 4000n },
    ];
    const s = buildProposalSummary([r], catalog, [], policy, now);
    expect(s.purchases.categories.map((c) => c.averagePersonalMinor)).toEqual([
      '3001',
      '2000',
    ]);
    expect(s.purchases.averagePersonalMinor).toBe('5001');
  });
  it('uses inclusive history start and exclusive asOf, and supports empty facts honestly', () => {
    const start = new Date(now.getTime() - 30 * 86400000);
    const s = buildProposalSummary(
      [
        fact('1', 1000n, 1000n, start),
        fact('2', 1000n, 1000n, now),
        fact('3', 1000n, 1000n, new Date(start.getTime() - 1)),
      ],
      catalog,
      [],
      policy,
      now,
    );
    expect(s.purchases.receiptCount).toBe(1);
    expect(
      buildProposalSummary([], catalog, [], policy, now).purchases
        .medianPersonalMinor,
    ).toBeNull();
  });
  it('keeps old basis separate and cancellation out of failures', () => {
    const q: PriorQuest = {
      type: 'MIN_SPEND',
      targetId: null,
      minimumSpendMinor: '6000',
      assignedAt: new Date('2026-10-01T00:00:00Z'),
      expiresAt: new Date('2026-10-08T00:00:00Z'),
      completedAt: null,
      status: 'CANCELLED',
      ruleVersion: 'FINAL_AFTER_DISCOUNT',
    };
    const s = buildProposalSummary(
      [],
      catalog,
      [
        q,
        {
          ...q,
          status: 'COMPLETED',
          completedAt: new Date('2026-10-02T00:00:00Z'),
          ruleVersion: 'PERSONAL_AFTER_DISCOUNT',
        },
      ],
      policy,
      now,
    );
    expect(s.questHistory.outcomes).toHaveLength(2);
    expect(s.questHistory.outcomes[0]).toMatchObject({
      cancelled: 1,
      expired: 0,
    });
  });
});
describe('FR-S03 proposal validation', () => {
  it('accepts targets above 100 THB, enriches only from server policy and filters individual failures', () => {
    const result = validateProposals(
      [
        total('150000'),
        total('9313'),
        { ...total('6000'), rewardPoints: 200 },
        { type: 'CATEGORY_SPEND', targetId: '99', minimumSpendMinor: '6000' },
        total('6000'),
        total('6000'),
      ],
      catalog,
      [],
      policy,
      now,
    );
    expect(result.accepted.map((c) => c.minimumSpendMinor)).toEqual([
      '150000',
      '6000',
    ]);
    expect(result.accepted[0]).toMatchObject({
      rewardPoints: 20,
      durationDays: 7,
    });
    expect(result.rejections).toHaveLength(4);
  });
  it('retains existing valid proposals while filling only missing slots', () => {
    const first = validateProposals([total('6000')], catalog, [], policy, now);
    const next = validateProposals(
      [total('6000'), total('7000'), total('8000'), total('9000')],
      catalog,
      [],
      policy,
      now,
      first.accepted,
    );
    expect(next.accepted.map((c) => c.minimumSpendMinor)).toEqual([
      '6000',
      '7000',
      '8000',
    ]);
    expect(next.rejections).toEqual(['PROPOSAL_DUPLICATE', 'PROPOSAL_LIMIT']);
  });
  it('blocks exact type, target and amount until cooldown boundary', () => {
    const q: PriorQuest = {
      type: 'MIN_SPEND',
      targetId: null,
      minimumSpendMinor: '6000',
      expiresAt: new Date(now.getTime() - 86400000),
      completedAt: new Date(now.getTime() - 86400000),
      status: 'COMPLETED',
    };
    expect(
      validateProposals(
        [total('6000'), total('7000')],
        catalog,
        [q],
        policy,
        now,
      ).accepted.map((c) => c.minimumSpendMinor),
    ).toEqual(['7000']);
    const boundary = new Date(now.getTime() + 6 * 86400000);
    expect(
      validateProposals([total('6000')], catalog, [q], policy, boundary)
        .accepted,
    ).toHaveLength(1);
    expect(
      proposalRules(catalog, [q], policy, now).blockedProposals,
    ).toHaveLength(1);
  });
  it.each(['0', '-1000', '100.00', '1000000000000'])(
    'rejects nonrepresentable target %s',
    (value) => {
      expect(
        validateProposals([total(value)], catalog, [], policy, now).accepted,
      ).toHaveLength(0);
    },
  );
});
