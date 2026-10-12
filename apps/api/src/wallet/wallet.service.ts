import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import {
  PROTOTYPE_MONEY,
  PrototypePolicyService,
} from '../common/policy/prototype-policy.service.js';
import { hashCanonical } from '../common/security/token.js';
import { SystemClock } from '../common/time/clock.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { isPrismaConcurrencyConflict } from '../infrastructure/database/prisma-errors.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PrototypePolicyService,
    private readonly clock: SystemClock,
  ) {}

  async getOverview(userId: number): Promise<unknown> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        coupons: {
          where: { status: 'ACTIVE', expiresAt: { gt: this.clock.now() } },
        },
        questAssignments: {
          where: { status: 'ACTIVE', expiresAt: { gt: this.clock.now() } },
          include: { quest: true },
        },
      },
    });
    if (user === null || user.wallet === null) {
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    }
    const pointBalance = await this.pointBalance(userId);
    return {
      id: user.id,
      display_name: user.displayName,
      role: user.role,
      wallet: this.walletView(user.wallet),
      point_balance: pointBalance,
      quests: user.questAssignments,
      coupons: user.coupons,
    };
  }

  async getWallet(userId: number): Promise<unknown> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (wallet === null) {
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    }
    return this.walletView(wallet);
  }

  async history(userId: number): Promise<unknown> {
    return this.prisma.walletLedgerEntry.findMany({
      where: { userId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  async subsidy(userId: number): Promise<unknown> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (wallet === null) {
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    }
    const now = this.clock.now();
    const bounds = this.policy.bangkokDayBounds(now);
    const aggregate = await this.prisma.walletLedgerEntry.aggregate({
      where: {
        userId,
        bucket: 'SUBSIDY',
        type: 'PAYMENT',
        occurredAt: { gte: bounds.start, lt: bounds.end },
      },
      _sum: { amount: true },
    });
    const usedToday = Math.abs(aggregate._sum.amount ?? 0);
    return {
      balance: wallet.subsidyBalance,
      daily_cap: this.policy.dailySubsidyCap,
      used_today: usedToday,
      remaining_today: Math.max(0, this.policy.dailySubsidyCap - usedToday),
      subsidy_percent: this.policy.subsidyPercent,
      currency: PROTOTYPE_MONEY.currency,
      unit: PROTOTYPE_MONEY.unit,
      timezone: 'Asia/Bangkok',
    };
  }

  async topup(
    userId: number,
    amount: number,
    idempotencyKey: string | undefined,
    correlationId: string,
  ): Promise<unknown> {
    this.validateIdempotencyKey(idempotencyKey);
    if (amount < 1 || amount > this.policy.maxTopup) {
      throw new DomainException(
        DOMAIN_ERRORS.invalidAmount,
        HttpStatus.BAD_REQUEST,
      );
    }
    const key = idempotencyKey;
    const scope = `wallet-topup:${userId}`;
    const requestHash = hashCanonical([
      userId,
      amount,
      PROTOTYPE_MONEY.currency,
    ]);
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.idempotencyRecord.findUnique({
            where: { scope_key: { scope, key } },
          });
          if (existing !== null) {
            if (existing.requestHash !== requestHash) {
              throw new DomainException(
                DOMAIN_ERRORS.idempotencyConflict,
                HttpStatus.CONFLICT,
              );
            }
            return existing.response;
          }
          const locked = await transaction.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM wallets WHERE user_id = ${userId} FOR UPDATE
      `;
          if (locked.length !== 1) {
            throw new DomainException(
              DOMAIN_ERRORS.notFound,
              HttpStatus.NOT_FOUND,
            );
          }
          const wallet = await transaction.wallet.update({
            where: { userId },
            data: {
              personalBalance: { increment: amount },
              version: { increment: 1 },
            },
          });
          const ledger = await transaction.walletLedgerEntry.create({
            data: {
              walletId: wallet.id,
              userId,
              bucket: 'PERSONAL',
              type: 'TOPUP',
              amount,
              currency: PROTOTYPE_MONEY.currency,
              businessRef: `topup:${userId}:${key}`,
              correlationId,
              occurredAt: this.clock.now(),
            },
          });
          const response = {
            wallet: this.walletView(wallet),
            transaction: ledger,
          };
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

  private async pointBalance(userId: number): Promise<number> {
    const now = this.clock.now();
    const aggregate = await this.prisma.pointAllocation.aggregate({
      where: { userId, expiresAt: { gt: now } },
      _sum: { remainingAmount: true },
    });
    return aggregate._sum.remainingAmount ?? 0;
  }

  private validateIdempotencyKey(
    value: string | undefined,
  ): asserts value is string {
    if (value === undefined || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
      throw new DomainException(
        DOMAIN_ERRORS.invalidIdempotencyKey,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private walletView(wallet: {
    id: number;
    personalBalance: number;
    subsidyBalance: number;
    currency: string;
  }) {
    return {
      id: wallet.id,
      personal_balance: wallet.personalBalance,
      subsidy_balance: wallet.subsidyBalance,
      total_balance: wallet.personalBalance + wallet.subsidyBalance,
      currency: wallet.currency,
      unit: PROTOTYPE_MONEY.unit,
    };
  }
}
