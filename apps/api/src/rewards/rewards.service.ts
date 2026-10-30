import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_WINDOW_DAYS = 30;
const POINT_HISTORY_LIMIT = 50;
const OWNED_COUPONS_LIMIT = 50;

const TRANSACTION_OPTIONS: {
  isolationLevel: Prisma.TransactionIsolationLevel;
  maxWait: number;
  timeout: number;
} = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
};

@Injectable()
export class RewardsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RewardsService.name);
  private sweepTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.sweepTimer = setInterval(() => {
      this.sweepExpiredPoints().catch((err) => {
        this.logger.error('Failed to sweep expired points', err);
      });
    }, 60_000);
    this.sweepTimer.unref();
    this.sweepExpiredPoints().catch(() => {});
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  /**
   * BR-POINT-02: ตรวจสอบและตัดแต้มที่หมดอายุของ User ตาม FIFO by Expiry
   */
  async expireUserPoints(userId: bigint, now = new Date()): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      return this.expireUserPointsInternal(userId, now, tx);
    }, TRANSACTION_OPTIONS);
  }

  async expireUserPointsInternal(
    userId: bigint,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const lockedUsers = await tx.$queryRaw<
      Array<{ user_id: bigint; point_balance: number }>
    >`
      SELECT "user_id", "point_balance"
      FROM "users"
      WHERE "user_id" = ${userId}
      FOR UPDATE
    `;
    const user = lockedUsers[0];
    if (!user || user.point_balance <= 0) {
      return 0;
    }

    const transactions = await tx.pointTransaction.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { pointTransactionId: 'asc' }],
    });

    const positiveLots = transactions
      .filter((t) => t.points > 0)
      .sort((a, b) => {
        const aExp = a.expiresAt?.getTime() ?? Infinity;
        const bExp = b.expiresAt?.getTime() ?? Infinity;
        return aExp - bExp;
      });

    let totalDeducted = transactions
      .filter((t) => t.points < 0)
      .reduce((sum, t) => sum + Math.abs(t.points), 0);

    let expiredUnconsumed = 0;
    for (const lot of positiveLots) {
      const lotPoints = lot.points;
      if (totalDeducted >= lotPoints) {
        totalDeducted -= lotPoints;
        continue;
      }

      const remainingInLot = lotPoints - totalDeducted;
      totalDeducted = 0;

      if (lot.expiresAt && lot.expiresAt <= now) {
        expiredUnconsumed += remainingInLot;
      }
    }

    const pointsToExpire = Math.min(user.point_balance, expiredUnconsumed);
    if (pointsToExpire <= 0) {
      return 0;
    }

    await tx.pointTransaction.create({
      data: {
        userId,
        transactionType: 'EXPIRED',
        points: -pointsToExpire,
        createdAt: now,
      },
    });

    await tx.user.update({
      where: { userId },
      data: {
        pointBalance: { decrement: pointsToExpire },
        updatedAt: now,
      },
    });

    return pointsToExpire;
  }

  /**
   * BR-POINT-02: กวาดล้างพอยต์ที่หมดอายุของผู้ใช้งานทุกคน
   */
  async sweepExpiredPoints(
    now = new Date(),
  ): Promise<{ sweptUsersCount: number; totalPointsExpired: number }> {
    const candidateUsers = await this.prisma.pointTransaction.findMany({
      where: {
        points: { gt: 0 },
        expiresAt: { lte: now },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    let sweptUsersCount = 0;
    let totalPointsExpired = 0;

    for (const { userId } of candidateUsers) {
      try {
        const expired = await this.expireUserPoints(userId, now);
        if (expired > 0) {
          sweptUsersCount++;
          totalPointsExpired += expired;
        }
      } catch (err) {
        this.logger.error(
          `Failed to expire points for user ${userId.toString()}`,
          err,
        );
      }
    }

    if (totalPointsExpired > 0) {
      this.logger.log(
        `Swept ${totalPointsExpired} expired points for ${sweptUsersCount} users`,
      );
    }

    return { sweptUsersCount, totalPointsExpired };
  }

  /**
   * FR-C08: ดูยอดพอยต์ แหล่งที่มา วันหมดอายุ และประวัติพอยต์ของ Consumer
   */
  async getConsumerPoints(userId: bigint) {
    const now = new Date();

    try {
      await this.expireUserPoints(userId, now);
    } catch (err) {
      this.logger.error(
        `Error auto-expiring points for user ${userId.toString()}`,
        err,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { pointBalance: true },
    });

    if (!user) {
      throw new NotFoundException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      include: {
        userQuest: {
          include: {
            quest: {
              select: { questName: true },
            },
          },
        },
        userCoupon: {
          include: {
            coupon: {
              select: { couponName: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { pointTransactionId: 'desc' }],
      take: POINT_HISTORY_LIMIT,
    });

    const expiringWindowEnd = new Date(
      now.getTime() + EXPIRING_SOON_WINDOW_DAYS * DAY_MS,
    );

    const activePositiveLots = transactions
      .filter(
        (tx) =>
          tx.points > 0 &&
          tx.expiresAt !== null &&
          tx.expiresAt > now &&
          tx.expiresAt <= expiringWindowEnd,
      )
      .sort(
        (a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0),
      );

    const totalExpiringPositive = activePositiveLots.reduce(
      (sum, tx) => sum + tx.points,
      0,
    );
    const expiringPoints = Math.min(user.pointBalance, totalExpiringPositive);
    const nearestExpiryAt =
      expiringPoints > 0 && activePositiveLots[0]?.expiresAt
        ? activePositiveLots[0].expiresAt.toISOString()
        : null;

    return {
      pointBalance: user.pointBalance,
      expiringPoints,
      nearestExpiryAt,
      items: transactions.map((tx) => ({
        pointTransactionId: tx.pointTransactionId.toString(),
        transactionType: tx.transactionType,
        points: tx.points,
        sourceName:
          tx.userQuest?.quest.questName ??
          tx.userCoupon?.coupon.couponName ??
          null,
        userQuestId: tx.userQuestId?.toString() ?? null,
        completedOrderId: tx.userQuest?.completedOrderId?.toString() ?? null,
        userCouponId: tx.userCouponId?.toString() ?? null,
        expiresAt: tx.expiresAt?.toISOString() ?? null,
        createdAt: tx.createdAt.toISOString(),
      })),
    };
  }

  /**
   * FR-C09: ดูรายการคูปองที่เปิดให้แลก (Catalogue) และคูปองของฉัน (Owned Coupons)
   */
  async getConsumerCoupons(userId: bigint) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { pointBalance: true },
    });

    if (!user) {
      throw new NotFoundException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    const [catalogueRows, ownedRows] = await Promise.all([
      this.prisma.coupon.findMany({
        where: { status: 'ACTIVE' },
        include: {
          merchant: {
            select: { merchantId: true, merchantName: true },
          },
        },
        orderBy: [{ pointCost: 'asc' }, { couponId: 'asc' }],
      }),
      this.prisma.userCoupon.findMany({
        where: { userId },
        include: {
          coupon: {
            include: {
              merchant: {
                select: { merchantId: true, merchantName: true },
              },
            },
          },
        },
        orderBy: [{ redeemedAt: 'desc' }, { userCouponId: 'desc' }],
        take: OWNED_COUPONS_LIMIT,
      }),
    ]);

    return {
      pointBalance: user.pointBalance,
      catalogue: catalogueRows.map((c) => ({
        couponId: c.couponId.toString(),
        couponName: c.couponName,
        description: c.description ?? null,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        minPurchase: Number(c.minPurchase),
        pointCost: c.pointCost,
        validityDays: c.validityDays,
        merchantId: c.merchantId?.toString() ?? null,
        merchantName: c.merchant?.merchantName ?? null,
        canRedeem: user.pointBalance >= c.pointCost,
      })),
      ownedCoupons: ownedRows.map((uc) => {
        const effectiveStatus =
          uc.status === 'AVAILABLE' && uc.expiresAt <= now
            ? 'EXPIRED'
            : uc.status;
        return {
          userCouponId: uc.userCouponId.toString(),
          couponId: uc.couponId.toString(),
          couponName: uc.coupon.couponName,
          description: uc.coupon.description ?? null,
          discountType: uc.coupon.discountType,
          discountValue: Number(uc.coupon.discountValue),
          minPurchase: Number(uc.coupon.minPurchase),
          pointCost: uc.coupon.pointCost,
          merchantId: uc.coupon.merchantId?.toString() ?? null,
          merchantName: uc.coupon.merchant?.merchantName ?? null,
          status: effectiveStatus,
          redeemedAt: uc.redeemedAt.toISOString(),
          expiresAt: uc.expiresAt.toISOString(),
          usedAt: uc.usedAt?.toISOString() ?? null,
          usedOrderId: uc.usedOrderId?.toString() ?? null,
        };
      }),
    };
  }

  /**
   * FR-C09 & BR-COUPON-01: แลกพอยต์เป็นคูปองส่วนลดแบบ Atomic Transaction
   */
  async redeemCoupon(userId: bigint, couponId: bigint) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock user row FOR UPDATE
      const lockedUsers = await tx.$queryRaw<
        Array<{ user_id: bigint; point_balance: number; status: string }>
      >`
        SELECT "user_id", "point_balance", "status"
        FROM "users"
        WHERE "user_id" = ${userId}
        FOR UPDATE
      `;

      const lockedUser = lockedUsers[0];
      if (!lockedUser) {
        throw new NotFoundException('ไม่พบข้อมูลผู้ใช้งาน');
      }
      if (lockedUser.status !== 'ACTIVE') {
        throw new ConflictException('บัญชีผู้ใช้งานไม่พร้อมทำรายการ');
      }

      // Expire any overdue points for this user inside this transaction before balance check
      const expiredCount = await this.expireUserPointsInternal(userId, now, tx);
      if (expiredCount > 0) {
        lockedUser.point_balance -= expiredCount;
      }

      // 2. Fetch and validate coupon
      const coupon = await tx.coupon.findUnique({
        where: { couponId },
        include: {
          merchant: {
            select: { merchantId: true, merchantName: true, status: true },
          },
        },
      });

      if (!coupon) {
        throw new NotFoundException('ไม่พบคูปองที่ต้องการแลก');
      }
      if (coupon.status !== 'ACTIVE') {
        throw new BadRequestException('คูปองนี้ปิดการแลกแล้ว');
      }
      if (coupon.merchant && coupon.merchant.status !== 'ACTIVE') {
        throw new BadRequestException('ร้านค้าของคูปองนี้ไม่พร้อมให้บริการ');
      }
      if (coupon.pointCost <= 0) {
        throw new BadRequestException('จำนวนพอยต์ของคูปองไม่ถูกต้อง');
      }

      // 3. Verify point balance
      if (lockedUser.point_balance < coupon.pointCost) {
        throw new BadRequestException(
          'พอยต์สะสมไม่เพียงพอสำหรับการแลกคูปองนี้',
        );
      }

      // 4. Create UserCoupon
      const expiresAt = new Date(now.getTime() + coupon.validityDays * DAY_MS);
      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId: coupon.couponId,
          status: 'AVAILABLE',
          redeemedAt: now,
          expiresAt,
        },
      });

      // 5. Create negative PointTransaction ledger entry
      const pointTx = await tx.pointTransaction.create({
        data: {
          userId,
          userCouponId: userCoupon.userCouponId,
          transactionType: 'COUPON_REDEEM',
          points: -coupon.pointCost,
          createdAt: now,
        },
      });

      // 6. Decrement User.pointBalance atomically
      const updatedUser = await tx.user.update({
        where: { userId },
        data: {
          pointBalance: { decrement: coupon.pointCost },
          updatedAt: now,
        },
        select: { pointBalance: true },
      });

      return {
        success: true,
        pointBalance: updatedUser.pointBalance,
        pointTransactionId: pointTx.pointTransactionId.toString(),
        pointsDeducted: coupon.pointCost,
        userCoupon: {
          userCouponId: userCoupon.userCouponId.toString(),
          couponId: coupon.couponId.toString(),
          couponName: coupon.couponName,
          description: coupon.description ?? null,
          discountType: coupon.discountType,
          discountValue: Number(coupon.discountValue),
          minPurchase: Number(coupon.minPurchase),
          pointCost: coupon.pointCost,
          merchantId: coupon.merchantId?.toString() ?? null,
          merchantName: coupon.merchant?.merchantName ?? null,
          status: userCoupon.status,
          redeemedAt: userCoupon.redeemedAt.toISOString(),
          expiresAt: userCoupon.expiresAt.toISOString(),
          usedAt: null,
          usedOrderId: null,
        },
      };
    }, TRANSACTION_OPTIONS);
  }
}
