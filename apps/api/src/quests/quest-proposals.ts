import { z } from 'zod';
import type {
  Candidate,
  EligibleCatalog,
  PriorQuest,
  PurchaseFact,
} from './quest-candidates.js';
import type { QuestPolicy } from './domain/quest-policy.js';
import {
  allocatePersonalAcrossItems,
  compareNumericIds,
} from './domain/quest-evaluation.js';

export const QUEST_AMOUNT_BASIS = 'PERSONAL_AFTER_DISCOUNT';
export const QUEST_SUMMARY_VERSION = 'personal-summary-v1';
/** Decimal(12,2) storage limit, not a business spending target or recommendation. */
export const QUEST_TECHNICAL_MAXIMUM_MINOR = 999999999999n;
const DAY_MS = 86_400_000;
const amount = z.string().regex(/^[1-9][0-9]{0,11}$/);
export const ProposalSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('MIN_SPEND'),
    targetId: z.null(),
    minimumSpendMinor: amount,
  }),
  z.strictObject({
    type: z.literal('CATEGORY_SPEND'),
    targetId: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .max(30),
    minimumSpendMinor: amount,
  }),
]);
export type Proposal = z.infer<typeof ProposalSchema>;
export interface ProposalRules {
  readonly policyVersion: string;
  readonly amountBasis: typeof QUEST_AMOUNT_BASIS;
  readonly allowedTypes: readonly string[];
  readonly allowedCategories: readonly { id: string; name: string }[];
  readonly spendStepMinor: string;
  readonly technicalMaximumSpendMinor: string;
  readonly blockedProposals: readonly {
    type: string;
    targetId: string | null;
    minimumSpendMinor: string | null;
  }[];
}

export function proposalIdentity(
  proposal: Pick<Proposal, 'type' | 'targetId' | 'minimumSpendMinor'>,
): string {
  return `${proposal.type}:${proposal.targetId ?? 'ALL'}:${proposal.minimumSpendMinor}`;
}

export function isPriorBlocking(
  prior: PriorQuest,
  policy: QuestPolicy,
  asOf: Date,
): boolean {
  if (prior.status === 'CANCELLED') return false;
  if (prior.status === 'ACTIVE' && prior.expiresAt > asOf) return true;
  const finalized = prior.completedAt ?? prior.expiresAt;
  return (
    finalized <= asOf &&
    asOf.getTime() <
      finalized.getTime() + policy.assignment.duplicateCooldownDays * DAY_MS
  );
}

export function proposalRules(
  catalog: EligibleCatalog,
  prior: readonly PriorQuest[],
  policy: QuestPolicy,
  asOf: Date,
): ProposalRules {
  return {
    policyVersion: policy.version,
    amountBasis: QUEST_AMOUNT_BASIS,
    allowedTypes: policy.candidates.types,
    allowedCategories: [...catalog.categories]
      .sort(compareNumericIds)
      .map((id) => ({ id, name: catalog.categoryNames?.get(id) ?? id })),
    spendStepMinor: String(policy.proposals.spendStepMinorUnits),
    technicalMaximumSpendMinor: QUEST_TECHNICAL_MAXIMUM_MINOR.toString(),
    blockedProposals: prior
      .filter((p) => isPriorBlocking(p, policy, asOf))
      .map((p) => ({
        type: p.type,
        targetId: p.targetId,
        minimumSpendMinor: p.minimumSpendMinor ?? null,
      })),
  };
}

export function validateProposals(
  raw: readonly unknown[],
  catalog: EligibleCatalog,
  prior: readonly PriorQuest[],
  policy: QuestPolicy,
  asOf: Date,
  accepted: readonly Candidate[] = [],
): { accepted: Candidate[]; rejections: string[] } {
  const output = [...accepted];
  const seen = new Set(output.map((p) => p.id));
  const rejections: string[] = [];
  for (const value of raw) {
    const parsed = ProposalSchema.safeParse(value);
    if (!parsed.success) {
      rejections.push('PROPOSAL_SCHEMA_INVALID');
      continue;
    }
    const p = parsed.data;
    const spend = BigInt(p.minimumSpendMinor);
    if (
      spend > QUEST_TECHNICAL_MAXIMUM_MINOR ||
      spend % BigInt(policy.proposals.spendStepMinorUnits) !== 0n
    ) {
      rejections.push('PROPOSAL_AMOUNT_INVALID');
      continue;
    }
    if (
      !policy.candidates.types.includes(p.type) ||
      (p.type === 'CATEGORY_SPEND' && !catalog.categories.has(p.targetId))
    ) {
      rejections.push('PROPOSAL_TARGET_INVALID');
      continue;
    }
    const id = proposalIdentity(p);
    if (seen.has(id)) {
      rejections.push('PROPOSAL_DUPLICATE');
      continue;
    }
    if (
      prior.some(
        (q) =>
          isPriorBlocking(q, policy, asOf) &&
          q.type === p.type &&
          q.targetId === p.targetId &&
          q.minimumSpendMinor === p.minimumSpendMinor,
      )
    ) {
      rejections.push('PROPOSAL_COOLDOWN');
      continue;
    }
    if (output.length >= policy.proposals.desiredCount) {
      rejections.push('PROPOSAL_LIMIT');
      continue;
    }
    output.push({
      ...p,
      id,
      rewardPoints: policy.rewards.pointsByType[p.type],
      durationDays: policy.assignment.durationDays,
    });
    seen.add(id);
  }
  return { accepted: output, rejections };
}

function statistics(values: readonly bigint[], thresholds: readonly bigint[]) {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];
  const total = sorted.reduce((sum, v) => sum + v, 0n);
  const median =
    upper === undefined
      ? null
      : sorted.length % 2 === 1
        ? upper
        : ((lower ?? upper) + upper) / 2n;
  return {
    receiptCount: values.length,
    averagePersonalMinor: values.length
      ? (total / BigInt(values.length)).toString()
      : null,
    medianPersonalMinor: median?.toString() ?? null,
    // [lowerInclusive,upperExclusive); final bucket is unbounded.
    distribution: [...thresholds, null].map((max, index) => ({
      lowerInclusiveMinor: (index === 0
        ? 0n
        : (thresholds[index - 1] ?? 0n)
      ).toString(),
      upperExclusiveMinor: max?.toString() ?? null,
      receiptCount: values.filter(
        (v) =>
          v >= (index === 0 ? 0n : (thresholds[index - 1] ?? 0n)) &&
          (max === null || v < max),
      ).length,
    })),
  };
}

export function buildProposalSummary(
  facts: readonly PurchaseFact[],
  catalog: EligibleCatalog,
  prior: readonly PriorQuest[],
  policy: QuestPolicy,
  asOf: Date,
) {
  if (!Number.isFinite(asOf.getTime()))
    throw new Error('Invalid summary clock');
  const historyStart = new Date(
    asOf.getTime() - policy.candidates.historyDays * DAY_MS,
  );
  const receipts = facts.filter(
    (r) => r.paidAt >= historyStart && r.paidAt < asOf,
  );
  const categories = new Map<string, bigint[]>();
  const thresholds = policy.proposals.distributionUpperMinorUnits.map((value) =>
    BigInt(value),
  );
  const values: bigint[] = [];
  for (const receipt of receipts) {
    if (receipt.personalMinor === undefined || receipt.items.length === 0)
      throw new Error('Missing personal receipt facts');
    const allocation = allocatePersonalAcrossItems(
      receipt.items.map((item) => ({ ...item, quantity: 1 })),
      receipt.finalMinor,
      receipt.personalMinor,
    );
    values.push(receipt.personalMinor);
    const perReceipt = new Map<string, bigint>();
    for (const item of receipt.items)
      perReceipt.set(
        item.categoryId,
        (perReceipt.get(item.categoryId) ?? 0n) +
          (allocation.get(item.id) ?? 0n),
      );
    for (const [id, spend] of perReceipt)
      categories.set(id, [...(categories.get(id) ?? []), spend]);
  }
  const questStart = new Date(
    asOf.getTime() - policy.proposals.historyDays * DAY_MS,
  );
  const history = prior.filter(
    (p) =>
      p.assignedAt !== undefined &&
      p.assignedAt >= questStart &&
      p.assignedAt < asOf,
  );
  const aggregates = new Map<
    string,
    {
      type: string;
      targetId: string | null;
      minimumSpendMinor: string | null;
      ruleVersion: string;
      amountBasis: string;
      completed: number;
      expired: number;
      cancelled: number;
    }
  >();
  for (const q of history) {
    const key = `${q.type}:${q.targetId}:${q.minimumSpendMinor}:${q.ruleVersion}:${q.spendBasis}`;
    let aggregate = aggregates.get(key);
    if (!aggregate) {
      aggregate = {
        type: q.type,
        targetId: q.targetId,
        minimumSpendMinor: q.minimumSpendMinor ?? null,
        ruleVersion: q.ruleVersion ?? 'LEGACY_UNKNOWN',
        amountBasis: q.spendBasis ?? 'LEGACY_UNKNOWN',
        completed: 0,
        expired: 0,
        cancelled: 0,
      };
      aggregates.set(key, aggregate);
    }
    if (q.status === 'CANCELLED') aggregate.cancelled++;
    else if (q.completedAt && q.completedAt < asOf) aggregate.completed++;
    else if (q.expiresAt <= asOf) aggregate.expired++;
  }
  return {
    summaryVersion: QUEST_SUMMARY_VERSION,
    amountBasis: QUEST_AMOUNT_BASIS,
    asOf: asOf.toISOString(),
    historyStart: historyStart.toISOString(),
    purchases: {
      ...statistics(values, thresholds),
      categories: [...categories]
        .sort(([a], [b]) => compareNumericIds(a, b))
        .map(([id, amounts]) => ({
          id,
          name: catalog.categoryNames?.get(id) ?? id,
          ...statistics(amounts, thresholds),
        })),
    },
    questHistory: {
      historyDays: policy.proposals.historyDays,
      outcomes: [...aggregates.values()],
      recent: [...history]
        .sort(
          (a, b) =>
            (b.assignedAt?.getTime() ?? 0) - (a.assignedAt?.getTime() ?? 0),
        )
        .slice(0, policy.proposals.recentHistoryLimit)
        .map((q) => ({
          type: q.type,
          targetId: q.targetId,
          minimumSpendMinor: q.minimumSpendMinor ?? null,
          ruleVersion: q.ruleVersion ?? 'LEGACY_UNKNOWN',
          amountBasis: q.spendBasis ?? 'LEGACY_UNKNOWN',
          status:
            q.status === 'ACTIVE' && q.expiresAt <= asOf ? 'EXPIRED' : q.status,
          assignedAt: q.assignedAt?.toISOString(),
          completedAt: q.completedAt?.toISOString() ?? null,
          expiresAt: q.expiresAt.toISOString(),
        })),
      active: prior
        .filter((q) => q.status === 'ACTIVE' && q.expiresAt > asOf)
        .map((q) => ({
          type: q.type,
          targetId: q.targetId,
          minimumSpendMinor: q.minimumSpendMinor ?? null,
          ruleVersion: q.ruleVersion ?? 'LEGACY_UNKNOWN',
          amountBasis: q.spendBasis ?? 'LEGACY_UNKNOWN',
        })),
    },
  };
}
