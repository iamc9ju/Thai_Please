export type QuestType =
  'MIN_SPEND' | 'CATEGORY_SPEND' | 'PRODUCT_PURCHASE' | 'MERCHANT_SPEND';

export function compareNumericIds(left: string, right: string): number {
  if (!/^[0-9]+$/.test(left) || !/^[0-9]+$/.test(right))
    return left < right ? -1 : left > right ? 1 : 0;
  const a = BigInt(left);
  const b = BigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface ReceiptItemFact {
  readonly id: string;
  readonly productId: string;
  readonly categoryId: string;
  readonly lineMinor: bigint;
  readonly quantity: number;
}

export interface ReceiptFact {
  readonly orderId: string;
  readonly userId: string;
  readonly merchantId: string;
  readonly finalMinor: bigint;
  readonly personalMinor?: bigint;
  readonly paidAt: Date;
  readonly items: readonly ReceiptItemFact[];
}

export interface ActiveQuestAssignment {
  readonly userQuestId: string;
  readonly userId: string;
  readonly questId: string;
  readonly type: QuestType;
  readonly targetCategoryId: string | null;
  readonly targetProductId: string | null;
  readonly targetMerchantId: string | null;
  readonly minimumSpendMinor: bigint | null;
  readonly rewardPoints: number;
  readonly assignedAt: Date;
  readonly expiresAt: Date;
  readonly spendBasis?: 'PERSONAL_AFTER_DISCOUNT' | 'FINAL_AFTER_DISCOUNT';
}

export interface QuestCompletionResult {
  readonly userQuestId: string;
  readonly questId: string;
  readonly type: QuestType;
  readonly rewardPoints: number;
}

/**
 * Largest-remainder allocation of net final amount across receipt items.
 * Keeps post-discount category and item spend exact to minor units (satang).
 */
export function allocateNetAcrossItems(
  items: readonly ReceiptItemFact[],
  finalMinor: bigint,
): ReadonlyMap<string, bigint> {
  const gross = items.reduce((sum, item) => sum + item.lineMinor, 0n);
  if (gross === 0n || finalMinor === 0n) {
    return new Map(items.map((item) => [item.id, 0n]));
  }

  const shares = items.map((item) => {
    const numerator = finalMinor * item.lineMinor;
    return {
      id: item.id,
      amount: numerator / gross,
      remainder: numerator % gross,
    };
  });

  let left = finalMinor - shares.reduce((sum, share) => sum + share.amount, 0n);
  shares.sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;
    return compareNumericIds(a.id, b.id);
  });

  for (let index = 0; left > 0n; index += 1, left -= 1n) {
    const share = shares[index];
    if (!share) throw new Error('Invalid allocation remainder');
    share.amount += 1n;
  }

  return new Map(shares.map((share) => [share.id, share.amount]));
}

/** Allocate personal contribution over immutable discounted item amounts. */
export function allocatePersonalAcrossItems(
  items: readonly ReceiptItemFact[],
  finalMinor: bigint,
  personalMinor: bigint,
): ReadonlyMap<string, bigint> {
  const gross = items.reduce((sum, item) => sum + item.lineMinor, 0n);
  if (
    personalMinor < 0n ||
    personalMinor > finalMinor ||
    finalMinor > gross ||
    items.some((item) => item.lineMinor < 0n) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new Error('Invalid personal allocation facts');
  const discounted = allocateNetAcrossItems(items, finalMinor);
  return allocateNetAcrossItems(
    items.map((item) => ({
      ...item,
      lineMinor: discounted.get(item.id) ?? 0n,
    })),
    personalMinor,
  );
}

/**
 * Checks whether a single receipt satisfies the condition of an active quest.
 *
 * Rules:
 * - Single-receipt proof only (no cross-receipt accumulation)
 * - Uses post-discount final amount
 * - Category condition uses post-discount net allocated spend
 * - Receipt paidAt must be strictly within [assignedAt, expiresAt)
 */
export function isQuestConditionSatisfied(
  quest: ActiveQuestAssignment,
  receipt: ReceiptFact,
): boolean {
  if (quest.targetProductId !== null || quest.targetMerchantId !== null)
    return false;
  if (receipt.paidAt < quest.assignedAt || receipt.paidAt >= quest.expiresAt) {
    return false;
  }
  const personal = quest.spendBasis === 'PERSONAL_AFTER_DISCOUNT';
  if (
    personal &&
    (receipt.personalMinor === undefined ||
      receipt.personalMinor < 0n ||
      receipt.personalMinor > receipt.finalMinor)
  )
    return false;
  const spend = personal ? receipt.personalMinor : receipt.finalMinor;
  if (spend === undefined) return false;

  switch (quest.type) {
    case 'MIN_SPEND': {
      if (quest.minimumSpendMinor === null) return false;
      return spend >= quest.minimumSpendMinor;
    }

    case 'CATEGORY_SPEND': {
      if (quest.targetCategoryId === null || quest.minimumSpendMinor === null) {
        return false;
      }
      const netAllocations = personal
        ? allocatePersonalAcrossItems(receipt.items, receipt.finalMinor, spend)
        : allocateNetAcrossItems(receipt.items, receipt.finalMinor);
      let categorySpend = 0n;
      for (const item of receipt.items) {
        if (item.categoryId === quest.targetCategoryId) {
          categorySpend += netAllocations.get(item.id) ?? 0n;
        }
      }
      return categorySpend >= quest.minimumSpendMinor;
    }

    // Kept in historical contracts only; policy v2 never rewards retired types.
    case 'MERCHANT_SPEND':
    case 'PRODUCT_PURCHASE':
      return false;

    default:
      return false;
  }
}

/**
 * Evaluates active quests against a single paid receipt deterministically.
 *
 * Policy:
 * - At most 1 assignment per receipt (maximumAssignmentsPerReceipt: 1).
 * - If multiple active quests match, tie-breaks by:
 *   1. oldest assignedAt ASC
 *   2. lowest userQuestId ASC (numeric comparison)
 */
export function evaluateReceiptForQuests(
  receipt: ReceiptFact,
  activeQuests: readonly ActiveQuestAssignment[],
): QuestCompletionResult | null {
  if (activeQuests.length === 0) return null;

  // Filter only quests owned by this consumer
  const userQuests = activeQuests.filter((q) => q.userId === receipt.userId);
  if (userQuests.length === 0) return null;

  // Sort candidate quests deterministically: oldest assignedAt first, then lowest userQuestId
  const sorted = [...userQuests].sort((a, b) => {
    const timeDiff = a.assignedAt.getTime() - b.assignedAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return compareNumericIds(a.userQuestId, b.userQuestId);
  });

  for (const quest of sorted) {
    if (isQuestConditionSatisfied(quest, receipt)) {
      return {
        userQuestId: quest.userQuestId,
        questId: quest.questId,
        type: quest.type,
        rewardPoints: quest.rewardPoints,
      };
    }
  }

  return null;
}
