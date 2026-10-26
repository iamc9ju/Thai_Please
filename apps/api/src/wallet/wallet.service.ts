import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BANGKOK_TZ_OFFSET_HOURS,
  FundType,
  LegacyTransactionType,
  TOPUP_LIMITS,
  TransactionType,
  WALLET_TRANSACTION_PAGE_LIMITS,
} from './wallet.constants.js';
import type { TopUpDto } from './dto/top-up.dto.js';
import type { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto.js';

const RECENT_PAID_ORDER_LIMIT = 5;
const PAID_ORDER_STATUS = 'PAID';
const TRANSACTION_CURSOR_VERSION = 1;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private assertMatchingTopUpReplay(
    transaction: {
      amount: Prisma.Decimal | number | string;
      fundType: string;
      transactionType: string;
      userId: bigint | null;
      walletId: bigint;
    },
    userId: bigint,
    walletId: bigint,
    amount: number,
  ): void {
    const isRecognizedPersonalTopUp =
      transaction.transactionType === TransactionType.PERSONAL_TOPUP ||
      transaction.transactionType === LegacyTransactionType.PERSONAL_TOPUP;
    const isSamePayload =
      transaction.walletId === walletId &&
      transaction.userId === userId &&
      transaction.fundType === FundType.PERSONAL &&
      isRecognizedPersonalTopUp &&
      new Prisma.Decimal(transaction.amount).equals(amount);

    if (!isSamePayload) {
      throw new ConflictException('TOPUP_IDEMPOTENCY_KEY_CONFLICT');
    }
  }

  private assertActiveConsumerWallet(wallet: {
    status: string;
    walletType: string;
  }): void {
    if (wallet.status !== 'ACTIVE' || wallet.walletType !== 'CONSUMER') {
      throw new ConflictException('WALLET_NOT_ACTIVE_CONSUMER');
    }
  }

  private parseBangkokDateBoundary(value: string, nextDay: boolean): Date {
    const match = DATE_ONLY_PATTERN.exec(value);
    if (!match) {
      throw new BadRequestException('WALLET_TRANSACTION_DATE_INVALID');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      throw new BadRequestException('WALLET_TRANSACTION_DATE_INVALID');
    }

    const offsetMs = BANGKOK_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const nextDayMs = nextDay ? 24 * 60 * 60 * 1000 : 0;
    return new Date(calendarDate.getTime() - offsetMs + nextDayMs);
  }

  private encodeTransactionCursor(transaction: {
    createdAt: Date;
    walletTransactionId: bigint;
  }): string {
    return Buffer.from(
      JSON.stringify({
        version: TRANSACTION_CURSOR_VERSION,
        createdAt: transaction.createdAt.toISOString(),
        transactionId: transaction.walletTransactionId.toString(),
      }),
    ).toString('base64url');
  }

  private decodeTransactionCursor(cursor: string): {
    createdAt: Date;
    transactionId: bigint;
  } {
    try {
      const decoded: unknown = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      );
      if (typeof decoded !== 'object' || decoded === null) {
        throw new Error('cursor payload must be an object');
      }

      const payload = decoded as Record<string, unknown>;
      if (
        payload.version !== TRANSACTION_CURSOR_VERSION ||
        typeof payload.createdAt !== 'string' ||
        typeof payload.transactionId !== 'string' ||
        !/^[1-9]\d*$/.test(payload.transactionId)
      ) {
        throw new Error('cursor payload fields are invalid');
      }

      const createdAt = new Date(payload.createdAt);
      if (
        Number.isNaN(createdAt.getTime()) ||
        createdAt.toISOString() !== payload.createdAt
      ) {
        throw new Error('cursor timestamp is invalid');
      }

      return {
        createdAt,
        transactionId: BigInt(payload.transactionId),
      };
    } catch {
      throw new BadRequestException('WALLET_TRANSACTION_CURSOR_INVALID');
    }
  }

  /**
   * คำนวณช่วงวันแบบ [เริ่มวัน, เริ่มวันถัดไป) ใน Timezone Asia/Bangkok
   */
  private getBangkokDayBoundaries(now = new Date()): {
    startOfDayUtc: Date;
    nextDayUtc: Date;
  } {
    const offsetMs = BANGKOK_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const bangkokNow = new Date(now.getTime() + offsetMs);

    const startOfDayUtc = new Date(
      Date.UTC(
        bangkokNow.getUTCFullYear(),
        bangkokNow.getUTCMonth(),
        bangkokNow.getUTCDate(),
        0,
        0,
        0,
        0,
      ) - offsetMs,
    );

    const nextDayUtc = new Date(startOfDayUtc.getTime() + 24 * 60 * 60 * 1000);

    return { startOfDayUtc, nextDayUtc };
  }

  /**
   * แปลง instant เป็นวันที่ธุรกิจในกรุงเทพฯ สำหรับเปรียบเทียบ PostgreSQL DATE
   */
  private getBangkokBusinessDate(now = new Date()): Date {
    const offsetMs = BANGKOK_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const bangkokNow = new Date(now.getTime() + offsetMs);

    return new Date(
      Date.UTC(
        bangkokNow.getUTCFullYear(),
        bangkokNow.getUTCMonth(),
        bangkokNow.getUTCDate(),
      ),
    );
  }

  /**
   * ดึงหรือสร้าง Consumer Wallet หากยังไม่มี (ป้องกัน Race Condition และ Unique Constraint)
   */
  async getOrCreateConsumerWallet(userId: bigint) {
    const existing = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    const now = new Date();
    const businessDate = this.getBangkokBusinessDate(now);
    const activeProgram = await this.prisma.subsidyProgram.findFirst({
      where: {
        status: 'ACTIVE',
        startDate: { lte: businessDate },
        endDate: { gte: businessDate },
      },
    });

    const initialGrant = activeProgram ? activeProgram.initialGrant : 0;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const insideWallet = await tx.wallet.findUnique({
          where: { userId },
        });
        if (insideWallet) {
          return insideWallet;
        }

        const newWallet = await tx.wallet.create({
          data: {
            userId,
            walletType: 'CONSUMER',
            personalBalance: 0,
            subsidyBalance: initialGrant,
            subsidyProgramId: activeProgram?.programId ?? null,
            status: 'ACTIVE',
          },
        });

        if (activeProgram && Number(initialGrant) > 0) {
          await tx.walletTransaction.create({
            data: {
              walletId: newWallet.walletId,
              programId: activeProgram.programId,
              fundType: FundType.SUBSIDY,
              transactionType: TransactionType.SUBSIDY_GRANT,
              amount: initialGrant,
              balanceBefore: 0,
              balanceAfter: initialGrant,
              businessRef: `grant_${newWallet.walletId}_${Date.now()}`,
              correlationId: randomUUID(),
              userId,
              walletTypeSnapshot: 'CONSUMER',
            },
          });
        }

        return newWallet;
      });
    } catch {
      // หากเกิด Race Condition ให้ query wallet ที่เพิ่งถูกสร้างขึ้นมา
      const fallbackWallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });
      if (fallbackWallet) {
        return fallbackWallet;
      }
      throw new ConflictException('ไม่สามารถสร้างหรือเข้าถึงกระเป๋าเงินได้');
    }
  }

  /**
   * FR-C01 & FR-C03: ดึงข้อมูลภาพรวมของกระเป๋าเงินและสิทธิประโยชน์
   */
  async getConsumerOverview(userId: bigint) {
    const now = new Date();
    const [user, wallet] = await Promise.all([
      this.prisma.user.findUnique({
        where: { userId },
        select: {
          pointBalance: true,
        },
      }),
      this.prisma.wallet.findUnique({
        where: { userId },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    if (!wallet) {
      throw new NotFoundException('ไม่พบข้อมูลกระเป๋าเงิน');
    }

    const businessDate = this.getBangkokBusinessDate(now);
    const { startOfDayUtc, nextDayUtc } = this.getBangkokDayBoundaries(now);

    // จำกัด concurrent DB reads ครั้งละ 3 เพื่อป้องกัน cold PrismaPg/Neon pool
    // จาก connection burst 6 รายการ ขณะที่ยังลด waterfall จากแบบ sequential เดิม
    const [activeProgram, todaySubsidyAggregate, userQuests] =
      await Promise.all([
        this.prisma.subsidyProgram.findFirst({
          where: {
            status: 'ACTIVE',
            startDate: { lte: businessDate },
            endDate: { gte: businessDate },
          },
        }),
        this.prisma.walletTransaction.aggregate({
          where: {
            walletId: wallet.walletId,
            fundType: FundType.SUBSIDY,
            transactionType: TransactionType.PAYMENT_SUBSIDY,
            createdAt: { gte: startOfDayUtc, lt: nextDayUtc },
          },
          _sum: { amount: true },
        }),
        // FR-C01 เป็น read-only: การ assign Quest เป็นหน้าที่ของ workflow FR-C07
        this.prisma.userQuest.findMany({
          where: {
            userId,
            status: 'ACTIVE',
            expiresAt: { gt: now },
          },
          include: { quest: true },
          orderBy: { assignedAt: 'desc' },
          take: 5,
        }),
      ]);

    const [userCoupons, recentTransactions, recentOrders] = await Promise.all([
      this.prisma.userCoupon.findMany({
        where: {
          userId,
          status: 'AVAILABLE',
          expiresAt: { gt: now },
        },
        include: { coupon: true },
        orderBy: { redeemedAt: 'desc' },
        take: 5,
      }),
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.walletId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.order.findMany({
        where: {
          userId,
          status: PAID_ORDER_STATUS,
          paidAt: { not: null },
        },
        select: {
          orderId: true,
          finalAmount: true,
          paidAt: true,
          merchant: {
            select: { merchantName: true },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: RECENT_PAID_ORDER_LIMIT,
      }),
    ]);

    const dailySubsidyUsed = Number(todaySubsidyAggregate._sum.amount ?? 0);

    const dailySubsidyLimit = activeProgram
      ? Number(activeProgram.dailySubsidyLimit)
      : 0;
    const subsidyBalance = Number(wallet.subsidyBalance);
    const dailyCapRemaining = Math.max(0, dailySubsidyLimit - dailySubsidyUsed);
    const dailySubsidyRemaining = Math.min(subsidyBalance, dailyCapRemaining);

    return {
      wallet: {
        walletId: wallet.walletId.toString(),
        personalBalance: Number(wallet.personalBalance),
        subsidyBalance,
        totalBalance: Number(wallet.personalBalance) + subsidyBalance,
        dailySubsidyLimit,
        dailySubsidyUsed,
        dailySubsidyRemaining,
        pointBalance: user.pointBalance,
      },
      program: activeProgram
        ? {
            programId: activeProgram.programId.toString(),
            programName: activeProgram.programName,
            subsidyPercentage: Number(activeProgram.subsidyPercentage),
            userPercentage: Number(activeProgram.userPercentage),
            dailySubsidyLimit: Number(activeProgram.dailySubsidyLimit),
            startDate: activeProgram.startDate,
            endDate: activeProgram.endDate,
          }
        : null,
      quests: userQuests.map((uq) => ({
        userQuestId: uq.userQuestId.toString(),
        questId: uq.questId.toString(),
        questName: uq.quest.questName,
        description: uq.quest.description,
        rewardPoint: uq.quest.rewardPoint,
        minSpend: uq.quest.minSpend ? Number(uq.quest.minSpend) : null,
        expiresAt: uq.expiresAt,
        status: uq.status,
      })),
      coupons: userCoupons.map((uc) => ({
        userCouponId: uc.userCouponId.toString(),
        couponId: uc.couponId.toString(),
        couponName: uc.coupon.couponName,
        description: uc.coupon.description,
        discountType: uc.coupon.discountType,
        discountValue: Number(uc.coupon.discountValue),
        minPurchase: Number(uc.coupon.minPurchase),
        expiresAt: uc.expiresAt,
        status: uc.status,
      })),
      recentTransactions: recentTransactions.map((tx) => ({
        transactionId: tx.walletTransactionId.toString(),
        fundType: tx.fundType,
        transactionType: tx.transactionType,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        createdAt: tx.createdAt,
      })),
      recentOrders: recentOrders.map((order) => ({
        orderId: order.orderId.toString(),
        merchantName: order.merchant.merchantName,
        finalAmount: Number(order.finalAmount),
        paidAt: order.paidAt,
      })),
    };
  }

  /**
   * FR-C02: อ่านประวัติธุรกรรมของ Consumer แบบ bounded keyset pagination
   */
  async getConsumerTransactions(
    userId: bigint,
    query: WalletTransactionsQueryDto,
  ) {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      throw new BadRequestException('WALLET_TRANSACTION_DATE_RANGE_INVALID');
    }

    const limit = query.limit ?? WALLET_TRANSACTION_PAGE_LIMITS.DEFAULT;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > WALLET_TRANSACTION_PAGE_LIMITS.MAX
    ) {
      throw new BadRequestException('WALLET_TRANSACTION_LIMIT_INVALID');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { walletId: true, walletType: true },
    });
    if (!wallet) {
      throw new NotFoundException('WALLET_NOT_FOUND');
    }
    if (wallet.walletType !== 'CONSUMER') {
      throw new ConflictException('WALLET_NOT_CONSUMER');
    }

    const dateFilter: { gte?: Date; lt?: Date } = {};
    if (query.dateFrom) {
      dateFilter.gte = this.parseBangkokDateBoundary(query.dateFrom, false);
    }
    if (query.dateTo) {
      dateFilter.lt = this.parseBangkokDateBoundary(query.dateTo, true);
    }

    const cursor = query.cursor
      ? this.decodeTransactionCursor(query.cursor)
      : null;
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.walletId,
        ...(Object.keys(dateFilter).length > 0
          ? { createdAt: dateFilter }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  walletTransactionId: { lt: cursor.transactionId },
                },
              ],
            }
          : {}),
      },
      select: {
        walletTransactionId: true,
        fundType: true,
        transactionType: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { walletTransactionId: 'desc' }],
      take: limit + 1,
    });

    const hasNextPage = transactions.length > limit;
    const page = hasNextPage ? transactions.slice(0, limit) : transactions;
    const lastTransaction = page.at(-1);

    return {
      items: page.map((transaction) => ({
        transactionId: transaction.walletTransactionId.toString(),
        fundType: transaction.fundType,
        transactionType: transaction.transactionType,
        amount: Number(transaction.amount),
        balanceBefore: Number(transaction.balanceBefore),
        balanceAfter: Number(transaction.balanceAfter),
        createdAt: transaction.createdAt,
      })),
      nextCursor:
        hasNextPage && lastTransaction
          ? this.encodeTransactionCursor(lastTransaction)
          : null,
    };
  }

  /**
   * FR-C02: เติมเงินจำลองเข้ากระเป๋าส่วนตัว (Virtual Top-up)
   * ปฏิบัติตาม BR-WALLET-003: Idempotent และสร้าง Ledger Entry ใน Transaction เดียว
   */
  async topUpPersonal(userId: bigint, dto: TopUpDto) {
    if (
      !Number.isInteger(dto.amount) ||
      dto.amount < TOPUP_LIMITS.MIN_AMOUNT ||
      dto.amount > TOPUP_LIMITS.MAX_AMOUNT
    ) {
      throw new BadRequestException('TOPUP_AMOUNT_OUT_OF_RANGE');
    }
    if (
      dto.idempotencyKey.length < TOPUP_LIMITS.IDEMPOTENCY_KEY_MIN_LENGTH ||
      dto.idempotencyKey.length > TOPUP_LIMITS.IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
      throw new BadRequestException('TOPUP_IDEMPOTENCY_KEY_INVALID');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) {
      throw new NotFoundException('WALLET_NOT_FOUND');
    }
    this.assertActiveConsumerWallet(wallet);

    const businessRef = `topup_${wallet.walletId}_${dto.idempotencyKey}`;

    // 1. ตรวจสอบ Idempotency
    const existingTx = await this.prisma.walletTransaction.findUnique({
      where: { businessRef },
    });

    if (existingTx) {
      this.assertMatchingTopUpReplay(
        existingTx,
        userId,
        wallet.walletId,
        dto.amount,
      );
      return {
        success: true,
        isIdempotentReplay: true,
        transactionId: existingTx.walletTransactionId.toString(),
        amount: Number(existingTx.amount),
        personalBalance: Number(existingTx.balanceAfter),
        createdAt: existingTx.createdAt,
      };
    }

    // 2. ดำเนินการเติมเงินใน Database Transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ wallet_id: bigint }>>`
        SELECT "wallet_id"
        FROM "wallets"
        WHERE "wallet_id" = ${wallet.walletId}
        FOR UPDATE
      `;

      const lockedWallet = await tx.wallet.findUnique({
        where: { walletId: wallet.walletId },
      });

      if (!lockedWallet) {
        throw new NotFoundException('WALLET_NOT_FOUND');
      }
      this.assertActiveConsumerWallet(lockedWallet);

      // ตรวจซ้ำหลัง lock เพื่อให้ concurrent retry คืนผลเดิมโดยไม่เพิ่มยอดซ้ำ
      const transactionAfterLock = await tx.walletTransaction.findUnique({
        where: { businessRef },
      });
      if (transactionAfterLock) {
        this.assertMatchingTopUpReplay(
          transactionAfterLock,
          userId,
          wallet.walletId,
          dto.amount,
        );
        return {
          success: true,
          isIdempotentReplay: true,
          transactionId: transactionAfterLock.walletTransactionId.toString(),
          amount: Number(transactionAfterLock.amount),
          personalBalance: Number(transactionAfterLock.balanceAfter),
          createdAt: transactionAfterLock.createdAt,
        };
      }

      const balanceBefore = new Prisma.Decimal(lockedWallet.personalBalance);
      const balanceAfter = balanceBefore.plus(dto.amount);

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { walletId: wallet.walletId },
        data: {
          personalBalance: balanceAfter,
          version: { increment: 1 },
        },
      });

      // Create ledger entry
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.walletId,
          userId,
          fundType: FundType.PERSONAL,
          transactionType: TransactionType.PERSONAL_TOPUP,
          amount: dto.amount,
          balanceBefore,
          balanceAfter,
          businessRef,
          correlationId: randomUUID(),
          walletTypeSnapshot: 'CONSUMER',
          metadata: {
            source: 'VIRTUAL_TOPUP',
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });

      return {
        success: true,
        isIdempotentReplay: false,
        transactionId: transaction.walletTransactionId.toString(),
        amount: dto.amount,
        personalBalance: Number(updatedWallet.personalBalance),
        createdAt: transaction.createdAt,
      };
    });
  }
}
