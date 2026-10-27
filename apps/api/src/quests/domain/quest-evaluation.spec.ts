import { describe, expect, it } from 'vitest';
import {
  allocateNetAcrossItems,
  allocatePersonalAcrossItems,
  evaluateReceiptForQuests,
  isQuestConditionSatisfied,
  type ActiveQuestAssignment,
  type ReceiptFact,
} from './quest-evaluation.js';

describe('Quest Evaluation (FR-S06)', () => {
  const baseDate = new Date('2026-10-16T12:00:00.000Z');
  const assignedAt = new Date('2026-10-15T08:00:00.000Z');
  const expiresAt = new Date('2026-10-22T08:00:00.000Z');

  const createReceipt = (overrides?: Partial<ReceiptFact>): ReceiptFact => ({
    orderId: '100',
    userId: '1',
    merchantId: '10',
    finalMinor: 10000n, // 100.00 THB
    paidAt: baseDate,
    items: [
      {
        id: '1',
        productId: '201',
        categoryId: '1',
        lineMinor: 6000n,
        quantity: 1,
      },
      {
        id: '2',
        productId: '202',
        categoryId: '2',
        lineMinor: 4000n,
        quantity: 1,
      },
    ],
    ...overrides,
  });

  const createQuest = (
    overrides?: Partial<ActiveQuestAssignment>,
  ): ActiveQuestAssignment => ({
    userQuestId: '1',
    userId: '1',
    questId: '10',
    type: 'MIN_SPEND',
    targetCategoryId: null,
    targetProductId: null,
    targetMerchantId: null,
    minimumSpendMinor: 10000n, // 100.00 THB
    rewardPoints: 20,
    assignedAt,
    expiresAt,
    ...overrides,
  });

  it('personal quests exclude subsidy and fail closed when contribution is missing', () => {
    const quest = createQuest({
      spendBasis: 'PERSONAL_AFTER_DISCOUNT',
      minimumSpendMinor: 6000n,
    });
    expect(
      isQuestConditionSatisfied(quest, createReceipt({ personalMinor: 5000n })),
    ).toBe(false);
    expect(
      isQuestConditionSatisfied(quest, createReceipt({ personalMinor: 6000n })),
    ).toBe(true);
    expect(
      isQuestConditionSatisfied(quest, createReceipt({ personalMinor: 0n })),
    ).toBe(false);
    expect(isQuestConditionSatisfied(quest, createReceipt())).toBe(false);
  });

  it('personal category quests allocate only the personal part, not the entire bill', () => {
    const quest = createQuest({
      spendBasis: 'PERSONAL_AFTER_DISCOUNT',
      type: 'CATEGORY_SPEND',
      targetCategoryId: '1',
      minimumSpendMinor: 4000n,
    });
    expect(
      isQuestConditionSatisfied(quest, createReceipt({ personalMinor: 5000n })),
    ).toBe(false);
    expect(
      isQuestConditionSatisfied(
        { ...quest, minimumSpendMinor: 3000n },
        createReceipt({ personalMinor: 5000n }),
      ),
    ).toBe(true);
  });

  it('personal allocation conserves satang after discount and uses deterministic tie-breaks', () => {
    const items = createReceipt().items;
    const shares = allocatePersonalAcrossItems(items, 8001n, 5001n);
    expect([...shares.values()].reduce((sum, value) => sum + value, 0n)).toBe(
      5001n,
    );
    expect(shares.get('1')).toBe(3001n);
    expect(shares.get('2')).toBe(2000n);
    expect(() => allocatePersonalAcrossItems(items, 8001n, 9000n)).toThrow();
  });

  describe('allocateNetAcrossItems', () => {
    it('allocates net amount proportionally using largest remainder', () => {
      const items = [
        {
          id: '1',
          productId: '10',
          categoryId: '1',
          lineMinor: 1000n,
          quantity: 1,
        },
        {
          id: '2',
          productId: '20',
          categoryId: '1',
          lineMinor: 2000n,
          quantity: 1,
        },
      ];
      // Total 3000 gross, discounted to 1500 net
      const allocated = allocateNetAcrossItems(items, 1500n);
      expect(allocated.get('1')).toBe(500n);
      expect(allocated.get('2')).toBe(1000n);
    });

    it('handles zero gross or final amount safely', () => {
      const items = [
        {
          id: '1',
          productId: '10',
          categoryId: '1',
          lineMinor: 1000n,
          quantity: 1,
        },
      ];
      const allocated = allocateNetAcrossItems(items, 0n);
      expect(allocated.get('1')).toBe(0n);
    });
  });

  describe('MIN_SPEND Evaluation', () => {
    it('satisfies quest when finalAmount >= minimumSpend', () => {
      const quest = createQuest({
        type: 'MIN_SPEND',
        minimumSpendMinor: 10000n,
      });
      const receipt = createReceipt({ finalMinor: 10000n });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(true);
    });

    it('satisfies quest when finalAmount exceeds minimumSpend', () => {
      const quest = createQuest({
        type: 'MIN_SPEND',
        minimumSpendMinor: 10000n,
      });
      const receipt = createReceipt({ finalMinor: 15000n });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(true);
    });

    it('fails when discount reduces spend below threshold (Requirement example)', () => {
      // Example from REQUIREMENTS:
      // Subtotal = 100, Discount = 10, Final Amount = 90
      // Quest threshold = 100 -> ผลลัพธ์: ไม่สำเร็จ
      const quest = createQuest({
        type: 'MIN_SPEND',
        minimumSpendMinor: 10000n, // 100.00 THB
      });
      const receipt = createReceipt({ finalMinor: 9000n }); // 90.00 THB
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });
  });

  describe('CATEGORY_SPEND Evaluation', () => {
    it('does not reinterpret a legacy category quest that had a merchant binding', () => {
      const quest = createQuest({
        type: 'CATEGORY_SPEND',
        targetCategoryId: '1',
        targetMerchantId: '10',
        minimumSpendMinor: 1000n,
      });
      expect(isQuestConditionSatisfied(quest, createReceipt())).toBe(false);
    });
    it('accepts the same category from different shops and product IDs', () => {
      const quest = createQuest({
        type: 'CATEGORY_SPEND',
        targetCategoryId: '1',
        minimumSpendMinor: 5000n,
      });
      for (const merchantId of ['10', '99']) {
        const receipt = createReceipt({
          merchantId,
          finalMinor: 9000n,
          items: [
            {
              id: '1',
              productId: merchantId === '10' ? '201' : '999',
              categoryId: '1',
              lineMinor: 10000n,
              quantity: 1,
            },
          ],
        });
        expect(isQuestConditionSatisfied(quest, receipt)).toBe(true);
      }
    });
    it('satisfies quest when net category spend meets threshold', () => {
      const quest = createQuest({
        type: 'CATEGORY_SPEND',
        targetCategoryId: '1',
        minimumSpendMinor: 5000n, // 50.00 THB
      });
      // Receipt has items in category 1 (6000 gross) and category 2 (4000 gross) = 10000 gross
      // final is 9000 (10% discount). Category 1 net = 6000 * 0.9 = 5400 >= 5000
      const receipt = createReceipt({ finalMinor: 9000n });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(true);
    });

    it('fails when net category spend is below threshold after discount', () => {
      const quest = createQuest({
        type: 'CATEGORY_SPEND',
        targetCategoryId: '1',
        minimumSpendMinor: 6000n, // 60.00 THB
      });
      // Gross category 1 is 6000, but final has discount making category 1 net 5400 < 6000
      const receipt = createReceipt({ finalMinor: 9000n });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });

    it('ignores spend in other categories', () => {
      const quest = createQuest({
        type: 'CATEGORY_SPEND',
        targetCategoryId: '999', // Non-matching category
        minimumSpendMinor: 1000n,
      });
      const receipt = createReceipt({ finalMinor: 10000n });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });
  });

  describe('MERCHANT_SPEND Evaluation', () => {
    it('rejects retired merchant quests even when the merchant matches', () => {
      const quest = createQuest({
        type: 'MERCHANT_SPEND',
        targetMerchantId: '10',
        minimumSpendMinor: 8000n,
      });
      const receipt = createReceipt({ merchantId: '10', finalMinor: 8000n });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });

    it('fails when merchant does not match even if spend is enough', () => {
      const quest = createQuest({
        type: 'MERCHANT_SPEND',
        targetMerchantId: '99',
        minimumSpendMinor: 5000n,
      });
      const receipt = createReceipt({ merchantId: '10', finalMinor: 10000n });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });
  });

  describe('PRODUCT_PURCHASE Evaluation', () => {
    it('rejects retired product quests even when the product matches', () => {
      const quest = createQuest({
        type: 'PRODUCT_PURCHASE',
        targetProductId: '201',
      });
      const receipt = createReceipt();
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });

    it('fails when targeted product is not in the receipt', () => {
      const quest = createQuest({
        type: 'PRODUCT_PURCHASE',
        targetProductId: '999',
      });
      const receipt = createReceipt();
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });
  });

  describe('Date Boundaries', () => {
    it('fails when paidAt is before assignedAt', () => {
      const quest = createQuest({
        assignedAt: new Date('2026-10-15T08:00:00Z'),
      });
      const receipt = createReceipt({
        paidAt: new Date('2026-10-15T07:59:59Z'),
      });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });

    it('fails when paidAt is at or after expiresAt', () => {
      const quest = createQuest({
        expiresAt: new Date('2026-10-22T08:00:00Z'),
      });
      const receipt = createReceipt({
        paidAt: new Date('2026-10-22T08:00:00Z'),
      });
      expect(isQuestConditionSatisfied(quest, receipt)).toBe(false);
    });
  });

  describe('evaluateReceiptForQuests and Tie-breaking', () => {
    it('returns null when no active quests match', () => {
      const quest = createQuest({ minimumSpendMinor: 50000n });
      const receipt = createReceipt({ finalMinor: 10000n });
      expect(evaluateReceiptForQuests(receipt, [quest])).toBeNull();
    });

    it('completes only one quest per receipt with oldest assignedAt first', () => {
      const olderQuest = createQuest({
        userQuestId: '2',
        assignedAt: new Date('2026-10-14T08:00:00Z'),
        minimumSpendMinor: 5000n,
      });
      const newerQuest = createQuest({
        userQuestId: '1',
        assignedAt: new Date('2026-10-15T08:00:00Z'),
        minimumSpendMinor: 5000n,
      });
      const receipt = createReceipt({ finalMinor: 10000n });

      const result = evaluateReceiptForQuests(receipt, [
        newerQuest,
        olderQuest,
      ]);
      expect(result).not.toBeNull();
      expect(result?.userQuestId).toBe('2'); // older assignedAt
    });

    it('tie-breaks by lowest userQuestId when assignedAt is identical', () => {
      const questA = createQuest({
        userQuestId: '10',
        assignedAt,
        minimumSpendMinor: 5000n,
      });
      const questB = createQuest({
        userQuestId: '5',
        assignedAt,
        minimumSpendMinor: 5000n,
      });
      const receipt = createReceipt({ finalMinor: 10000n });

      const result = evaluateReceiptForQuests(receipt, [questA, questB]);
      expect(result).not.toBeNull();
      expect(result?.userQuestId).toBe('5'); // lowest ID numerically
    });

    it('ignores quests belonging to other users', () => {
      const foreignQuest = createQuest({
        userId: '999',
        minimumSpendMinor: 1000n,
      });
      const receipt = createReceipt({ userId: '1', finalMinor: 10000n });
      expect(evaluateReceiptForQuests(receipt, [foreignQuest])).toBeNull();
    });
  });
});
