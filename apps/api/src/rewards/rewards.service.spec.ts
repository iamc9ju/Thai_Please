import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RewardsService } from './rewards.service.js';

describe('RewardsService (FR-C08, FR-C09)', () => {
  function createMockPrisma() {
    const tx = {
      $queryRaw: vi.fn(),
      coupon: {
        findUnique: vi.fn(),
      },
      userCoupon: {
        create: vi.fn(),
      },
      pointTransaction: {
        create: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    const prisma = {
      user: {
        findUnique: vi.fn(),
      },
      pointTransaction: {
        findMany: vi.fn(),
      },
      coupon: {
        findMany: vi.fn(),
      },
      userCoupon: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      tx,
    };

    return prisma;
  }

  it('returns consumer point balance, expiring summary, and point transaction history (FR-C08)', async () => {
    const prisma = createMockPrisma();
    const now = new Date();
    const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    prisma.user.findUnique.mockResolvedValue({ pointBalance: 150 });
    prisma.pointTransaction.findMany.mockResolvedValue([
      {
        pointTransactionId: 11n,
        userId: 100n,
        userQuestId: 5n,
        userCouponId: null,
        transactionType: 'QUEST_REWARD',
        points: 50,
        expiresAt: inTenDays,
        createdAt: now,
        userQuest: {
          completedOrderId: 99n,
          quest: { questName: 'อุดหนุนร้านอาหารชุมชน' },
        },
        userCoupon: null,
      },
      {
        pointTransactionId: 10n,
        userId: 100n,
        userQuestId: null,
        userCouponId: 3n,
        transactionType: 'COUPON_REDEEM',
        points: -100,
        expiresAt: null,
        createdAt: now,
        userQuest: null,
        userCoupon: {
          coupon: { couponName: 'ส่วนลด 20 บาท' },
        },
      },
    ]);

    const service = new RewardsService(prisma as unknown as PrismaService);
    const result = await service.getConsumerPoints(100n);

    expect(result.pointBalance).toBe(150);
    expect(result.expiringPoints).toBe(50);
    expect(result.nearestExpiryAt).toBe(inTenDays.toISOString());
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      pointTransactionId: '11',
      transactionType: 'QUEST_REWARD',
      points: 50,
      sourceName: 'อุดหนุนร้านอาหารชุมชน',
      completedOrderId: '99',
    });
    expect(result.items[1]).toMatchObject({
      pointTransactionId: '10',
      transactionType: 'COUPON_REDEEM',
      points: -100,
      sourceName: 'ส่วนลด 20 บาท',
    });
  });

  it('returns active coupon catalogue and consumer owned coupons with expiry evaluation (FR-C09)', async () => {
    const prisma = createMockPrisma();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    prisma.user.findUnique.mockResolvedValue({ pointBalance: 120 });
    prisma.coupon.findMany.mockResolvedValue([
      {
        couponId: 1n,
        merchantId: null,
        couponName: 'ส่วนลด 20 บาท',
        description: 'ใช้ได้ทุกร้าน',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(20),
        pointCost: 100,
        minPurchase: new Prisma.Decimal(150),
        validityDays: 14,
        status: 'ACTIVE',
        merchant: null,
      },
      {
        couponId: 2n,
        merchantId: 5n,
        couponName: 'ส่วนลด 50 บาท',
        description: 'เฉพาะร้านที่ร่วมรายการ',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(50),
        pointCost: 250,
        minPurchase: new Prisma.Decimal(300),
        validityDays: 30,
        status: 'ACTIVE',
        merchant: { merchantId: 5n, merchantName: 'ร้านครัวบ้านเรา' },
      },
    ]);
    prisma.userCoupon.findMany.mockResolvedValue([
      {
        userCouponId: 20n,
        userId: 100n,
        couponId: 1n,
        status: 'AVAILABLE',
        redeemedAt: pastDate,
        expiresAt: futureDate,
        usedAt: null,
        usedOrderId: null,
        coupon: {
          couponId: 1n,
          merchantId: null,
          couponName: 'ส่วนลด 20 บาท',
          description: 'ใช้ได้ทุกร้าน',
          discountType: 'FIXED',
          discountValue: new Prisma.Decimal(20),
          pointCost: 100,
          minPurchase: new Prisma.Decimal(150),
          merchant: null,
        },
      },
      {
        userCouponId: 19n,
        userId: 100n,
        couponId: 1n,
        status: 'AVAILABLE',
        redeemedAt: pastDate,
        expiresAt: pastDate,
        usedAt: null,
        usedOrderId: null,
        coupon: {
          couponId: 1n,
          merchantId: null,
          couponName: 'ส่วนลด 20 บาท',
          description: 'ใช้ได้ทุกร้าน',
          discountType: 'FIXED',
          discountValue: new Prisma.Decimal(20),
          pointCost: 100,
          minPurchase: new Prisma.Decimal(150),
          merchant: null,
        },
      },
    ]);

    const service = new RewardsService(prisma as unknown as PrismaService);
    const result = await service.getConsumerCoupons(100n);

    expect(result.pointBalance).toBe(120);
    expect(result.catalogue[0]?.canRedeem).toBe(true);
    expect(result.catalogue[1]?.canRedeem).toBe(false);
    expect(result.ownedCoupons[0]?.status).toBe('AVAILABLE');
    expect(result.ownedCoupons[1]?.status).toBe('EXPIRED');
  });

  it('redeems a coupon atomically by locking user, deducting points, and creating ledger & userCoupon (FR-C09)', async () => {
    const prisma = createMockPrisma();
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    prisma.tx.$queryRaw.mockResolvedValue([
      { user_id: 100n, point_balance: 200, status: 'ACTIVE' },
    ]);
    prisma.tx.coupon.findUnique.mockResolvedValue({
      couponId: 1n,
      merchantId: null,
      couponName: 'ส่วนลด 20 บาท',
      description: 'เมื่อซื้อครบ 150 บาท',
      discountType: 'FIXED',
      discountValue: new Prisma.Decimal(20),
      pointCost: 100,
      minPurchase: new Prisma.Decimal(150),
      validityDays: 14,
      status: 'ACTIVE',
      merchant: null,
    });
    prisma.tx.userCoupon.create.mockResolvedValue({
      userCouponId: 55n,
      userId: 100n,
      couponId: 1n,
      status: 'AVAILABLE',
      redeemedAt: now,
      expiresAt: expires,
    });
    prisma.tx.pointTransaction.create.mockResolvedValue({
      pointTransactionId: 88n,
    });
    prisma.tx.user.update.mockResolvedValue({
      pointBalance: 100,
    });

    const service = new RewardsService(prisma as unknown as PrismaService);
    const result = await service.redeemCoupon(100n, 1n);

    expect(result.success).toBe(true);
    expect(result.pointBalance).toBe(100);
    expect(result.pointsDeducted).toBe(100);
    expect(result.userCoupon.userCouponId).toBe('55');
    expect(prisma.tx.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 100n,
          userCouponId: 55n,
          transactionType: 'COUPON_REDEEM',
          points: -100,
        }),
      }),
    );
  });

  it('rejects coupon redemption when consumer point balance is insufficient', async () => {
    const prisma = createMockPrisma();
    prisma.tx.$queryRaw.mockResolvedValue([
      { user_id: 100n, point_balance: 50, status: 'ACTIVE' },
    ]);
    prisma.tx.coupon.findUnique.mockResolvedValue({
      couponId: 1n,
      merchantId: null,
      couponName: 'ส่วนลด 20 บาท',
      description: null,
      discountType: 'FIXED',
      discountValue: new Prisma.Decimal(20),
      pointCost: 100,
      minPurchase: new Prisma.Decimal(150),
      validityDays: 14,
      status: 'ACTIVE',
      merchant: null,
    });

    const service = new RewardsService(prisma as unknown as PrismaService);
    await expect(service.redeemCoupon(100n, 1n)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tx.userCoupon.create).not.toHaveBeenCalled();
    expect(prisma.tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects redemption when coupon is not found or user is inactive', async () => {
    const prisma = createMockPrisma();
    prisma.tx.$queryRaw.mockResolvedValue([
      { user_id: 100n, point_balance: 500, status: 'SUSPENDED' },
    ]);

    const service = new RewardsService(prisma as unknown as PrismaService);
    await expect(service.redeemCoupon(100n, 1n)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.tx.$queryRaw.mockResolvedValue([
      { user_id: 100n, point_balance: 500, status: 'ACTIVE' },
    ]);
    prisma.tx.coupon.findUnique.mockResolvedValue(null);

    await expect(service.redeemCoupon(100n, 999n)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
