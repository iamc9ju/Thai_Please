import type { QuestPolicy } from './domain/quest-policy.js';

export type QuestCandidateType = 'MIN_SPEND' | 'CATEGORY_SPEND';

/** A completed receipt represented without ORM or transport concerns. */
export interface PurchaseFact {
  id: string;
  merchantId: string;
  paidAt: Date;
  /** Final receipt total after all discounts, in integer minor units. */
  finalMinor: bigint;
  items: readonly {
    id: string;
    productId: string;
    categoryId: string;
    /** Pre-discount line amount, in integer minor units. */
    lineMinor: bigint;
  }[];
}

export interface EligibleCatalog {
  readonly categories: ReadonlySet<string>;
}

export interface PriorQuest {
  type: string;
  targetId: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  status: string;
}

export interface Candidate {
  id: string;
  type: QuestCandidateType;
  targetId: string | null;
  minimumSpendMinor: string | null;
  rewardPoints: number;
  durationDays: number;
}

export interface TargetPurchaseSummary {
  id: string;
  orderCount: number;
  totalSpendMinor: string;
  averageOrderMinor: string;
  lastPaidAt: string;
}

export interface PurchaseSummary {
  asOf: string;
  historyStart: string;
  purchases7d: number;
  purchases30d: number;
  totalSpendMinor: string;
  averageOrderMinor: string | null;
  categories: readonly TargetPurchaseSummary[];
}

export interface QuestInput {
  summary: PurchaseSummary;
  candidates: Candidate[];
}

interface Aggregate {
  orderCount: number;
  total: bigint;
  lastPaidAt: Date;
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Builds Gemini-safe, JSON-compatible input. It has no database or Nest dependency,
 * so every value-moving decision remains outside this preparation step.
 */
export function buildQuestInput(
  facts: readonly PurchaseFact[],
  catalog: EligibleCatalog,
  prior: readonly PriorQuest[],
  policy: QuestPolicy,
  asOf: Date,
): QuestInput {
  assertValidDate(asOf, 'asOf');
  const historyStart = subtractDays(asOf, policy.candidates.historyDays);
  const recentStart = subtractDays(asOf, policy.candidates.recentHistoryDays);
  const receipts = facts
    .map(validateFact)
    .filter((fact) => fact.paidAt >= historyStart && fact.paidAt < asOf);
  const recentCount = receipts.filter(
    (fact) => fact.paidAt >= recentStart,
  ).length;
  const total = receipts.reduce((sum, fact) => sum + fact.finalMinor, 0n);
  const summary = buildSummary(
    receipts,
    asOf,
    historyStart,
    recentCount,
    total,
  );

  if (receipts.length < policy.candidates.minimumHistoryOrders) {
    return { summary, candidates: [] };
  }

  const blocked = buildBlockedKeys(prior, policy, asOf);
  const candidates = buildCandidates(receipts, catalog, blocked, policy);
  return { summary, candidates };
}

function buildSummary(
  receipts: readonly PurchaseFact[],
  asOf: Date,
  historyStart: Date,
  recentCount: number,
  total: bigint,
): PurchaseSummary {
  const categories = new Map<string, Aggregate>();
  for (const receipt of receipts) {
    const allocated = allocateNetAcrossItems(receipt);
    const perCategory = new Map<string, bigint>();
    for (const item of receipt.items) {
      const amount = allocated.get(item.id);
      if (amount === undefined) throw new Error('Missing allocated order item');
      perCategory.set(
        item.categoryId,
        (perCategory.get(item.categoryId) ?? 0n) + amount,
      );
    }
    for (const [id, amount] of perCategory)
      addAggregate(categories, id, amount, receipt.paidAt);
  }
  return {
    asOf: asOf.toISOString(),
    historyStart: historyStart.toISOString(),
    purchases7d: recentCount,
    purchases30d: receipts.length,
    totalSpendMinor: total.toString(),
    averageOrderMinor:
      receipts.length === 0
        ? null
        : (total / BigInt(receipts.length)).toString(),
    categories: serializeAggregates(categories),
  };
}

function buildCandidates(
  receipts: readonly PurchaseFact[],
  catalog: EligibleCatalog,
  blocked: ReadonlySet<string>,
  policy: QuestPolicy,
): Candidate[] {
  const total = receipts.reduce((sum, receipt) => sum + receipt.finalMinor, 0n);
  const output: Candidate[] = [];
  const append = (candidate: Candidate): void => {
    if (!blocked.has(identity(candidate.type, candidate.targetId)))
      output.push(candidate);
  };

  if (policy.candidates.types.includes('MIN_SPEND')) {
    for (const amount of spendAmounts(total, BigInt(receipts.length), policy)) {
      append(spendCandidate('MIN_SPEND', null, amount, policy));
    }
  }

  const categoryStats = targetStats(receipts);
  if (policy.candidates.types.includes('CATEGORY_SPEND')) {
    for (const stat of sortedEligible(
      categoryStats,
      catalog.categories,
      policy,
    )) {
      for (const amount of spendAmounts(
        stat.total,
        BigInt(stat.orderCount),
        policy,
      )) {
        append(spendCandidate('CATEGORY_SPEND', stat.id, amount, policy));
      }
    }
  }

  return capCandidates(output, policy);
}

function targetStats(
  receipts: readonly PurchaseFact[],
): Map<string, Aggregate> {
  const stats = new Map<string, Aggregate>();
  for (const receipt of receipts) {
    const allocation = allocateNetAcrossItems(receipt);
    const perTarget = new Map<string, bigint>();
    for (const item of receipt.items) {
      const key = item.categoryId;
      const amount = allocation.get(item.id);
      if (amount === undefined) throw new Error('Missing allocated order item');
      perTarget.set(key, (perTarget.get(key) ?? 0n) + amount);
    }
    for (const [id, amount] of perTarget)
      addAggregate(stats, id, amount, receipt.paidAt);
  }
  return stats;
}

function sortedEligible(
  stats: ReadonlyMap<string, Aggregate>,
  eligible: ReadonlySet<string>,
  policy: QuestPolicy,
): readonly (Aggregate & { id: string })[] {
  return [...stats.entries()]
    .filter(
      ([id, stat]) =>
        eligible.has(id) &&
        stat.orderCount >= policy.candidates.minimumTargetOrders,
    )
    .map(([id, stat]) => ({ id, ...stat }))
    .sort(
      (left, right) =>
        right.orderCount - left.orderCount ||
        right.lastPaidAt.getTime() - left.lastPaidAt.getTime() ||
        compareNumericIds(left.id, right.id),
    );
}

function spendCandidate(
  type: QuestCandidateType,
  targetId: string | null,
  amount: bigint,
  policy: QuestPolicy,
): Candidate {
  return {
    id: candidateId(type, targetId, amount),
    type,
    targetId,
    minimumSpendMinor: amount.toString(),
    rewardPoints: policy.rewards.pointsByType[type],
    durationDays: policy.assignment.durationDays,
  };
}

function spendAmounts(
  total: bigint,
  orderCount: bigint,
  policy: QuestPolicy,
): readonly bigint[] {
  const minimum = BigInt(policy.candidates.minimumSpendMinorUnits);
  const maximum = BigInt(policy.candidates.maximumSpendMinorUnits);
  const amounts = new Set<bigint>();
  for (const ratio of policy.candidates.spendMultipliers) {
    // Do not floor the average before applying the ratio: it loses a minor unit
    // for fractional averages. The threshold is ceil(total * ratio / count).
    const amount = ceilDivide(
      total * BigInt(ratio.numerator),
      orderCount * BigInt(ratio.denominator),
    );
    // A candidate must be within the policy's stated spend range. Never silently
    // turn an inaccessible target into a different quest by clamping it.
    if (amount >= minimum && amount <= maximum) amounts.add(amount);
  }
  return [...amounts].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function capCandidates(
  candidates: readonly Candidate[],
  policy: QuestPolicy,
): Candidate[] {
  const byType = new Map<QuestCandidateType, number>();
  const unique = new Set<string>();
  const capped: Candidate[] = [];
  for (const candidate of candidates) {
    const perType = byType.get(candidate.type) ?? 0;
    if (
      perType >= policy.candidates.maximumPerType ||
      capped.length >= policy.candidates.maximumTotal
    )
      continue;
    if (unique.has(candidate.id)) continue;
    unique.add(candidate.id);
    byType.set(candidate.type, perType + 1);
    capped.push(candidate);
  }
  return capped;
}

function buildBlockedKeys(
  prior: readonly PriorQuest[],
  policy: QuestPolicy,
  asOf: Date,
): ReadonlySet<string> {
  const blocked = new Set<string>();
  for (const quest of prior) {
    if (quest.status === 'CANCELLED') continue;
    if (!isSupportedType(quest.type)) continue;
    assertValidDate(quest.expiresAt, 'prior expiry');
    if (quest.completedAt !== null)
      assertValidDate(quest.completedAt, 'prior completion');
    const key = identity(quest.type, quest.targetId);
    if (quest.status === 'ACTIVE' && quest.expiresAt > asOf) {
      blocked.add(key);
      continue;
    }
    const finalizedAt = quest.completedAt ?? quest.expiresAt;
    if (asOf < addDays(finalizedAt, policy.assignment.duplicateCooldownDays))
      blocked.add(key);
  }
  return blocked;
}

function validateFact(fact: PurchaseFact): PurchaseFact {
  assertValidDate(fact.paidAt, `receipt ${fact.id} paidAt`);
  if (fact.finalMinor < 0n)
    throw new Error(`Receipt ${fact.id} has negative final amount`);
  if (fact.items.length === 0)
    throw new Error(`Receipt ${fact.id} has no items`);
  let gross = 0n;
  const itemIds = new Set<string>();
  for (const item of fact.items) {
    if (!item.id || itemIds.has(item.id))
      throw new Error(`Receipt ${fact.id} has duplicate or blank item id`);
    itemIds.add(item.id);
    if (item.lineMinor < 0n)
      throw new Error(`Receipt ${fact.id} has negative item amount`);
    gross += item.lineMinor;
  }
  if (fact.finalMinor > gross)
    throw new Error(`Receipt ${fact.id} final amount exceeds item total`);
  return fact;
}

/** Largest-remainder allocation keeps discounted category/product totals exact. */
function allocateNetAcrossItems(
  receipt: PurchaseFact,
): ReadonlyMap<string, bigint> {
  const gross = receipt.items.reduce((sum, item) => sum + item.lineMinor, 0n);
  if (gross === 0n) return new Map(receipt.items.map((item) => [item.id, 0n]));
  const shares = receipt.items.map((item) => {
    const numerator = receipt.finalMinor * item.lineMinor;
    return {
      id: item.id,
      amount: numerator / gross,
      remainder: numerator % gross,
    };
  });
  let left =
    receipt.finalMinor - shares.reduce((sum, share) => sum + share.amount, 0n);
  shares.sort((a, b) =>
    a.remainder > b.remainder
      ? -1
      : a.remainder < b.remainder
        ? 1
        : compareNumericIds(a.id, b.id),
  );
  for (let index = 0; left > 0n; index += 1, left -= 1n) {
    const share = shares[index];
    if (!share) throw new Error('Invalid allocation remainder');
    share.amount += 1n;
  }
  return new Map(shares.map((share) => [share.id, share.amount]));
}

function addAggregate(
  map: Map<string, Aggregate>,
  id: string,
  amount: bigint,
  paidAt: Date,
): void {
  const prior = map.get(id);
  if (prior) {
    prior.orderCount += 1;
    prior.total += amount;
    if (paidAt > prior.lastPaidAt) prior.lastPaidAt = paidAt;
  } else map.set(id, { orderCount: 1, total: amount, lastPaidAt: paidAt });
}

function serializeAggregates(
  map: ReadonlyMap<string, Aggregate>,
): readonly TargetPurchaseSummary[] {
  return [...map.entries()]
    .map(([id, value]) => ({
      id,
      orderCount: value.orderCount,
      totalSpendMinor: value.total.toString(),
      averageOrderMinor: (value.total / BigInt(value.orderCount)).toString(),
      lastPaidAt: value.lastPaidAt.toISOString(),
    }))
    .sort((left, right) => compareNumericIds(left.id, right.id));
}

function candidateId(
  type: QuestCandidateType,
  targetId: string | null,
  amount: bigint | null,
): string {
  return `${type}:${targetId ?? 'ALL'}:${amount?.toString() ?? 'ITEM'}`;
}
function identity(type: string, targetId: string | null): string {
  return `${type}:${targetId ?? 'ALL'}`;
}
function isSupportedType(type: string): type is QuestCandidateType {
  return ['MIN_SPEND', 'CATEGORY_SPEND'].includes(type);
}
function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}
function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * DAY_MILLISECONDS);
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MILLISECONDS);
}
function assertValidDate(value: Date, label: string): void {
  if (Number.isNaN(value.getTime())) throw new Error(`Invalid ${label}`);
}
function compareNumericIds(left: string, right: string): number {
  if (!/^[0-9]+$/.test(left) || !/^[0-9]+$/.test(right))
    return left < right ? -1 : left > right ? 1 : 0;
  const a = BigInt(left);
  const b = BigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}
