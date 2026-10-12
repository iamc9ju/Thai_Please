export type SpendQuestRule = { minimumAmount: number; categoryId?: number };
export type ReceiptFacts = {
  finalAmount: number;
  categoryIds: readonly number[];
};

export function satisfiesSpendQuest(
  rule: SpendQuestRule,
  receipt: ReceiptFacts,
): boolean {
  return (
    receipt.finalAmount >= rule.minimumAmount &&
    (rule.categoryId === undefined ||
      receipt.categoryIds.includes(rule.categoryId))
  );
}
