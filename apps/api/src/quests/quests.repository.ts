import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QUEST_PROMPT_VERSION } from './gemini.provider.js';
import { ProposalSchema, validateProposals } from './quest-proposals.js';
import type { QuestPolicy } from './domain/quest-policy.js';
import type {
  Candidate,
  PurchaseFact,
  PriorQuest,
  EligibleCatalog,
} from './quest-candidates.js';
import {
  evaluateReceiptForQuests,
  type ActiveQuestAssignment,
  type QuestCompletionResult,
  type ReceiptFact,
} from './domain/quest-evaluation.js';

const DAY_MS = 86_400_000;
const LEASE_MS = 120_000;
const MAX_HISTORY_ORDERS = 5000;
const GENERATION_LOCK = 734501;
const GENERATION_RATE_WINDOW_MS = 60_000;
const GENERATION_MAX_REQUESTS_PER_ACTOR_WINDOW = 10;
const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;
export const QUEST_PROVIDER = 'GEMINI';
const QUEST_TITLES = {
  MIN_SPEND: 'จ่ายเงินส่วนตัวครบยอดในหนึ่งบิล',
  CATEGORY_SPEND: 'จ่ายเงินส่วนตัวในหมวดที่กำหนดครบยอดในหนึ่งบิล',
} as const;
type Tx = Prisma.TransactionClient;
export type GenerationRun = {
  request_key: string;
  user_id: bigint;
  requested_by: bigint;
  status: string;
  reason: string | null;
  assignment_id: bigint | null;
};
export interface ProposalItem {
  id: string;
  type: 'MIN_SPEND' | 'CATEGORY_SPEND';
  targetCategoryId: string | null;
  targetCategoryName: string | null;
  minimumSpend: string;
  rewardPoints: number;
  durationDays: number;
}
export interface ProposalState {
  status: 'READY' | 'PENDING' | 'COOLDOWN' | 'ELIGIBLE' | 'FAILED';
  requestKey: string | null;
  expiresAt: string | null;
  nextEligibleAt: string | null;
  reason: string | null;
  items: ProposalItem[];
}
type ProposalLog = GenerationRun & {
  generated_proposals: unknown;
  proposal_expires_at: Date | null;
  selected_proposal_id: string | null;
  selection_key: string | null;
  policy_snapshot: unknown;
  lease_expires_at: Date;
  generated_at: Date;
  finished_at: Date | null;
};

export function bangkokDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
function minor(value: Prisma.Decimal): bigint {
  const scaled = value.mul(100);
  if (!scaled.isInteger()) throw new ConflictException('QUEST_INVALID_MONEY');
  return BigInt(scaled.toFixed(0));
}

@Injectable()
export class QuestsRepository {
  constructor(private readonly db: PrismaService) {}

  async history(userId: bigint, now: Date, policy: QuestPolicy) {
    const user = await this.db.user.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { role: 'CONSUMER' },
          { roles: { some: { role: 'CONSUMER', status: 'ACTIVE' } } },
        ],
      },
      select: { userId: true },
    });
    if (!user) throw new NotFoundException('QUEST_CONSUMER_NOT_FOUND');
    const orders = await this.db.order.findMany({
      where: {
        userId,
        status: 'PAID',
        paidAt: {
          gte: new Date(now.getTime() - policy.candidates.historyDays * DAY_MS),
          lt: now,
        },
      },
      orderBy: { orderId: 'asc' },
      take: MAX_HISTORY_ORDERS + 1,
      select: {
        orderId: true,
        merchantId: true,
        paidAt: true,
        finalAmount: true,
        userPaidAmount: true,
        orderItems: {
          select: {
            orderItemId: true,
            productId: true,
            categoryId: true,
            lineTotal: true,
          },
        },
      },
    });
    if (orders.length > MAX_HISTORY_ORDERS)
      throw new ConflictException('QUEST_HISTORY_LIMIT');
    const facts: PurchaseFact[] = orders.map((order) => {
      if (!order.paidAt)
        throw new ConflictException('QUEST_INVALID_PAID_ORDER');
      return {
        id: String(order.orderId),
        merchantId: String(order.merchantId),
        paidAt: order.paidAt,
        finalMinor: minor(order.finalAmount),
        personalMinor: minor(order.userPaidAmount),
        items: order.orderItems.map((item) => ({
          id: String(item.orderItemId),
          productId: String(item.productId),
          categoryId: String(item.categoryId),
          lineMinor: minor(item.lineTotal),
        })),
      };
    });
    return {
      facts,
      catalog: await this.catalog(),
      prior: await this.prior(userId),
    };
  }

  async catalog(tx: Tx = this.db): Promise<EligibleCatalog> {
    const categories = await tx.productCategory.findMany({
      where: {
        status: 'ACTIVE',
        products: {
          some: { status: 'ACTIVE', merchant: { status: 'ACTIVE' } },
        },
      },
      select: { categoryId: true, categoryName: true },
      take: MAX_HISTORY_ORDERS + 1,
    });
    if (categories.length > MAX_HISTORY_ORDERS)
      throw new ConflictException('QUEST_CATALOG_LIMIT');
    return {
      categories: new Set(categories.map((p) => String(p.categoryId))),
      categoryNames: new Map(
        categories.map((p) => [String(p.categoryId), p.categoryName]),
      ),
    };
  }

  async prior(userId: bigint, tx: Tx = this.db): Promise<PriorQuest[]> {
    const rows = await tx.userQuest.findMany({
      where: { userId },
      take: MAX_HISTORY_ORDERS + 1,
      select: {
        status: true,
        assignedAt: true,
        completedAt: true,
        expiresAt: true,
        quest: {
          select: {
            questType: true,
            minSpend: true,
            amountBasis: true,
            ruleVersion: true,
            targetCategoryId: true,
            targetProductId: true,
            targetMerchantId: true,
          },
        },
      },
    });
    if (rows.length > MAX_HISTORY_ORDERS)
      throw new ConflictException('QUEST_HISTORY_LIMIT');
    return rows.map((r) => ({
      status: r.status,
      assignedAt: r.assignedAt,
      minimumSpendMinor:
        r.quest.minSpend === null ? null : minor(r.quest.minSpend).toString(),
      ruleVersion: r.quest.ruleVersion ?? 'LEGACY_UNKNOWN',
      spendBasis: r.quest.amountBasis,
      completedAt: r.completedAt,
      expiresAt: r.expiresAt,
      type: r.quest.questType,
      targetId:
        r.quest.targetCategoryId?.toString() ??
        r.quest.targetProductId?.toString() ??
        r.quest.targetMerchantId?.toString() ??
        null,
    }));
  }

  private async lock(tx: Tx) {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${GENERATION_LOCK}::bigint)`;
  }

  private async run(tx: Tx, key: string): Promise<GenerationRun | undefined> {
    const rows = await tx.$queryRaw<
      GenerationRun[]
    >`SELECT request_key, user_id, requested_by, status, selection_reason AS reason, assignment_id FROM quest_generation_logs WHERE request_key = ${key}::uuid`;
    return rows[0];
  }

  private async consumer(userId: bigint, tx: Tx = this.db) {
    const user = await tx.user.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { role: 'CONSUMER' },
          { roles: { some: { role: 'CONSUMER', status: 'ACTIVE' } } },
        ],
      },
      select: { userId: true },
    });
    if (!user) throw new NotFoundException('QUEST_CONSUMER_NOT_FOUND');
  }

  private async expireClaims(tx: Tx, now: Date) {
    await tx.$executeRaw`UPDATE quest_generation_logs SET status='FAILED',selection_reason='LEASE_EXPIRED',finished_at=${now}
      WHERE status='PENDING' AND lease_expires_at<=${now}`;
  }

  private async cycle(tx: Tx, userId: bigint, now: Date) {
    const latest = await tx.userQuest.findFirst({
      where: {
        userId,
        status: { not: 'CANCELLED' },
        nextEligibleAt: { gt: now },
      },
      orderBy: { nextEligibleAt: 'desc' },
      select: { nextEligibleAt: true },
    });
    const active = await tx.userQuest.count({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
    });
    return { nextEligibleAt: latest?.nextEligibleAt ?? null, active };
  }

  private async fullRun(tx: Tx, key: string): Promise<ProposalLog | undefined> {
    const [row] = await tx.$queryRaw<
      ProposalLog[]
    >`SELECT request_key,user_id,requested_by,status,selection_reason AS reason,assignment_id,
      generated_proposals,proposal_expires_at,selected_proposal_id,selection_key,policy_snapshot,lease_expires_at,
      generated_at AT TIME ZONE 'UTC' AS generated_at,finished_at FROM quest_generation_logs WHERE request_key=${key}::uuid`;
    return row;
  }

  private parseStoredProposals(
    value: unknown,
    policy: QuestPolicy,
  ): Candidate[] {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.length > policy.proposals.desiredCount
    )
      throw new ConflictException('QUEST_PROPOSAL_STORAGE_INVALID');
    return value.map((entry: unknown) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('id' in entry) ||
        typeof entry.id !== 'string'
      )
        throw new ConflictException('QUEST_PROPOSAL_STORAGE_INVALID');
      const p = ProposalSchema.safeParse({
        type: 'type' in entry ? entry.type : undefined,
        targetId: 'targetId' in entry ? entry.targetId : undefined,
        minimumSpendMinor:
          'minimumSpendMinor' in entry ? entry.minimumSpendMinor : undefined,
      });
      if (!p.success)
        throw new ConflictException('QUEST_PROPOSAL_STORAGE_INVALID');
      return {
        ...p.data,
        id: entry.id,
        rewardPoints: policy.rewards.pointsByType[p.data.type],
        durationDays: policy.assignment.durationDays,
      };
    });
  }

  async proposalState(
    userId: bigint,
    now: Date,
    policy: QuestPolicy,
  ): Promise<ProposalState> {
    await this.consumer(userId);
    const base: ProposalState = {
      status: 'ELIGIBLE',
      requestKey: null,
      expiresAt: null,
      nextEligibleAt: null,
      reason: null,
      items: [],
    };
    const cycle = await this.cycle(this.db, userId, now);
    if (
      cycle.nextEligibleAt ||
      cycle.active >= policy.assignment.maximumActivePerUser
    )
      return {
        ...base,
        status: 'COOLDOWN',
        nextEligibleAt: cycle.nextEligibleAt?.toISOString() ?? null,
        reason: cycle.nextEligibleAt ? 'CYCLE_LIMIT' : 'ACTIVE_LIMIT',
      };
    const [row] = await this.db.$queryRaw<
      ProposalLog[]
    >`SELECT request_key,user_id,requested_by,status,selection_reason AS reason,assignment_id,
      generated_proposals,proposal_expires_at,selected_proposal_id,selection_key,policy_snapshot,lease_expires_at,
      generated_at AT TIME ZONE 'UTC' AS generated_at,finished_at FROM quest_generation_logs
      WHERE user_id=${userId} AND policy_version=${policy.version} AND status IN ('READY','PENDING','FAILED')
      ORDER BY generated_at DESC,generation_id DESC LIMIT 1`;
    if (row?.status === 'PENDING' && row.lease_expires_at > now)
      return {
        ...base,
        status: 'PENDING',
        requestKey: row.request_key,
        expiresAt: row.lease_expires_at.toISOString(),
      };
    if (
      row?.status === 'READY' &&
      row.proposal_expires_at &&
      row.proposal_expires_at > now
    ) {
      const catalog = await this.catalog();
      const stored = this.parseStoredProposals(row.generated_proposals, policy);
      const proposals = validateProposals(
        stored.map((p) => ({
          type: p.type,
          targetId: p.targetId,
          minimumSpendMinor: p.minimumSpendMinor,
        })),
        catalog,
        await this.prior(userId),
        policy,
        now,
      ).accepted;
      if (!proposals.length) {
        const failed = await this.db.$transaction(async (tx) => {
          await this.lock(tx);
          const current = await this.fullRun(tx, row.request_key);
          if (!current || current.status !== 'READY') return false;
          const currentStored = this.parseStoredProposals(
            current.generated_proposals,
            policy,
          );
          const rechecked = validateProposals(
            currentStored.map((p) => ({
              type: p.type,
              targetId: p.targetId,
              minimumSpendMinor: p.minimumSpendMinor,
            })),
            await this.catalog(tx),
            await this.prior(userId, tx),
            policy,
            now,
          );
          if (rechecked.accepted.length) return false;
          await tx.$executeRaw`UPDATE quest_generation_logs SET status='FAILED',selection_reason='QUEST_PROPOSALS_NO_LONGER_ELIGIBLE',finished_at=${now} WHERE request_key=${row.request_key}::uuid AND status='READY'`;
          return true;
        }, TRANSACTION_OPTIONS);
        if (!failed) return this.proposalState(userId, now, policy);
        return {
          ...base,
          status: 'FAILED',
          requestKey: row.request_key,
          reason: 'QUEST_PROPOSALS_NO_LONGER_ELIGIBLE',
          nextEligibleAt: new Date(
            now.getTime() + policy.proposals.retryCooldownMinutes * 60_000,
          ).toISOString(),
        };
      }
      return {
        ...base,
        status: 'READY',
        requestKey: row.request_key,
        expiresAt: row.proposal_expires_at.toISOString(),
        items: proposals.map((p) => ({
          id: p.id,
          type: p.type,
          targetCategoryId: p.targetId,
          targetCategoryName: p.targetId
            ? (catalog.categoryNames?.get(p.targetId) ?? null)
            : null,
          minimumSpend: new Prisma.Decimal(p.minimumSpendMinor ?? '0')
            .div(100)
            .toFixed(2),
          rewardPoints: p.rewardPoints,
          durationDays: p.durationDays,
        })),
      };
    }
    if (row?.status === 'FAILED' || row?.status === 'PENDING') {
      const end = row.finished_at ?? row.lease_expires_at;
      const retryAt = new Date(
        end.getTime() + policy.proposals.retryCooldownMinutes * 60_000,
      );
      if (retryAt > now)
        return {
          ...base,
          status: 'FAILED',
          requestKey: row.request_key,
          reason: row.reason ?? 'LEASE_EXPIRED',
          nextEligibleAt: retryAt.toISOString(),
        };
    }
    const day = bangkokDay(now);
    const start = new Date(`${day}T00:00:00+07:00`);
    const [count] = await this.db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*)::bigint AS count FROM quest_generation_logs
      WHERE user_id=${userId} AND policy_version=${policy.version} AND status IN ('PENDING','READY','ASSIGNED','FAILED')
      AND generated_at>=(${start}::timestamptz AT TIME ZONE 'UTC') AND generated_at<(${new Date(start.getTime() + DAY_MS)}::timestamptz AT TIME ZONE 'UTC')`;
    if ((count?.count ?? 0n) >= BigInt(policy.proposals.maximumSetsPerDay))
      return {
        ...base,
        status: 'COOLDOWN',
        reason: 'GENERATION_DAILY_LIMIT',
        nextEligibleAt: new Date(start.getTime() + DAY_MS).toISOString(),
      };
    return base;
  }

  async claim(input: {
    key: string;
    userId: bigint;
    actorId: bigint;
    now: Date;
    policy: QuestPolicy;
    model: string;
    summary: unknown;
    candidates?: readonly Candidate[];
  }) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      await this.expireClaims(tx, input.now);
      const existing = await this.run(tx, input.key);
      if (existing) {
        if (
          existing.user_id !== input.userId ||
          existing.requested_by !== input.actorId
        )
          throw new ConflictException('QUEST_IDEMPOTENCY_CONFLICT');
        return { run: existing, claimed: false };
      }
      await this.consumer(input.userId, tx);
      const cycle = await this.cycle(tx, input.userId, input.now);
      if (
        cycle.nextEligibleAt ||
        cycle.active >= input.policy.assignment.maximumActivePerUser
      )
        throw new ConflictException('QUEST_CYCLE_LIMIT');
      const [current] = await tx.$queryRaw<
        { request_key: string }[]
      >`SELECT request_key FROM quest_generation_logs
        WHERE user_id=${input.userId} AND policy_version=${input.policy.version}
        AND ((status='PENDING' AND lease_expires_at>${input.now}) OR (status='READY' AND proposal_expires_at>${input.now}))
        ORDER BY generation_id DESC LIMIT 1`;
      if (current) {
        const run = await this.run(tx, current.request_key);
        if (!run) throw new ConflictException('QUEST_CLAIM_FAILED');
        return { run, claimed: false };
      }
      const [failed] = await tx.$queryRaw<
        { retry_at: Date }[]
      >`SELECT finished_at + (${input.policy.proposals.retryCooldownMinutes} * interval '1 minute') AS retry_at
        FROM quest_generation_logs WHERE user_id=${input.userId} AND policy_version=${input.policy.version} AND status='FAILED' ORDER BY generation_id DESC LIMIT 1`;
      if (failed && failed.retry_at > input.now)
        throw new HttpException(
          'QUEST_GENERATION_COOLDOWN',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const day = bangkokDay(input.now);
      const start = new Date(`${day}T00:00:00+07:00`);
      const [rate] = await tx.$queryRaw<
        { actor_count: bigint; user_count: bigint }[]
      >`SELECT
        count(*) FILTER (WHERE requested_by=${input.actorId} AND generated_at>(${new Date(input.now.getTime() - GENERATION_RATE_WINDOW_MS)}::timestamptz AT TIME ZONE 'UTC'))::bigint AS actor_count,
        count(*) FILTER (WHERE user_id=${input.userId} AND policy_version=${input.policy.version} AND generated_at>=(${start}::timestamptz AT TIME ZONE 'UTC'))::bigint AS user_count
        FROM quest_generation_logs WHERE generated_at>=(${start}::timestamptz AT TIME ZONE 'UTC') OR generated_at>(${new Date(input.now.getTime() - GENERATION_RATE_WINDOW_MS)}::timestamptz AT TIME ZONE 'UTC')`;
      if (
        (rate?.actor_count ?? 0n) >=
          BigInt(GENERATION_MAX_REQUESTS_PER_ACTOR_WINDOW) ||
        (rate?.user_count ?? 0n) >=
          BigInt(input.policy.proposals.maximumSetsPerDay)
      )
        throw new HttpException(
          'QUEST_GENERATION_RATE_LIMIT',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const lease = new Date(input.now.getTime() + LEASE_MS);
      await tx.$executeRaw`INSERT INTO quest_generation_logs
        (request_key,user_id,requested_by,status,provider,model_version,prompt_version,policy_version,policy_snapshot,input_summary,candidates,reserved_points,reservation_day,lease_expires_at,reservation_expires_at,generated_at)
        VALUES (${input.key}::uuid,${input.userId},${input.actorId},'PENDING',${QUEST_PROVIDER},${input.model},${QUEST_PROMPT_VERSION},${input.policy.version},${JSON.stringify(input.policy)}::jsonb,${JSON.stringify(input.summary)}::jsonb,'[]'::jsonb,0,${day}::date,${lease},${lease},(${input.now}::timestamptz AT TIME ZONE 'UTC'))`;
      const run = await this.run(tx, input.key);
      if (!run) throw new ConflictException('QUEST_CLAIM_FAILED');
      return { run, claimed: true };
    }, TRANSACTION_OPTIONS);
  }

  async takeGenerationJob(now: Date, policy: QuestPolicy) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      await this.expireClaims(tx, now);
      await tx.$executeRaw`UPDATE quest_generation_logs SET status='FAILED',selection_reason='POLICY_CHANGED',finished_at=${now}
        WHERE status='PENDING' AND worker_started_at IS NULL AND policy_snapshot<>${JSON.stringify(policy)}::jsonb`;
      const [job] = await tx.$queryRaw<
        { key: string; userId: bigint; asOf: Date; summary: unknown }[]
      >`SELECT request_key AS key,user_id AS "userId",
        generated_at AT TIME ZONE 'UTC' AS "asOf",input_summary AS summary FROM quest_generation_logs
        WHERE status='PENDING' AND worker_started_at IS NULL AND lease_expires_at>${now} ORDER BY generation_id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!job) return null;
      await tx.$executeRaw`UPDATE quest_generation_logs SET worker_started_at=${now} WHERE request_key=${job.key}::uuid`;
      return job;
    }, TRANSACTION_OPTIONS);
  }

  async replay(key: string, userId: bigint, actorId: bigint, now: Date) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      await this.expireClaims(tx, now);
      const existing = await this.run(tx, key);
      if (
        existing &&
        (existing.user_id !== userId || existing.requested_by !== actorId)
      )
        throw new ConflictException('QUEST_IDEMPOTENCY_CONFLICT');
      return existing;
    }, TRANSACTION_OPTIONS);
  }

  async fail(key: string, reason: string, now: Date, audit: unknown = null) {
    await this.db
      .$executeRaw`UPDATE quest_generation_logs SET status='FAILED',selection_reason=${reason},finished_at=${now},candidate_scores=${JSON.stringify(audit)}::jsonb
      WHERE request_key=${key}::uuid AND status='PENDING'`;
  }

  async saveProposals(
    key: string,
    proposals: readonly Candidate[],
    policy: QuestPolicy,
    now: Date,
    output: unknown = null,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      const run = await this.fullRun(tx, key);
      if (!run || run.status !== 'PENDING' || run.lease_expires_at <= now)
        throw new ConflictException('QUEST_GENERATION_NOT_PENDING');
      const [match] = await tx.$queryRaw<
        { matches: boolean }[]
      >`SELECT policy_snapshot=${JSON.stringify(policy)}::jsonb AS matches FROM quest_generation_logs WHERE request_key=${key}::uuid`;
      if (!match?.matches) throw new ConflictException('QUEST_POLICY_CHANGED');
      const raw = proposals.map((p) => ({
        type: p.type,
        targetId: p.targetId,
        minimumSpendMinor: p.minimumSpendMinor,
      }));
      const validated = validateProposals(
        raw,
        await this.catalog(tx),
        await this.prior(run.user_id, tx),
        policy,
        now,
      );
      if (!validated.accepted.length) {
        await tx.$executeRaw`UPDATE quest_generation_logs SET status='FAILED',selection_reason='NO_VALID_PROPOSALS',finished_at=${now},candidate_scores=${JSON.stringify({ output, rejections: validated.rejections })}::jsonb WHERE request_key=${key}::uuid`;
      } else {
        const expires = new Date(
          now.getTime() + policy.proposals.offerValidityHours * 3_600_000,
        );
        await tx.$executeRaw`UPDATE quest_generation_logs SET status='READY',generated_proposals=${JSON.stringify(validated.accepted)}::jsonb,
          proposal_expires_at=${expires},candidate_scores=${JSON.stringify({ output, rejections: validated.rejections })}::jsonb,finished_at=${now} WHERE request_key=${key}::uuid`;
      }
      const updated = await this.run(tx, key);
      if (!updated) throw new ConflictException('QUEST_FINALIZE_FAILED');
      return updated;
    }, TRANSACTION_OPTIONS);
  }

  private async budget(tx: Tx, now: Date) {
    const start = new Date(`${bangkokDay(now)}T00:00:00+07:00`);
    const [totals] = await tx.$queryRaw<
      { daily: bigint; outstanding: bigint }[]
    >`SELECT
      coalesce(sum(q.reward_point) FILTER (WHERE (uq.assigned_at AT TIME ZONE 'UTC')>=${start} AND (uq.assigned_at AT TIME ZONE 'UTC')<${new Date(start.getTime() + DAY_MS)} AND uq.status<>'CANCELLED'),0)::bigint AS daily,
      coalesce(sum(q.reward_point) FILTER (WHERE uq.status='ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC')>${now}),0)::bigint AS outstanding
      FROM user_quests uq JOIN quests q USING(quest_id)`;
    return totals ?? { daily: 0n, outstanding: 0n };
  }

  async select(
    userId: bigint,
    key: string,
    proposalId: string,
    idempotencyKey: string,
    policy: QuestPolicy,
    now: Date,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      await tx.$queryRaw`SELECT user_id FROM users WHERE user_id=${userId} FOR SHARE`;
      await tx.$queryRaw`SELECT user_role_id FROM user_roles WHERE user_id=${userId} AND role='CONSUMER' FOR SHARE`;
      await this.consumer(userId, tx);
      const [used] = await tx.$queryRaw<
        { request_key: string; user_id: bigint; selected_proposal_id: string }[]
      >`SELECT request_key,user_id,selected_proposal_id FROM quest_generation_logs WHERE selection_key=${idempotencyKey}::uuid`;
      if (
        used &&
        (used.request_key !== key ||
          used.user_id !== userId ||
          used.selected_proposal_id !== proposalId)
      )
        throw new ConflictException('QUEST_IDEMPOTENCY_CONFLICT');
      const run = await this.fullRun(tx, key);
      if (!run || run.user_id !== userId)
        throw new NotFoundException('QUEST_PROPOSALS_NOT_FOUND');
      if (run.status === 'ASSIGNED') {
        if (
          run.selected_proposal_id !== proposalId ||
          run.selection_key !== idempotencyKey ||
          !run.assignment_id
        )
          throw new ConflictException('QUEST_ALREADY_SELECTED');
        const assigned = await tx.userQuest.findUnique({
          where: { userQuestId: run.assignment_id },
          select: { nextEligibleAt: true },
        });
        if (!assigned?.nextEligibleAt)
          throw new ConflictException('QUEST_ASSIGNMENT_INVALID');
        return {
          assignmentId: run.assignment_id.toString(),
          nextEligibleAt: assigned.nextEligibleAt.toISOString(),
        };
      }
      if (
        run.status !== 'READY' ||
        !run.proposal_expires_at ||
        run.proposal_expires_at <= now
      )
        throw new ConflictException('QUEST_PROPOSALS_EXPIRED');
      const [snapshot] = await tx.$queryRaw<
        { matches: boolean }[]
      >`SELECT policy_snapshot=${JSON.stringify(policy)}::jsonb AS matches FROM quest_generation_logs WHERE request_key=${key}::uuid`;
      if (!snapshot?.matches)
        throw new ConflictException('QUEST_POLICY_CHANGED');
      const cycle = await this.cycle(tx, userId, now);
      if (
        cycle.nextEligibleAt ||
        cycle.active >= policy.assignment.maximumActivePerUser
      )
        throw new ConflictException('QUEST_CYCLE_LIMIT');
      const candidate = this.parseStoredProposals(
        run.generated_proposals,
        policy,
      ).find((p) => p.id === proposalId);
      if (!candidate) throw new NotFoundException('QUEST_PROPOSAL_NOT_FOUND');
      const validated = validateProposals(
        [
          {
            type: candidate.type,
            targetId: candidate.targetId,
            minimumSpendMinor: candidate.minimumSpendMinor,
          },
        ],
        await this.catalog(tx),
        await this.prior(userId, tx),
        policy,
        now,
      );
      if (
        validated.accepted.length !== 1 ||
        !(await this.lockEligibleTarget(tx, candidate))
      )
        throw new ConflictException('QUEST_PROPOSAL_NO_LONGER_ELIGIBLE');
      const budget = await this.budget(tx, now);
      if (
        budget.daily + BigInt(candidate.rewardPoints) >
          BigInt(policy.rewards.globalDailyReservationBudgetPoints) ||
        budget.outstanding + BigInt(candidate.rewardPoints) >
          BigInt(policy.rewards.globalOutstandingReservationBudgetPoints)
      )
        throw new ConflictException('QUEST_BUDGET_LIMIT');
      const quest = await tx.quest.create({
        data: {
          questName: QUEST_TITLES[candidate.type],
          questType: candidate.type,
          targetCategoryId:
            candidate.targetId === null ? null : BigInt(candidate.targetId),
          minSpend: new Prisma.Decimal(candidate.minimumSpendMinor ?? '0').div(
            100,
          ),
          rewardPoint: candidate.rewardPoints,
          durationDays: candidate.durationDays,
          generatedBy: QUEST_PROVIDER,
          amountBasis: 'PERSONAL_AFTER_DISCOUNT',
          ruleVersion: policy.version,
          createdAt: now,
        },
      });
      const expires = new Date(now.getTime() + candidate.durationDays * DAY_MS);
      const nextEligibleAt = new Date(
        now.getTime() + policy.assignment.cycleDays * DAY_MS,
      );
      const assignment = await tx.userQuest.create({
        data: {
          userId,
          questId: quest.questId,
          status: 'ACTIVE',
          assignedAt: now,
          expiresAt: expires,
          nextEligibleAt,
        },
      });
      await tx.$executeRaw`UPDATE quest_generation_logs SET status='ASSIGNED',generated_quest_id=${quest.questId},assignment_id=${assignment.userQuestId},selected_proposal_id=${proposalId},selection_key=${idempotencyKey}::uuid,
        reserved_points=${candidate.rewardPoints},reservation_day=${bangkokDay(now)}::date,reservation_expires_at=${expires},finished_at=${now} WHERE request_key=${key}::uuid`;
      return {
        assignmentId: assignment.userQuestId.toString(),
        nextEligibleAt: nextEligibleAt.toISOString(),
      };
    }, TRANSACTION_OPTIONS);
  }
  private async lockEligibleTarget(tx: Tx, candidate: Candidate) {
    if (candidate.type === 'MIN_SPEND') return candidate.targetId === null;
    if (candidate.type !== 'CATEGORY_SPEND') return false;
    if (candidate.targetId === null) return false;
    const target = BigInt(candidate.targetId);
    const rows = await tx.$queryRaw<{ product_id: bigint }[]>`
      SELECT p.product_id FROM products p JOIN merchants m ON m.merchant_id=p.merchant_id
      JOIN product_categories c ON c.category_id=p.category_id
      WHERE p.status='ACTIVE' AND m.status='ACTIVE' AND c.status='ACTIVE'
        AND c.category_id=${target}
      ORDER BY p.product_id LIMIT 1 FOR SHARE OF p,m,c`;
    return rows.length > 0;
  }

  async list(userId: bigint, now: Date, cursor?: bigint) {
    const rows = await this.db.userQuest.findMany({
      where: { userId, ...(cursor ? { userQuestId: { lt: cursor } } : {}) },
      orderBy: { userQuestId: 'desc' },
      take: 20,
      select: {
        userQuestId: true,
        status: true,
        assignedAt: true,
        expiresAt: true,
        completedAt: true,
        cancelledAt: true,
        cancellationReason: true,
        completedOrderId: true,
        quest: {
          select: {
            amountBasis: true,
            questName: true,
            questType: true,
            targetCategoryId: true,
            targetProductId: true,
            targetMerchantId: true,
            minSpend: true,
            rewardPoint: true,
            durationDays: true,
            category: { select: { categoryName: true } },
            product: { select: { productName: true } },
            merchant: { select: { merchantName: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: String(r.userQuestId),
      questName: r.quest.questName,
      amountBasis: r.quest.amountBasis,
      status:
        r.status === 'ACTIVE' && r.expiresAt <= now ? 'EXPIRED' : r.status,
      assignedAt: r.assignedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      cancellationReason: r.cancellationReason,
      completedOrderId: r.completedOrderId?.toString() ?? null,
      receiptNumber: r.completedOrderId
        ? `TP-${r.completedOrderId.toString().padStart(6, '0')}`
        : null,
      type: r.quest.questType,
      targetCategoryId: r.quest.targetCategoryId?.toString() ?? null,
      targetCategoryName: r.quest.category?.categoryName ?? null,
      targetProductId: r.quest.targetProductId?.toString() ?? null,
      targetProductName: r.quest.product?.productName ?? null,
      targetMerchantId: r.quest.targetMerchantId?.toString() ?? null,
      targetMerchantName: r.quest.merchant?.merchantName ?? null,
      minimumSpendMinor:
        r.quest.minSpend === null ? null : minor(r.quest.minSpend).toString(),
      rewardPoints: r.quest.rewardPoint,
    }));
  }

  async evaluateAndCompleteOrder(
    orderId: bigint,
    policy: QuestPolicy,
  ): Promise<QuestCompletionResult | null> {
    const order = await this.db.order.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        userId: true,
        merchantId: true,
        status: true,
        finalAmount: true,
        userPaidAmount: true,
        paidAt: true,
        orderItems: {
          select: {
            orderItemId: true,
            productId: true,
            categoryId: true,
            lineTotal: true,
            quantity: true,
          },
        },
      },
    });

    if (!order || order.status !== 'PAID' || !order.userId || !order.paidAt) {
      return null;
    }

    const receiptFact: ReceiptFact = {
      orderId: String(order.orderId),
      userId: String(order.userId),
      merchantId: String(order.merchantId),
      finalMinor: minor(order.finalAmount),
      personalMinor: minor(order.userPaidAmount),
      paidAt: order.paidAt,
      items: order.orderItems.map((item) => ({
        id: String(item.orderItemId),
        productId: String(item.productId),
        categoryId: String(item.categoryId),
        lineMinor: minor(item.lineTotal),
        quantity: item.quantity,
      })),
    };

    const activeUserQuests = await this.db.userQuest.findMany({
      where: {
        userId: order.userId,
        status: 'ACTIVE',
        quest: { questType: { in: policy.candidates.types } },
        assignedAt: { lte: order.paidAt },
        expiresAt: { gt: order.paidAt },
      },
      include: {
        quest: true,
      },
    });

    if (activeUserQuests.length === 0) return null;

    const activeAssignments: ActiveQuestAssignment[] = activeUserQuests.flatMap(
      (uq) => {
        const type = uq.quest.questType;
        if (type !== 'MIN_SPEND' && type !== 'CATEGORY_SPEND') return [];
        return [
          {
            userQuestId: String(uq.userQuestId),
            userId: String(uq.userId),
            questId: String(uq.questId),
            type,
            spendBasis:
              uq.quest.amountBasis === 'PERSONAL_AFTER_DISCOUNT'
                ? 'PERSONAL_AFTER_DISCOUNT'
                : 'FINAL_AFTER_DISCOUNT',
            targetCategoryId: uq.quest.targetCategoryId
              ? String(uq.quest.targetCategoryId)
              : null,
            targetProductId: uq.quest.targetProductId
              ? String(uq.quest.targetProductId)
              : null,
            targetMerchantId: uq.quest.targetMerchantId
              ? String(uq.quest.targetMerchantId)
              : null,
            minimumSpendMinor:
              uq.quest.minSpend === null ? null : minor(uq.quest.minSpend),
            rewardPoints: uq.quest.rewardPoint,
            assignedAt: uq.assignedAt,
            expiresAt: uq.expiresAt,
          },
        ];
      },
    );

    const match = evaluateReceiptForQuests(receiptFact, activeAssignments);
    if (!match) return null;

    return this.db.$transaction(async (tx) => {
      // 0. Lock order row FOR UPDATE to serialize concurrent evaluation of same receipt
      await tx.$queryRaw<Array<{ order_id: bigint }>>`
        SELECT "order_id"
        FROM "orders"
        WHERE "order_id" = ${order.orderId}
        FOR UPDATE
      `;

      // 1. Check if this order already completed an assignment (single assignment per receipt)
      const existing = await tx.userQuest.findFirst({
        where: { completedOrderId: order.orderId },
        select: { userQuestId: true },
      });
      if (existing) return null;

      // 2. Lock the user_quest row FOR UPDATE and ensure still ACTIVE
      const [locked] = await tx.$queryRaw<
        Array<{ user_quest_id: bigint; status: string }>
      >`
        SELECT "user_quest_id", "status"
        FROM "user_quests"
        WHERE "user_quest_id" = ${BigInt(match.userQuestId)}
        FOR UPDATE
      `;
      if (!locked || locked.status !== 'ACTIVE') return null;

      // 3. Mark user_quest as COMPLETED
      await tx.userQuest.update({
        where: { userQuestId: BigInt(match.userQuestId) },
        data: {
          status: 'COMPLETED',
          completedAt: order.paidAt!,
          completedOrderId: order.orderId,
        },
      });

      // 4. Create point_transactions record
      const pointExpiresAt = new Date(
        order.paidAt!.getTime() + policy.rewards.pointValidityDays * DAY_MS,
      );
      await tx.pointTransaction.create({
        data: {
          userId: order.userId!,
          userQuestId: BigInt(match.userQuestId),
          transactionType: 'QUEST_REWARD',
          points: match.rewardPoints,
          expiresAt: pointExpiresAt,
          createdAt: order.paidAt!,
        },
      });

      // 5. Update user point_balance
      await tx.user.update({
        where: { userId: order.userId! },
        data: {
          pointBalance: { increment: match.rewardPoints },
          updatedAt: order.paidAt!,
        },
      });

      return match;
    }, TRANSACTION_OPTIONS);
  }
}
