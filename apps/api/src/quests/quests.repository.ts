import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { QuestPolicy } from './domain/quest-policy.js';
import type {
  Candidate,
  PurchaseFact,
  PriorQuest,
  EligibleCatalog,
} from './quest-candidates.js';

const DAY_MS = 86_400_000;
const LEASE_MS = 120_000;
const MAX_HISTORY_ORDERS = 5000;
const GENERATION_LOCK = 734501;
const GENERATION_RATE_WINDOW_MS = 60_000;
const GENERATION_MAX_REQUESTS_PER_ACTOR_WINDOW = 10;
export const QUEST_PROVIDER = 'GEMINI';
export const QUEST_PROMPT_VERSION = 'quest-ranking-v1';
const QUEST_TITLES = {
  MIN_SPEND: 'ซื้อครบยอดในหนึ่งบิล',
  CATEGORY_SPEND: 'ซื้อหมวดที่กำหนดครบยอดในหนึ่งบิล',
  PRODUCT_PURCHASE: 'ซื้อสินค้าที่กำหนดในหนึ่งบิล',
  MERCHANT_SPEND: 'ซื้อร้านที่กำหนดครบยอดในหนึ่งบิล',
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
    const products = await tx.product.findMany({
      where: {
        status: 'ACTIVE',
        merchant: { status: 'ACTIVE' },
        category: { status: 'ACTIVE' },
      },
      select: { productId: true, merchantId: true, categoryId: true },
      take: MAX_HISTORY_ORDERS + 1,
    });
    if (products.length > MAX_HISTORY_ORDERS)
      throw new ConflictException('QUEST_CATALOG_LIMIT');
    return {
      products: new Set(products.map((p) => String(p.productId))),
      merchants: new Set(products.map((p) => String(p.merchantId))),
      categories: new Set(products.map((p) => String(p.categoryId))),
    };
  }

  async prior(userId: bigint, tx: Tx = this.db): Promise<PriorQuest[]> {
    const rows = await tx.userQuest.findMany({
      where: { userId },
      take: MAX_HISTORY_ORDERS + 1,
      select: {
        status: true,
        completedAt: true,
        expiresAt: true,
        quest: {
          select: {
            questType: true,
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

  private async run(tx: Tx, key: string) {
    const rows = await tx.$queryRaw<
      GenerationRun[]
    >`SELECT request_key, user_id, requested_by, status, selection_reason AS reason, assignment_id FROM quest_generation_logs WHERE request_key = ${key}::uuid`;
    return rows[0];
  }

  private async limits(
    tx: Tx,
    userId: bigint,
    now: Date,
    policy: QuestPolicy,
    excludeKey: string,
  ) {
    const active = await tx.userQuest.count({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
    });
    const day = bangkokDay(now);
    const start = new Date(`${day}T00:00:00+07:00`);
    const daily = await tx.userQuest.count({
      where: {
        userId,
        assignedAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) },
      },
    });
    const [budget] = await tx.$queryRaw<
      { daily: bigint; outstanding: bigint; pending_user: bigint }[]
    >`
      SELECT
        coalesce(sum(r.reserved_points) FILTER (WHERE r.reservation_day = ${day}::date AND
          (r.status = 'ASSIGNED' OR (r.status = 'PENDING' AND r.lease_expires_at > ${now}))),0)::bigint AS daily,
        coalesce(sum(r.reserved_points) FILTER (WHERE
          (r.status = 'PENDING' AND r.lease_expires_at > ${now}) OR
          (r.status = 'ASSIGNED' AND r.reservation_expires_at > ${now} AND EXISTS
            (SELECT 1 FROM user_quests uq WHERE uq.user_quest_id = r.assignment_id AND uq.status = 'ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC') > ${now}))),0)::bigint AS outstanding,
        count(*) FILTER (WHERE r.user_id = ${userId} AND r.status = 'PENDING' AND r.lease_expires_at > ${now})::bigint AS pending_user
      FROM quest_generation_logs r WHERE r.request_key <> ${excludeKey}::uuid`;
    if (!budget) throw new ConflictException('QUEST_BUDGET_UNAVAILABLE');
    // Existing assignments predate this migration; their reward liability still counts.
    const [legacy] = await tx.$queryRaw<
      { daily: bigint; outstanding: bigint }[]
    >`
      SELECT coalesce(sum(q.reward_point) FILTER (WHERE (uq.assigned_at AT TIME ZONE 'UTC') >= ${start} AND (uq.assigned_at AT TIME ZONE 'UTC') < ${new Date(start.getTime() + DAY_MS)}),0)::bigint AS daily,
        coalesce(sum(q.reward_point) FILTER (WHERE uq.status='ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC') > ${now}),0)::bigint AS outstanding
      FROM user_quests uq JOIN quests q ON q.quest_id=uq.quest_id
      WHERE NOT EXISTS (SELECT 1 FROM quest_generation_logs gr WHERE gr.assignment_id=uq.user_quest_id)`;
    budget.daily += legacy?.daily ?? 0n;
    budget.outstanding += legacy?.outstanding ?? 0n;
    if (
      active + Number(budget.pending_user) >=
      policy.assignment.maximumActivePerUser
    )
      return 'ACTIVE_LIMIT';
    if (
      daily + Number(budget.pending_user) >=
      policy.assignment.maximumNewPerUserPerDay
    )
      return 'DAILY_LIMIT';
    return budget;
  }

  async claim(input: {
    key: string;
    userId: bigint;
    actorId: bigint;
    now: Date;
    policy: QuestPolicy;
    model: string;
    summary: unknown;
    candidates: readonly Candidate[];
  }) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      const existing = await this.run(tx, input.key);
      if (existing) {
        if (
          existing.user_id !== input.userId ||
          existing.requested_by !== input.actorId
        )
          throw new ConflictException('QUEST_IDEMPOTENCY_CONFLICT');
        await tx.$executeRaw`UPDATE quest_generation_logs SET status='FAILED',selection_reason='LEASE_EXPIRED',finished_at=${input.now} WHERE request_key=${input.key}::uuid AND status='PENDING' AND lease_expires_at <= ${input.now}`;
        return {
          run: (await this.run(tx, input.key)) ?? existing,
          claimed: false,
        };
      }
      const [rate] = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*)::bigint AS count FROM quest_generation_logs WHERE requested_by=${input.actorId} AND generated_at > (${new Date(input.now.getTime() - GENERATION_RATE_WINDOW_MS)}::timestamptz AT TIME ZONE 'UTC')`;
      if (
        (rate?.count ?? 0n) >= BigInt(GENERATION_MAX_REQUESTS_PER_ACTOR_WINDOW)
      )
        throw new HttpException(
          'QUEST_GENERATION_RATE_LIMIT',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const limits = await this.limits(
        tx,
        input.userId,
        input.now,
        input.policy,
        input.key,
      );
      const reserved = Math.max(
        ...input.candidates.map((c) => c.rewardPoints),
        1,
      );
      const reason =
        typeof limits === 'string'
          ? limits
          : input.candidates.length === 0
            ? 'NO_CANDIDATES'
            : limits.daily + BigInt(reserved) >
                  BigInt(
                    input.policy.rewards.globalDailyReservationBudgetPoints,
                  ) ||
                limits.outstanding + BigInt(reserved) >
                  BigInt(
                    input.policy.rewards
                      .globalOutstandingReservationBudgetPoints,
                  )
              ? 'BUDGET_LIMIT'
              : null;
      const status = reason ? 'DEFERRED' : 'PENDING';
      const lease = new Date(input.now.getTime() + LEASE_MS);
      const expires = new Date(
        input.now.getTime() +
          Math.max(LEASE_MS, input.policy.assignment.durationDays * DAY_MS),
      );
      await tx.$executeRaw`INSERT INTO quest_generation_logs
        (request_key,user_id,requested_by,status,selection_reason,provider,model_version,prompt_version,policy_version,policy_snapshot,input_summary,candidates,reserved_points,reservation_day,lease_expires_at,reservation_expires_at,generated_at,finished_at)
        VALUES (${input.key}::uuid,${input.userId},${input.actorId},${status},${reason},${QUEST_PROVIDER},${input.model},${QUEST_PROMPT_VERSION},${input.policy.version},${JSON.stringify(input.policy)}::jsonb,${JSON.stringify(input.summary)}::jsonb,${JSON.stringify(input.candidates)}::jsonb,${reserved},${bangkokDay(input.now)}::date,${lease},${expires},(${input.now}::timestamptz AT TIME ZONE 'UTC'),${reason ? input.now : null})`;
      const run = await this.run(tx, input.key);
      if (!run) throw new ConflictException('QUEST_CLAIM_FAILED');
      return { run, claimed: !reason };
    });
  }

  async replay(key: string, userId: bigint, actorId: bigint, now: Date) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      const existing = await this.run(tx, key);
      if (!existing) return undefined;
      if (existing.user_id !== userId || existing.requested_by !== actorId)
        throw new ConflictException('QUEST_IDEMPOTENCY_CONFLICT');
      await tx.$executeRaw`UPDATE quest_generation_logs SET status='FAILED',selection_reason='LEASE_EXPIRED',finished_at=${now} WHERE request_key=${key}::uuid AND status='PENDING' AND lease_expires_at <= ${now}`;
      return await this.run(tx, key);
    });
  }

  async fail(key: string, reason: string, now: Date) {
    await this.db
      .$executeRaw`UPDATE quest_generation_logs SET status='FAILED', selection_reason=${reason}, finished_at=${now} WHERE request_key=${key}::uuid AND status='PENDING'`;
  }

  async finalize(
    key: string,
    candidate: Candidate,
    output: unknown,
    policy: QuestPolicy,
    now: Date,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx);
      const run = await this.run(tx, key);
      if (!run || run.status !== 'PENDING')
        throw new ConflictException('QUEST_GENERATION_NOT_PENDING');
      const [lease] = await tx.$queryRaw<
        { valid: boolean; snapshot_matches: boolean }[]
      >`SELECT lease_expires_at > ${now} AS valid,
        (policy_snapshot = ${JSON.stringify(policy)}::jsonb AND EXISTS
          (SELECT 1 FROM jsonb_array_elements(candidates) c WHERE c = ${JSON.stringify(candidate)}::jsonb)) AS snapshot_matches
        FROM quest_generation_logs WHERE request_key=${key}::uuid`;
      const limits = await this.limits(tx, run.user_id, now, policy, key);
      const eligible = await this.lockEligibleTarget(tx, candidate);
      const prior = await this.prior(run.user_id, tx);
      const duplicate = prior.some(
        (p) =>
          p.type === candidate.type &&
          p.targetId === candidate.targetId &&
          ((p.status === 'ACTIVE' && p.expiresAt > now) ||
            (p.completedAt ?? p.expiresAt).getTime() +
              policy.assignment.duplicateCooldownDays * DAY_MS >
              now.getTime()),
      );
      await tx.$queryRaw`SELECT user_id FROM users WHERE user_id=${run.user_id} FOR SHARE`;
      await tx.$queryRaw`SELECT user_role_id FROM user_roles WHERE user_id=${run.user_id} AND role='CONSUMER' FOR SHARE`;
      const user = await tx.user.findFirst({
        where: {
          userId: run.user_id,
          status: 'ACTIVE',
          OR: [
            { role: 'CONSUMER' },
            { roles: { some: { role: 'CONSUMER', status: 'ACTIVE' } } },
          ],
        },
        select: { userId: true },
      });
      const budgetExceeded =
        typeof limits !== 'string' &&
        (limits.daily + BigInt(candidate.rewardPoints) >
          BigInt(policy.rewards.globalDailyReservationBudgetPoints) ||
          limits.outstanding + BigInt(candidate.rewardPoints) >
            BigInt(policy.rewards.globalOutstandingReservationBudgetPoints));
      const reason = !lease?.valid
        ? 'LEASE_EXPIRED'
        : !lease.snapshot_matches
          ? 'SNAPSHOT_MISMATCH'
          : !user
            ? 'CONSUMER_INACTIVE'
            : !eligible
              ? 'CATALOG_CHANGED'
              : duplicate
                ? 'DUPLICATE'
                : typeof limits === 'string'
                  ? limits
                  : budgetExceeded
                    ? 'BUDGET_LIMIT'
                    : null;
      if (reason) {
        await tx.$executeRaw`UPDATE quest_generation_logs SET status='DEFERRED',selection_reason=${reason},candidate_scores=${JSON.stringify(output)}::jsonb,finished_at=${now} WHERE request_key=${key}::uuid`;
      } else {
        const target =
          candidate.targetId === null ? null : BigInt(candidate.targetId);
        const quest = await tx.quest.create({
          data: {
            questName: QUEST_TITLES[candidate.type],
            createdAt: now,
            questType: candidate.type,
            targetCategoryId:
              candidate.type === 'CATEGORY_SPEND' ? target : null,
            targetProductId:
              candidate.type === 'PRODUCT_PURCHASE' ? target : null,
            targetMerchantId:
              candidate.type === 'MERCHANT_SPEND' ? target : null,
            minSpend:
              candidate.minimumSpendMinor === null
                ? null
                : new Prisma.Decimal(candidate.minimumSpendMinor).div(100),
            rewardPoint: candidate.rewardPoints,
            durationDays: candidate.durationDays,
            generatedBy: QUEST_PROVIDER,
          },
        });
        const expires = new Date(
          now.getTime() + candidate.durationDays * DAY_MS,
        );
        const assignment = await tx.userQuest.create({
          data: {
            userId: run.user_id,
            questId: quest.questId,
            status: 'ACTIVE',
            assignedAt: now,
            expiresAt: expires,
          },
        });
        await tx.$executeRaw`UPDATE quest_generation_logs SET status='ASSIGNED',generated_quest_id=${quest.questId},assignment_id=${assignment.userQuestId},reserved_points=${candidate.rewardPoints},reservation_day=${bangkokDay(now)}::date,reservation_expires_at=${expires},candidate_scores=${JSON.stringify(output)}::jsonb,finished_at=${now} WHERE request_key=${key}::uuid`;
      }
      const updated = await this.run(tx, key);
      if (!updated) throw new ConflictException('QUEST_FINALIZE_FAILED');
      return updated;
    });
  }

  private async lockEligibleTarget(tx: Tx, candidate: Candidate) {
    if (candidate.type === 'MIN_SPEND') return true;
    if (candidate.targetId === null) return false;
    const target = BigInt(candidate.targetId);
    const rows = await tx.$queryRaw<{ product_id: bigint }[]>`
      SELECT p.product_id FROM products p JOIN merchants m ON m.merchant_id=p.merchant_id
      JOIN product_categories c ON c.category_id=p.category_id
      WHERE p.status='ACTIVE' AND m.status='ACTIVE' AND c.status='ACTIVE'
        AND ((${candidate.type}='PRODUCT_PURCHASE' AND p.product_id=${target}) OR
          (${candidate.type}='CATEGORY_SPEND' AND c.category_id=${target}) OR
          (${candidate.type}='MERCHANT_SPEND' AND m.merchant_id=${target}))
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
        quest: {
          select: {
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
      status:
        r.status === 'ACTIVE' && r.expiresAt <= now ? 'EXPIRED' : r.status,
      assignedAt: r.assignedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
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
}
