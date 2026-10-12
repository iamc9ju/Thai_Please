export type PointAllocationFact = {
  id: number;
  remainingAmount: number;
  expiresAt: Date;
};

export type PointDeduction = { id: number; amount: number };

export function planPointRedemption(
  allocations: readonly PointAllocationFact[],
  cost: number,
  now: Date,
): { sufficient: boolean; deductions: PointDeduction[] } {
  const usable = allocations
    .filter(
      (allocation) =>
        allocation.remainingAmount > 0 && allocation.expiresAt > now,
    )
    .sort(
      (left, right) =>
        left.expiresAt.getTime() - right.expiresAt.getTime() ||
        left.id - right.id,
    );
  const balance = usable.reduce(
    (sum, allocation) => sum + allocation.remainingAmount,
    0,
  );
  if (balance < cost) return { sufficient: false, deductions: [] };
  let remaining = cost;
  const deductions: PointDeduction[] = [];
  for (const allocation of usable) {
    if (remaining === 0) break;
    const amount = Math.min(remaining, allocation.remainingAmount);
    deductions.push({ id: allocation.id, amount });
    remaining -= amount;
  }
  return { sufficient: true, deductions };
}
