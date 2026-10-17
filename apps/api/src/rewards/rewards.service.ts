import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-C08: ดูยอดพอยต์ แหล่งที่มา วันหมดอายุ และประวัติพอยต์ของ Consumer
   */
  async getConsumerPoints(userId: bigint) {
    const now = new Date();
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
