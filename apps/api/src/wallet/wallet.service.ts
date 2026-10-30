import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BANGKOK_TIMEZONE,
  BANGKOK_TZ_OFFSET_HOURS,
  DASHBOARD_TREND_DAYS,
  DASHBOARD_TREND_PAGE_LIMITS,
  FundType,
  LegacyTransactionType,
  TOPUP_LIMITS,
  TransactionType,
  WALLET_TRANSACTION_PAGE_LIMITS,
  WITHDRAWAL_LIMITS,
} from './wallet.constants.js';
import type { TopUpDto } from './dto/top-up.dto.js';
import type { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto.js';
import type { WithdrawMerchantWalletDto } from './dto/withdraw-merchant-wallet.dto.js';

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
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        pointBalance: true,
      },
    });

    if (!user) {
      throw new NotFoundException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) {
      throw new NotFoundException('ไม่พบข้อมูลกระเป๋าเงิน');
    }

    const businessDate = this.getBangkokBusinessDate(now);
    const activeProgram = await this.prisma.subsidyProgram.findFirst({
      where: {
        status: 'ACTIVE',
        startDate: { lte: businessDate },
        endDate: { gte: businessDate },
      },
    });

    const { startOfDayUtc, nextDayUtc } = this.getBangkokDayBoundaries(now);

    // คำนวณยอดเงินอุดหนุนที่ใช้ไปในวันนี้
    const todaySubsidyTxs = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.walletId,
        fundType: FundType.SUBSIDY,
        transactionType: TransactionType.PAYMENT_SUBSIDY,
        createdAt: { gte: startOfDayUtc, lt: nextDayUtc },
      },
      select: { amount: true },
    });

    const dailySubsidyUsed = todaySubsidyTxs.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );

    const dailySubsidyLimit = activeProgram
      ? Number(activeProgram.dailySubsidyLimit)
      : 0;
    const subsidyBalance = Number(wallet.subsidyBalance);
    const dailyCapRemaining = Math.max(0, dailySubsidyLimit - dailySubsidyUsed);
    const dailySubsidyRemaining = Math.min(subsidyBalance, dailyCapRemaining);

    // FR-C01 เป็น read-only: การ assign Quest เป็นหน้าที่ของ workflow FR-C07
    const userQuests = await this.prisma.userQuest.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      include: { quest: true },
      orderBy: { assignedAt: 'desc' },
      take: 5,
    });

    // ดึง Coupons ที่พร้อมใช้งาน
    const userCoupons = await this.prisma.userCoupon.findMany({
      where: {
        userId,
        status: 'AVAILABLE',
        expiresAt: { gt: now },
      },
      include: { coupon: true },
      orderBy: { redeemedAt: 'desc' },
      take: 5,
    });

    // ดึงประวัติธุรกรรมล่าสุด 10 รายการ
    const recentTransactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.walletId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ดึงเฉพาะรายการชำระสำเร็จของ Consumer คนปัจจุบันแบบมีขอบเขต
    const recentOrders = await this.prisma.order.findMany({
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
    });

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

  // ─── FR-M06 & FR-M07: Merchant Wallet, Withdrawal, and Analytics Dashboard ───

  private resolveAuthorizedMerchantId(
    activeMerchantId: bigint | null,
    requestedMerchantId?: bigint,
  ): bigint {
    if (!activeMerchantId) {
      throw new ForbiddenException('MERCHANT_CONTEXT_REQUIRED');
    }
    if (
      requestedMerchantId !== undefined &&
      requestedMerchantId !== activeMerchantId
    ) {
      throw new ForbiddenException('MERCHANT_ACCESS_DENIED');
    }
    return activeMerchantId;
  }

  private assertActiveMerchantWallet(wallet: {
    status: string;
    walletType: string;
  }): void {
    if (wallet.status !== 'ACTIVE' || wallet.walletType !== 'MERCHANT') {
      throw new ConflictException('WALLET_NOT_ACTIVE_MERCHANT');
    }
  }

  private assertMatchingWithdrawalReplay(
    transaction: {
      amount: Prisma.Decimal | number | string;
      fundType: string;
      initiatedByUserId: bigint | null;
      transactionType: string;
      walletId: bigint;
    },
    userId: bigint,
    merchantWalletId: bigint,
    amount: number,
  ): void {
    const isSamePayload =
      transaction.walletId === merchantWalletId &&
      transaction.initiatedByUserId === userId &&
      transaction.fundType === FundType.MERCHANT &&
      transaction.transactionType === TransactionType.MERCHANT_WITHDRAWAL &&
      new Prisma.Decimal(transaction.amount).equals(amount);

    if (!isSamePayload) {
      throw new ConflictException('WITHDRAWAL_IDEMPOTENCY_KEY_CONFLICT');
    }
  }

  private async hasActiveConsumerRole(userId: bigint): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      include: { roles: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return false;
    }
    return (
      user.role === 'CONSUMER' ||
      user.roles.some((r) => r.role === 'CONSUMER' && r.status === 'ACTIVE')
    );
  }

  private async getOrCreateMerchantWallet(merchantId: bigint) {
    const existing = await this.prisma.wallet.findUnique({
      where: { merchantId },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.wallet.create({
        data: {
          merchantId,
          walletType: 'MERCHANT',
          personalBalance: 0,
          subsidyBalance: 0,
          merchantBalance: 0,
          status: 'ACTIVE',
        },
      });
    } catch {
      const fallback = await this.prisma.wallet.findUnique({
        where: { merchantId },
      });
      if (fallback) {
        return fallback;
      }
      throw new ConflictException('MERCHANT_WALLET_CREATE_FAILED');
    }
  }

  private formatBangkokDateKey(date: Date): string {
    const offsetMs = BANGKOK_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const bangkokTime = new Date(date.getTime() + offsetMs);
    const yyyy = String(bangkokTime.getUTCFullYear());
    const mm = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(bangkokTime.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * FR-M06: ดึงข้อมูลกระเป๋าเงินของร้านค้า รายรับแยกตามบิล และสถานะสิทธิ์ถอนเงินเข้ากระเป๋าประชาชนของเจ้าของร้าน
   */
  async getMerchantWalletOverview(
    userId: bigint,
    activeMerchantId: bigint | null,
    requestedMerchantId?: bigint,
    query: Pick<WalletTransactionsQueryDto, 'dateFrom' | 'dateTo'> = {},
  ) {
    const merchantId = this.resolveAuthorizedMerchantId(
      activeMerchantId,
      requestedMerchantId,
    );

    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
      select: {
        merchantId: true,
        merchantName: true,
        ownerUserId: true,
        status: true,
      },
    });
    if (!merchant) {
      throw new NotFoundException('MERCHANT_NOT_FOUND');
    }

    const membership = await this.prisma.merchantMember.findFirst({
      where: {
        merchantId,
        userId,
        status: 'ACTIVE',
      },
    });

    const isMember = Boolean(membership) || merchant.ownerUserId === userId;
    if (!isMember) {
      throw new ForbiddenException('MERCHANT_ACCESS_DENIED');
    }

    const merchantWallet = await this.getOrCreateMerchantWallet(merchantId);
    const isOwner = membership
      ? membership.role === 'OWNER'
      : merchant.ownerUserId === userId;
    const hasConsumerRole = await this.hasActiveConsumerRole(userId);
    const consumerWallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    const hasActiveConsumerWallet = Boolean(
      consumerWallet &&
      consumerWallet.status === 'ACTIVE' &&
      consumerWallet.walletType === 'CONSUMER',
    );

    const paidOrders = await this.prisma.order.findMany({
      where: {
        merchantId,
        status: PAID_ORDER_STATUS,
      },
      select: {
        orderId: true,
        subtotal: true,
        discountAmount: true,
        finalAmount: true,
        subsidyAmount: true,
        userPaidAmount: true,
        paidAt: true,
        createdAt: true,
        user: {
          select: { fullName: true },
        },
      },
      orderBy: [{ paidAt: 'desc' }, { orderId: 'desc' }],
    });

    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      throw new BadRequestException('WALLET_TRANSACTION_DATE_RANGE_INVALID');
    }
    const incomeDateFrom = query.dateFrom
      ? this.parseBangkokDateBoundary(query.dateFrom, false)
      : null;
    const incomeDateTo = query.dateTo
      ? this.parseBangkokDateBoundary(query.dateTo, true)
      : null;
    const filteredPaidOrders = paidOrders.filter((order) => {
      const paidAt = order.paidAt ?? order.createdAt;
      return (
        (!incomeDateFrom || paidAt >= incomeDateFrom) &&
        (!incomeDateTo || paidAt < incomeDateTo)
      );
    });

    const totalSalesIncome = Number(
      paidOrders
        .reduce(
          (sum, order) => sum.plus(order.finalAmount),
          new Prisma.Decimal(0),
        )
        .toDecimalPlaces(2),
    );
    const totalSubsidyPortion = Number(
      paidOrders
        .reduce(
          (sum, order) => sum.plus(order.subsidyAmount),
          new Prisma.Decimal(0),
        )
        .toDecimalPlaces(2),
    );
    const totalPersonalPortion = Number(
      paidOrders
        .reduce(
          (sum, order) => sum.plus(order.userPaidAmount),
          new Prisma.Decimal(0),
        )
        .toDecimalPlaces(2),
    );

    const withdrawalTxs = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: merchantWallet.walletId,
        transactionType: TransactionType.MERCHANT_WITHDRAWAL,
      },
      select: { amount: true },
    });

    const totalWithdrawn = Number(
      withdrawalTxs
        .reduce((sum, tx) => sum.plus(tx.amount), new Prisma.Decimal(0))
        .toDecimalPlaces(2),
    );

    const recentTransactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: merchantWallet.walletId },
      include: {
        order: {
          select: {
            orderId: true,
            subtotal: true,
            discountAmount: true,
            finalAmount: true,
            subsidyAmount: true,
            userPaidAmount: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { walletTransactionId: 'desc' }],
      take: 15,
    });

    return {
      wallet: {
        walletId: merchantWallet.walletId.toString(),
        merchantId: merchant.merchantId.toString(),
        merchantName: merchant.merchantName,
        merchantStatus: merchant.status,
        walletStatus: merchantWallet.status,
        merchantBalance: Number(merchantWallet.merchantBalance),
        totalSalesIncome,
        totalSubsidyPortion,
        totalPersonalPortion,
        totalWithdrawn,
        paidOrderCount: paidOrders.length,
      },
      withdrawalEligibility: {
        isOwner,
        hasConsumerRole,
        hasConsumerWallet: hasActiveConsumerWallet,
        consumerWalletId:
          hasActiveConsumerWallet && consumerWallet
            ? consumerWallet.walletId.toString()
            : null,
        consumerPersonalBalance:
          hasActiveConsumerWallet && consumerWallet
            ? Number(consumerWallet.personalBalance)
            : null,
        canWithdraw:
          isOwner &&
          merchant.status === 'ACTIVE' &&
          merchantWallet.status === 'ACTIVE' &&
          hasConsumerRole &&
          hasActiveConsumerWallet,
      },
      orderIncomes: filteredPaidOrders.slice(0, 20).map((order) => ({
        orderId: order.orderId.toString(),
        receiptNumber: `TP-${order.orderId.toString().padStart(6, '0')}`,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        finalAmount: Number(order.finalAmount),
        subsidyAmount: Number(order.subsidyAmount),
        userPaidAmount: Number(order.userPaidAmount),
        consumerName: order.user?.fullName ?? null,
        paidAt: order.paidAt ?? order.createdAt,
      })),
      recentTransactions: recentTransactions.map((tx) => ({
        transactionId: tx.walletTransactionId.toString(),
        fundType: tx.fundType,
        transactionType: tx.transactionType,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        businessRef: tx.businessRef,
        transferReference: tx.transferReference,
        orderId: tx.orderId?.toString() ?? null,
        receiptNumber: tx.orderId
          ? `TP-${tx.orderId.toString().padStart(6, '0')}`
          : null,
        subsidyAmount: tx.order ? Number(tx.order.subsidyAmount) : null,
        userPaidAmount: tx.order ? Number(tx.order.userPaidAmount) : null,
        finalAmount: tx.order ? Number(tx.order.finalAmount) : null,
        consumerName: tx.order?.user?.fullName ?? null,
        createdAt: tx.createdAt,
      })),
    };
  }

  /**
   * FR-M06: ประวัติธุรกรรมกระเป๋าเงินของร้านค้า (Cursor Pagination + Date Range)
   */
  async getMerchantTransactions(
    userId: bigint,
    activeMerchantId: bigint | null,
    query: WalletTransactionsQueryDto,
    requestedMerchantId?: bigint,
  ) {
    const merchantId = this.resolveAuthorizedMerchantId(
      activeMerchantId,
      requestedMerchantId,
    );

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

    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
      select: { ownerUserId: true },
    });
    if (!merchant) {
      throw new NotFoundException('MERCHANT_NOT_FOUND');
    }

    const membership = await this.prisma.merchantMember.findFirst({
      where: {
        merchantId,
        userId,
        status: 'ACTIVE',
      },
    });
    if (!membership && merchant.ownerUserId !== userId) {
      throw new ForbiddenException('MERCHANT_ACCESS_DENIED');
    }

    const wallet = await this.getOrCreateMerchantWallet(merchantId);
    if (wallet.walletType !== 'MERCHANT') {
      throw new ConflictException('WALLET_NOT_MERCHANT');
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
      include: {
        order: {
          select: {
            orderId: true,
            subtotal: true,
            discountAmount: true,
            finalAmount: true,
            subsidyAmount: true,
            userPaidAmount: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { walletTransactionId: 'desc' }],
      take: limit + 1,
    });

    const hasNextPage = transactions.length > limit;
    const page = hasNextPage ? transactions.slice(0, limit) : transactions;
    const lastTransaction = page.at(-1);

    return {
      items: page.map((tx) => ({
        transactionId: tx.walletTransactionId.toString(),
        fundType: tx.fundType,
        transactionType: tx.transactionType,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        businessRef: tx.businessRef,
        transferReference: tx.transferReference,
        orderId: tx.orderId?.toString() ?? null,
        receiptNumber: tx.orderId
          ? `TP-${tx.orderId.toString().padStart(6, '0')}`
          : null,
        subsidyAmount: tx.order ? Number(tx.order.subsidyAmount) : null,
        userPaidAmount: tx.order ? Number(tx.order.userPaidAmount) : null,
        finalAmount: tx.order ? Number(tx.order.finalAmount) : null,
        consumerName: tx.order?.user?.fullName ?? null,
        createdAt: tx.createdAt,
      })),
      nextCursor:
        hasNextPage && lastTransaction
          ? this.encodeTransactionCursor(lastTransaction)
          : null,
    };
  }

  /**
   * FR-M06 & BR-WALLET-06: ถอนเงินเสมือนจาก Merchant Wallet เข้าสู่ Consumer Wallet.personal_balance ของเจ้าของร้าน
   * ทำงานแบบ Atomic Transaction พร้อม Row Lock และ Idempotency Key
   */
  async withdrawFromMerchantWallet(
    userId: bigint,
    activeMerchantId: bigint | null,
    dto: WithdrawMerchantWalletDto,
    requestedMerchantId?: bigint,
  ) {
    if (
      !Number.isInteger(dto.amount) ||
      dto.amount < WITHDRAWAL_LIMITS.MIN_AMOUNT ||
      dto.amount > WITHDRAWAL_LIMITS.MAX_AMOUNT
    ) {
      throw new BadRequestException('WITHDRAWAL_AMOUNT_OUT_OF_RANGE');
    }
    if (
      dto.idempotencyKey.length <
        WITHDRAWAL_LIMITS.IDEMPOTENCY_KEY_MIN_LENGTH ||
      dto.idempotencyKey.length > WITHDRAWAL_LIMITS.IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
      throw new BadRequestException('WITHDRAWAL_IDEMPOTENCY_KEY_INVALID');
    }

    const merchantId = this.resolveAuthorizedMerchantId(
      activeMerchantId,
      requestedMerchantId,
    );

    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
      select: {
        merchantId: true,
        merchantName: true,
        ownerUserId: true,
        status: true,
      },
    });
    if (!merchant) {
      throw new NotFoundException('MERCHANT_NOT_FOUND');
    }

    const membership = await this.prisma.merchantMember.findFirst({
      where: {
        merchantId,
        userId,
        status: 'ACTIVE',
      },
    });

    const isOwner = membership
      ? membership.role === 'OWNER'
      : merchant.ownerUserId === userId;

    if (!isOwner) {
      throw new ForbiddenException('WITHDRAWAL_OWNER_ONLY');
    }
    if (merchant.status !== 'ACTIVE') {
      throw new ForbiddenException('MERCHANT_NOT_ACTIVE');
    }

    const hasConsumerRole = await this.hasActiveConsumerRole(userId);
    if (!hasConsumerRole) {
      throw new ForbiddenException('WITHDRAWAL_CONSUMER_ROLE_REQUIRED');
    }

    const merchantWallet = await this.prisma.wallet.findUnique({
      where: { merchantId },
    });
    if (!merchantWallet) {
      throw new NotFoundException('MERCHANT_WALLET_NOT_FOUND');
    }
    this.assertActiveMerchantWallet(merchantWallet);

    const consumerWallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!consumerWallet) {
      throw new NotFoundException('CONSUMER_WALLET_NOT_FOUND');
    }
    this.assertActiveConsumerWallet(consumerWallet);

    const debitBusinessRef = `withdrawal_debit_${merchantWallet.walletId}_${dto.idempotencyKey}`;
    const creditBusinessRef = `withdrawal_credit_${merchantWallet.walletId}_${dto.idempotencyKey}`;
    const transferReference = `transfer_${merchantWallet.walletId}_${dto.idempotencyKey}`;

    // 1. ตรวจสอบ Idempotency ก่อน Lock
    const existingDebitTx = await this.prisma.walletTransaction.findUnique({
      where: { businessRef: debitBusinessRef },
    });

    if (existingDebitTx) {
      this.assertMatchingWithdrawalReplay(
        existingDebitTx,
        userId,
        merchantWallet.walletId,
        dto.amount,
      );
      const existingCreditTx = await this.prisma.walletTransaction.findUnique({
        where: { businessRef: creditBusinessRef },
      });
      return {
        success: true,
        isIdempotentReplay: true,
        withdrawalId: existingDebitTx.walletTransactionId.toString(),
        creditTransactionId:
          existingCreditTx?.walletTransactionId.toString() ?? null,
        transferReference:
          existingDebitTx.transferReference ?? transferReference,
        amount: Number(existingDebitTx.amount),
        merchantBalanceBefore: Number(existingDebitTx.balanceBefore),
        merchantBalanceAfter: Number(existingDebitTx.balanceAfter),
        consumerPersonalBalanceBefore: existingCreditTx
          ? Number(existingCreditTx.balanceBefore)
          : Number(consumerWallet.personalBalance),
        consumerPersonalBalanceAfter: existingCreditTx
          ? Number(existingCreditTx.balanceAfter)
          : Number(consumerWallet.personalBalance),
        createdAt: existingDebitTx.createdAt,
      };
    }

    // 2. ดำเนินการโอนเงินภายใน Database Transaction เดียว (BR-WALLET-06)
    return this.prisma.$transaction(async (tx) => {
      // Lock wallets in deterministic ID order to prevent deadlocks
      const orderedWalletIds = [
        merchantWallet.walletId,
        consumerWallet.walletId,
      ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

      for (const walletIdToLock of orderedWalletIds) {
        await tx.$queryRaw<Array<{ wallet_id: bigint }>>`
          SELECT "wallet_id"
          FROM "wallets"
          WHERE "wallet_id" = ${walletIdToLock}
          FOR UPDATE
        `;
      }

      // ตรวจซ้ำหลัง Lock เพื่อป้องกัน Concurrent Retry
      const debitAfterLock = await tx.walletTransaction.findUnique({
        where: { businessRef: debitBusinessRef },
      });
      if (debitAfterLock) {
        this.assertMatchingWithdrawalReplay(
          debitAfterLock,
          userId,
          merchantWallet.walletId,
          dto.amount,
        );
        const creditAfterLock = await tx.walletTransaction.findUnique({
          where: { businessRef: creditBusinessRef },
        });
        return {
          success: true,
          isIdempotentReplay: true,
          withdrawalId: debitAfterLock.walletTransactionId.toString(),
          creditTransactionId:
            creditAfterLock?.walletTransactionId.toString() ?? null,
          transferReference:
            debitAfterLock.transferReference ?? transferReference,
          amount: Number(debitAfterLock.amount),
          merchantBalanceBefore: Number(debitAfterLock.balanceBefore),
          merchantBalanceAfter: Number(debitAfterLock.balanceAfter),
          consumerPersonalBalanceBefore: creditAfterLock
            ? Number(creditAfterLock.balanceBefore)
            : Number(consumerWallet.personalBalance),
          consumerPersonalBalanceAfter: creditAfterLock
            ? Number(creditAfterLock.balanceAfter)
            : Number(consumerWallet.personalBalance),
          createdAt: debitAfterLock.createdAt,
        };
      }

      const lockedMerchantWallet = await tx.wallet.findUnique({
        where: { walletId: merchantWallet.walletId },
      });
      if (!lockedMerchantWallet) {
        throw new NotFoundException('MERCHANT_WALLET_NOT_FOUND');
      }
      this.assertActiveMerchantWallet(lockedMerchantWallet);

      const lockedConsumerWallet = await tx.wallet.findUnique({
        where: { walletId: consumerWallet.walletId },
      });
      if (!lockedConsumerWallet) {
        throw new NotFoundException('CONSUMER_WALLET_NOT_FOUND');
      }
      this.assertActiveConsumerWallet(lockedConsumerWallet);

      const merchantBefore = new Prisma.Decimal(
        lockedMerchantWallet.merchantBalance,
      );
      if (merchantBefore.lessThan(dto.amount)) {
        throw new BadRequestException('MERCHANT_WALLET_INSUFFICIENT_BALANCE');
      }

      const merchantAfter = merchantBefore.minus(dto.amount);
      const consumerPersonalBefore = new Prisma.Decimal(
        lockedConsumerWallet.personalBalance,
      );
      const consumerPersonalAfter = consumerPersonalBefore.plus(dto.amount);
      const correlationId = randomUUID();
      const now = new Date();

      await tx.wallet.update({
        where: { walletId: lockedMerchantWallet.walletId },
        data: {
          merchantBalance: merchantAfter,
          version: { increment: 1 },
          updatedAt: now,
        },
      });

      await tx.wallet.update({
        where: { walletId: lockedConsumerWallet.walletId },
        data: {
          personalBalance: consumerPersonalAfter,
          version: { increment: 1 },
          updatedAt: now,
        },
      });

      const debitTx = await tx.walletTransaction.create({
        data: {
          walletId: lockedMerchantWallet.walletId,
          initiatedByUserId: userId,
          fundType: FundType.MERCHANT,
          transactionType: TransactionType.MERCHANT_WITHDRAWAL,
          amount: dto.amount,
          balanceBefore: merchantBefore,
          balanceAfter: merchantAfter,
          businessRef: debitBusinessRef,
          transferReference,
          correlationId,
          walletTypeSnapshot: 'MERCHANT',
          metadata: {
            destinationConsumerWalletId:
              lockedConsumerWallet.walletId.toString(),
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });

      const creditTx = await tx.walletTransaction.create({
        data: {
          walletId: lockedConsumerWallet.walletId,
          userId,
          initiatedByUserId: userId,
          fundType: FundType.PERSONAL,
          transactionType: TransactionType.MERCHANT_WITHDRAWAL_CREDIT,
          amount: dto.amount,
          balanceBefore: consumerPersonalBefore,
          balanceAfter: consumerPersonalAfter,
          businessRef: creditBusinessRef,
          transferReference,
          correlationId,
          walletTypeSnapshot: 'CONSUMER',
          metadata: {
            sourceMerchantId: merchant.merchantId.toString(),
            sourceMerchantName: merchant.merchantName,
            sourceMerchantWalletId: lockedMerchantWallet.walletId.toString(),
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });

      return {
        success: true,
        isIdempotentReplay: false,
        withdrawalId: debitTx.walletTransactionId.toString(),
        creditTransactionId: creditTx.walletTransactionId.toString(),
        transferReference,
        amount: dto.amount,
        merchantBalanceBefore: Number(merchantBefore),
        merchantBalanceAfter: Number(merchantAfter),
        consumerPersonalBalanceBefore: Number(consumerPersonalBefore),
        consumerPersonalBalanceAfter: Number(consumerPersonalAfter),
        createdAt: debitTx.createdAt,
      };
    });
  }

  /**
   * FR-M07: ดึงข้อมูล Analytics Dashboard ของร้านค้า
   * แสดง Total Sales, Order Count, Subsidy Received, Personal Payment Received,
   * Coupon Orders, Top-selling Products, Sales Trend และ Data Freshness
   */
  async getMerchantDashboard(
    userId: bigint,
    activeMerchantId: bigint | null,
    days: number = DASHBOARD_TREND_DAYS.DEFAULT,
    page: number = 1,
    pageSize: number = DASHBOARD_TREND_PAGE_LIMITS.DEFAULT,
    requestedMerchantId?: bigint,
  ) {
    const merchantId = this.resolveAuthorizedMerchantId(
      activeMerchantId,
      requestedMerchantId,
    );

    const trendDays = Math.min(
      DASHBOARD_TREND_DAYS.MAX,
      Math.max(
        DASHBOARD_TREND_DAYS.MIN,
        Number.isInteger(days) ? days : DASHBOARD_TREND_DAYS.DEFAULT,
      ),
    );

    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
      select: {
        merchantId: true,
        merchantName: true,
        ownerUserId: true,
        status: true,
      },
    });
    if (!merchant) {
      throw new NotFoundException('MERCHANT_NOT_FOUND');
    }

    const membership = await this.prisma.merchantMember.findFirst({
      where: {
        merchantId,
        userId,
        status: 'ACTIVE',
      },
    });
    if (!membership && merchant.ownerUserId !== userId) {
      throw new ForbiddenException('MERCHANT_ACCESS_DENIED');
    }

    const merchantWallet = await this.getOrCreateMerchantWallet(merchantId);

    const orders = await this.prisma.order.findMany({
      where: { merchantId },
      include: {
        orderItems: {
          include: {
            category: {
              select: { categoryName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const paidOrders = orders.filter(
      (order) => order.status === PAID_ORDER_STATUS,
    );
    const pendingOrders = orders.filter(
      (order) => order.status !== PAID_ORDER_STATUS,
    );

    const zero = new Prisma.Decimal(0);
    const totalSalesDec = paidOrders.reduce(
      (sum, order) => sum.plus(order.finalAmount),
      zero,
    );
    const totalSubtotalDec = paidOrders.reduce(
      (sum, order) => sum.plus(order.subtotal),
      zero,
    );
    const totalDiscountDec = paidOrders.reduce(
      (sum, order) => sum.plus(order.discountAmount),
      zero,
    );
    const subsidyReceivedDec = paidOrders.reduce(
      (sum, order) => sum.plus(order.subsidyAmount),
      zero,
    );
    const personalReceivedDec = paidOrders.reduce(
      (sum, order) => sum.plus(order.userPaidAmount),
      zero,
    );

    const totalSales = Number(totalSalesDec.toDecimalPlaces(2));
    const totalSubtotal = Number(totalSubtotalDec.toDecimalPlaces(2));
    const totalDiscountAmount = Number(totalDiscountDec.toDecimalPlaces(2));
    const subsidyReceived = Number(subsidyReceivedDec.toDecimalPlaces(2));
    const personalPaymentReceived = Number(
      personalReceivedDec.toDecimalPlaces(2),
    );

    const paidCount = paidOrders.length;
    const averageOrderValue =
      paidCount > 0 ? Math.round((totalSales / paidCount) * 100) / 100 : 0;

    const subsidySharePercent =
      totalSales > 0 ? Math.round((subsidyReceived / totalSales) * 100) : 0;
    const personalSharePercent =
      totalSales > 0 ? Math.max(0, 100 - subsidySharePercent) : 0;

    const couponPaidOrders = paidOrders.filter(
      (order) =>
        order.userCouponId !== null ||
        new Prisma.Decimal(order.discountAmount).greaterThan(0),
    );
    const couponOrderCount = couponPaidOrders.length;
    const couponUsageRatePercent =
      paidCount > 0 ? Math.round((couponOrderCount / paidCount) * 100) : 0;

    // Aggregate top-selling products from paid order items
    const productStatsMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        categoryName: string;
        totalQuantity: number;
        totalRevenueDec: Prisma.Decimal;
        orderIds: Set<string>;
      }
    >();

    for (const order of paidOrders) {
      const orderIdStr = order.orderId.toString();
      for (const item of order.orderItems) {
        const key = item.productId.toString();
        const existing = productStatsMap.get(key);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalRevenueDec = existing.totalRevenueDec.plus(
            item.lineTotal,
          );
          existing.orderIds.add(orderIdStr);
        } else {
          productStatsMap.set(key, {
            productId: key,
            productName: item.productNameSnapshot,
            categoryName: item.category.categoryName,
            totalQuantity: item.quantity,
            totalRevenueDec: new Prisma.Decimal(item.lineTotal),
            orderIds: new Set([orderIdStr]),
          });
        }
      }
    }

    const topProducts = [...productStatsMap.values()]
      .map((entry) => ({
        productId: entry.productId,
        productName: entry.productName,
        categoryName: entry.categoryName,
        totalQuantity: entry.totalQuantity,
        totalRevenue: Number(entry.totalRevenueDec.toDecimalPlaces(2)),
        orderCount: entry.orderIds.size,
      }))
      .sort((a, b) =>
        b.totalQuantity !== a.totalQuantity
          ? b.totalQuantity - a.totalQuantity
          : b.totalRevenue - a.totalRevenue,
      )
      .slice(0, 5);

    // Build daily sales trend in Asia/Bangkok timezone
    const now = new Date();
    const { startOfDayUtc: todayStartUtc } = this.getBangkokDayBoundaries(now);
    const dayMs = 24 * 60 * 60 * 1000;

    const trendMap = new Map<
      string,
      {
        date: string;
        totalSalesDec: Prisma.Decimal;
        subsidyDec: Prisma.Decimal;
        personalDec: Prisma.Decimal;
        discountDec: Prisma.Decimal;
        orderCount: number;
      }
    >();

    for (let i = trendDays - 1; i >= 0; i--) {
      const dayUtc = new Date(todayStartUtc.getTime() - i * dayMs);
      const dateKey = this.formatBangkokDateKey(dayUtc);
      trendMap.set(dateKey, {
        date: dateKey,
        totalSalesDec: zero,
        subsidyDec: zero,
        personalDec: zero,
        discountDec: zero,
        orderCount: 0,
      });
    }

    for (const order of paidOrders) {
      const occurredAt = order.paidAt ?? order.createdAt;
      const dateKey = this.formatBangkokDateKey(occurredAt);
      const bucket = trendMap.get(dateKey);
      if (bucket) {
        bucket.totalSalesDec = bucket.totalSalesDec.plus(order.finalAmount);
        bucket.subsidyDec = bucket.subsidyDec.plus(order.subsidyAmount);
        bucket.personalDec = bucket.personalDec.plus(order.userPaidAmount);
        bucket.discountDec = bucket.discountDec.plus(order.discountAmount);
        bucket.orderCount += 1;
      }
    }

    const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const normalizedPageSize =
      Number.isInteger(pageSize) && pageSize > 0
        ? Math.min(DASHBOARD_TREND_PAGE_LIMITS.MAX, pageSize)
        : DASHBOARD_TREND_PAGE_LIMITS.DEFAULT;
    const allSalesTrend = [...trendMap.values()]
      .map((bucket) => ({
        date: bucket.date,
        totalSales: Number(bucket.totalSalesDec.toDecimalPlaces(2)),
        subsidyAmount: Number(bucket.subsidyDec.toDecimalPlaces(2)),
        personalAmount: Number(bucket.personalDec.toDecimalPlaces(2)),
        discountAmount: Number(bucket.discountDec.toDecimalPlaces(2)),
        orderCount: bucket.orderCount,
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
    const totalTrendItems = allSalesTrend.length;
    const totalTrendPages = Math.max(
      1,
      Math.ceil(totalTrendItems / normalizedPageSize),
    );
    const resolvedPage = Math.min(normalizedPage, totalTrendPages);
    const salesTrend = allSalesTrend.slice(
      (resolvedPage - 1) * normalizedPageSize,
      resolvedPage * normalizedPageSize,
    );

    return {
      merchant: {
        merchantId: merchant.merchantId.toString(),
        merchantName: merchant.merchantName,
        status: merchant.status,
        merchantBalance: Number(merchantWallet.merchantBalance),
      },
      summary: {
        totalSales,
        totalSubtotal,
        totalDiscountAmount,
        orderCount: {
          paid: paidCount,
          pending: pendingOrders.length,
          total: orders.length,
          averageOrderValue,
        },
        subsidyReceived,
        personalPaymentReceived,
        subsidySharePercent,
        personalSharePercent,
        couponOrders: {
          count: couponOrderCount,
          totalDiscount: totalDiscountAmount,
          usageRatePercent: couponUsageRatePercent,
        },
      },
      topProducts,
      salesTrend,
      salesTrendPagination: {
        page: resolvedPage,
        pageSize: normalizedPageSize,
        totalItems: totalTrendItems,
        totalPages: totalTrendPages,
      },
      dataFreshness: {
        asOf: now.toISOString(),
        timezone: BANGKOK_TIMEZONE,
        trendDays,
      },
    };
  }
}
