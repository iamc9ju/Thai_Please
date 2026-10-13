import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BANGKOK_TZ_OFFSET_HOURS,
  FundType,
  TransactionType,
} from './wallet.constants.js';
import type { TopUpDto } from './dto/top-up.dto.js';

const RECENT_PAID_ORDER_LIMIT = 5;
const PAID_ORDER_STATUS = 'PAID';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * FR-C02: เติมเงินจำลองเข้ากระเป๋าส่วนตัว (Virtual Top-up)
   * ปฏิบัติตาม BR-WALLET-003: Idempotent และสร้าง Ledger Entry ใน Transaction เดียว
   */
  async topUpPersonal(userId: bigint, dto: TopUpDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('จำนวนเงินต้องมากกว่า 0');
    }

    const wallet = await this.getOrCreateConsumerWallet(userId);
    const businessRef = `topup_${wallet.walletId}_${dto.idempotencyKey}`;

    // 1. ตรวจสอบ Idempotency
    const existingTx = await this.prisma.walletTransaction.findUnique({
      where: { businessRef },
    });

    if (existingTx) {
      this.logger.log(`Idempotent top-up hit for businessRef: ${businessRef}`);
      const currentWallet = await this.prisma.wallet.findUnique({
        where: { walletId: wallet.walletId },
      });
      return {
        success: true,
        isIdempotentReplay: true,
        transactionId: existingTx.walletTransactionId.toString(),
        amount: Number(existingTx.amount),
        personalBalance: currentWallet
          ? Number(currentWallet.personalBalance)
          : 0,
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

      // ตรวจซ้ำหลัง lock เพื่อให้ concurrent retry คืนผลเดิมโดยไม่เพิ่มยอดซ้ำ
      const transactionAfterLock = await tx.walletTransaction.findUnique({
        where: { businessRef },
      });
      if (transactionAfterLock) {
        const replayWallet = await tx.wallet.findUnique({
          where: { walletId: wallet.walletId },
        });
        return {
          success: true,
          isIdempotentReplay: true,
          transactionId: transactionAfterLock.walletTransactionId.toString(),
          amount: Number(transactionAfterLock.amount),
          personalBalance: replayWallet
            ? Number(replayWallet.personalBalance)
            : 0,
          createdAt: transactionAfterLock.createdAt,
        };
      }

      const lockedWallet = await tx.wallet.findUnique({
        where: { walletId: wallet.walletId },
      });

      if (!lockedWallet || lockedWallet.status !== 'ACTIVE') {
        throw new ConflictException('กระเป๋าเงินไม่อยู่ในสถานะที่ใช้งานได้');
      }

      const balanceBefore = Number(lockedWallet.personalBalance);
      const balanceAfter = balanceBefore + dto.amount;

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
          transactionType: TransactionType.TOPUP,
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
