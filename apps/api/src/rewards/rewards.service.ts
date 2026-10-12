import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import { PrototypePolicyService } from '../common/policy/prototype-policy.service.js';
import { hashCanonical } from '../common/security/token.js';
import { SystemClock } from '../common/time/clock.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { isPrismaConcurrencyConflict } from '../infrastructure/database/prisma-errors.js';
import { QuestProposalProvider } from './quest-provider.js';
import { satisfiesSpendQuest } from './domain/quest-rule.js';
import { planPointRedemption } from './domain/point-redemption.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: QuestProposalProvider,
    private readonly policy: PrototypePolicyService,
    private readonly clock: SystemClock,
  ) {}

  async listQuests(userId: number): Promise<unknown> {
    const now = this.clock.now();
    const assignments = await this.prisma.userQuest.findMany({
      where: { userId },
      include: { quest: true },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
    });
    return assignments.map((assignment) => ({
      ...assignment,
      effective_status:
        assignment.status === 'ACTIVE' && assignment.expiresAt <= now
          ? 'EXPIRED'
          : assignment.status,
    }));
  }

  async quest(userId: number, assignmentId: number): Promise<unknown> {
    const assignment = await this.prisma.userQuest.findFirst({
      where: { id: assignmentId, userId },
      include: { quest: true },
    });
    if (assignment === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    return assignment;
  }

  async generate(userId: number): Promise<unknown> {
    const receipts = await this.prisma.receipt.findMany({
      where: { userId },
      select: { finalAmount: true, items: { select: { categoryId: true } } },
      take: 100,
      orderBy: { paidAt: 'desc' },
    });
    const averageFinalAmount =
      receipts.length === 0
        ? 100
        : Math.round(
            receipts.reduce((sum, receipt) => sum + receipt.finalAmount, 0) /
              receipts.length,
          );
    const counts = new Map<number, number>();
    for (const receipt of receipts)
      for (const item of receipt.items)
        counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
    const preferredCategoryId = [...counts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0];
    const proposal = await this.provider.propose({
      averageFinalAmount,
      ...(preferredCategoryId === undefined ? {} : { preferredCategoryId }),
    });
    const now = this.clock.now();
    return this.prisma.$transaction(async (transaction) => {
      const quest = await transaction.quest.create({
        data: {
          title: proposal.title,
          description: proposal.description,
          minimumAmount: proposal.minimumAmount,
          categoryId: proposal.categoryId,
          rewardPoints: proposal.rewardPoints,
          provider: proposal.provider,
          modelVersion: proposal.modelVersion,
          policyVersion: proposal.policyVersion,
        },
      });
      const assignment = await transaction.userQuest.create({
        data: {
          userId,
          questId: quest.id,
          assignedAt: now,
          expiresAt: this.policy.addDays(now, this.policy.questTtlDays),
        },
      });
      return { quest, assignment };
    });
  }

  async evaluateReceipt(
    receiptId: number,
    correlationId: string,
    expectedUserId?: number,
  ): Promise<unknown> {
    return this.prisma.$transaction(
      async (transaction) => {
        const receipt = await transaction.receipt.findUnique({
          where: { id: receiptId },
          include: { items: true },
        });
        if (
          receipt === null ||
          (expectedUserId !== undefined && receipt.userId !== expectedUserId)
        )
          throw new DomainException(
            DOMAIN_ERRORS.notFound,
            HttpStatus.NOT_FOUND,
          );
        const assignments = await transaction.userQuest.findMany({
          where: {
            userId: receipt.userId,
            status: 'ACTIVE',
            assignedAt: { lte: receipt.paidAt },
            expiresAt: { gt: receipt.paidAt },
          },
          include: { quest: true },
        });
        const completed: number[] = [];
        for (const assignment of assignments) {
          const matches = satisfiesSpendQuest(
            {
              minimumAmount: assignment.quest.minimumAmount,
              ...(assignment.quest.categoryId === null
                ? {}
                : { categoryId: assignment.quest.categoryId }),
            },
            {
              finalAmount: receipt.finalAmount,
              categoryIds: receipt.items.map((item) => item.categoryId),
            },
          );
          if (!matches) continue;
          const changed = await transaction.userQuest.updateMany({
            where: { id: assignment.id, status: 'ACTIVE' },
            data: {
              status: 'COMPLETED',
              receiptId,
              completedAt: this.clock.now(),
            },
          });
          if (changed.count !== 1) continue;
          const reward = await transaction.pointLedgerEntry.create({
            data: {
              userId: receipt.userId,
              type: 'QUEST_REWARD',
              amount: assignment.quest.rewardPoints,
              businessRef: `quest-reward:${assignment.id}`,
              correlationId,
              expiresAt: this.policy.addDays(
                this.clock.now(),
                this.policy.pointTtlDays,
              ),
            },
          });
          await transaction.pointAllocation.create({
            data: {
              userId: receipt.userId,
              sourceEntryId: reward.id,
              originalAmount: reward.amount,
              remainingAmount: reward.amount,
              expiresAt:
                reward.expiresAt ??
                this.policy.addDays(this.clock.now(), this.policy.pointTtlDays),
            },
          });
          await transaction.outboxEvent.create({
            data: {
              eventId: randomUUID(),
              type: 'quest.completed.v1',
              schemaVersion: 1,
              aggregateId: String(assignment.id),
              correlationId,
              payload: {
                assignmentId: assignment.id,
                receiptId,
                rewardPoints: reward.amount,
              },
            },
          });
          completed.push(assignment.id);
        }
        return { completed_assignment_ids: completed };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async points(userId: number): Promise<unknown> {
    const now = this.clock.now();
    const [aggregate, history] = await Promise.all([
      this.prisma.pointAllocation.aggregate({
        where: { userId, expiresAt: { gt: now } },
        _sum: { remainingAmount: true },
      }),
      this.prisma.pointLedgerEntry.findMany({
        where: { userId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    ]);
    return { balance: aggregate._sum.remainingAmount ?? 0, history };
  }

  async coupons(userId: number): Promise<unknown> {
    const now = this.clock.now();
    const [catalogue, owned] = await Promise.all([
      this.prisma.couponDefinition.findMany({
        where: { active: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.userCoupon.findMany({
        where: { userId },
        include: { definition: true },
        orderBy: [{ redeemedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);
    return {
      catalogue,
      owned: owned.map((coupon) => ({
        ...coupon,
        effective_status:
          coupon.status === 'ACTIVE' && coupon.expiresAt <= now
            ? 'EXPIRED'
            : coupon.status,
      })),
    };
  }

  async redeemCoupon(
    userId: number,
    definitionId: number,
    idempotencyKey: string | undefined,
    correlationId: string,
  ): Promise<unknown> {
    if (
      idempotencyKey === undefined ||
      !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
    )
      throw new DomainException(
        DOMAIN_ERRORS.invalidIdempotencyKey,
        HttpStatus.BAD_REQUEST,
      );
    const scope = `coupon-redemption:${userId}`;
    const requestHash = hashCanonical([userId, definitionId]);
    const key = idempotencyKey;
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.idempotencyRecord.findUnique({
            where: { scope_key: { scope, key } },
          });
          if (existing !== null) {
            if (existing.requestHash !== requestHash)
              throw new DomainException(
                DOMAIN_ERRORS.idempotencyConflict,
                HttpStatus.CONFLICT,
              );
            return existing.response;
          }
          await transaction.$queryRaw<
            Array<{ id: number }>
          >`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
          const definition = await transaction.couponDefinition.findFirst({
            where: { id: definitionId, active: true },
          });
          if (definition === null)
            throw new DomainException(
              DOMAIN_ERRORS.notFound,
              HttpStatus.NOT_FOUND,
            );
          const now = this.clock.now();
          const allocations = await transaction.pointAllocation.findMany({
            where: { userId, remainingAmount: { gt: 0 } },
          });
          const plan = planPointRedemption(
            allocations,
            definition.pointsCost,
            now,
          );
          if (!plan.sufficient)
            throw new DomainException(
              DOMAIN_ERRORS.insufficientPoints,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          for (const deduction of plan.deductions) {
            await transaction.pointAllocation.update({
              where: { id: deduction.id },
              data: { remainingAmount: { decrement: deduction.amount } },
            });
          }
          const ledger = await transaction.pointLedgerEntry.create({
            data: {
              userId,
              type: 'COUPON_REDEMPTION',
              amount: -definition.pointsCost,
              businessRef: `coupon-redemption:${userId}:${key}`,
              correlationId,
            },
          });
          const coupon = await transaction.userCoupon.create({
            data: {
              userId,
              definitionId,
              redeemedAt: now,
              expiresAt: this.policy.addDays(now, this.policy.couponTtlDays),
            },
          });
          const response = { coupon, point_transaction: ledger };
          await transaction.idempotencyRecord.create({
            data: {
              scope,
              key,
              requestHash,
              statusCode: HttpStatus.CREATED,
              response,
            },
          });
          return response;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: unknown) {
      if (isPrismaConcurrencyConflict(error)) {
        const existing = await this.prisma.idempotencyRecord.findUnique({
          where: { scope_key: { scope, key } },
        });
        if (existing !== null && existing.requestHash === requestHash)
          return existing.response;
      }
      throw error;
    }
  }
}
