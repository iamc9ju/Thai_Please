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
      $queryRaw: vi.fn().mockResolvedValue([]),
      coupon: {
        findUnique: vi.fn(),
      },
      userCoupon: {
        create: vi.fn(),
      },
      pointTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ pointTransactionId: 1n }),
      },
      user: {
        update: vi.fn().mockResolvedValue({ pointBalance: 0 }),
      },
    };

    const prisma = {
      user: {
        findUnique: vi.fn(),
      },
      pointTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      coupon: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      userCoupon: {
        findMany: vi.fn().mockResolvedValue([]),
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

  describe('Point Expiry Sweeper & Real-time Expiration (BR-POINT-02)', () => {
    it('expires overdue points using FIFO by expiry and records EXPIRED transaction', async () => {
      const prisma = createMockPrisma();
      const now = new Date('2026-10-30T10:00:00Z');
      const expiredDate1 = new Date('2026-09-01T00:00:00Z');
      const expiredDate2 = new Date('2026-10-01T00:00:00Z');
      const futureDate = new Date('2026-12-01T00:00:00Z');

      prisma.tx.$queryRaw.mockResolvedValue([
        { user_id: 100n, point_balance: 100 },
      ]);
      prisma.tx.pointTransaction.findMany.mockResolvedValue([
        {
          pointTransactionId: 1n,
          userId: 100n,
          points: 40,
          expiresAt: expiredDate1,
          createdAt: new Date('2025-09-01T00:00:00Z'),
        },
        {
          pointTransactionId: 2n,
          userId: 100n,
          points: 30,
          expiresAt: expiredDate2,
          createdAt: new Date('2025-10-01T00:00:00Z'),
        },
        {
          pointTransactionId: 3n,
          userId: 100n,
          points: 50,
          expiresAt: futureDate,
          createdAt: new Date('2025-12-01T00:00:00Z'),
        },
        // Prior coupon redemption of 20 points consumed part of first lot
        {
          pointTransactionId: 4n,
          userId: 100n,
          points: -20,
          expiresAt: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const service = new RewardsService(prisma as unknown as PrismaService);
      const expiredCount = await service.expireUserPoints(100n, now);

      // Lot 1: 40 - 20 (prior) = 20 overdue points
      // Lot 2: 30 overdue points
      // Total overdue = 50 points
      expect(expiredCount).toBe(50);
      expect(prisma.tx.pointTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: 100n,
          transactionType: 'EXPIRED',
          points: -50,
          createdAt: now,
        },
      });
      expect(prisma.tx.user.update).toHaveBeenCalledWith({
        where: { userId: 100n },
        data: {
          pointBalance: { decrement: 50 },
          updatedAt: now,
        },
      });
    });

    it('does not expire points if all lots are still in the future', async () => {
      const prisma = createMockPrisma();
      const now = new Date('2026-10-30T10:00:00Z');
      const futureDate = new Date('2026-11-30T10:00:00Z');

      prisma.tx.$queryRaw.mockResolvedValue([
        { user_id: 100n, point_balance: 100 },
      ]);
      prisma.tx.pointTransaction.findMany.mockResolvedValue([
        {
          pointTransactionId: 1n,
          userId: 100n,
          points: 100,
          expiresAt: futureDate,
          createdAt: new Date('2025-11-30T10:00:00Z'),
        },
      ]);

      const service = new RewardsService(prisma as unknown as PrismaService);
      const expiredCount = await service.expireUserPoints(100n, now);

      expect(expiredCount).toBe(0);
      expect(prisma.tx.pointTransaction.create).not.toHaveBeenCalled();
      expect(prisma.tx.user.update).not.toHaveBeenCalled();
    });

    it('sweeps all candidate users with overdue point transactions', async () => {
      const prisma = createMockPrisma();
      const now = new Date();

      prisma.pointTransaction.findMany.mockResolvedValue([
        { userId: 101n },
        { userId: 102n },
      ]);

      const service = new RewardsService(prisma as unknown as PrismaService);
      const expireSpy = vi
        .spyOn(service, 'expireUserPoints')
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(0);

      const result = await service.sweepExpiredPoints(now);

      expect(prisma.pointTransaction.findMany).toHaveBeenCalledWith({
        where: {
          points: { gt: 0 },
          expiresAt: { lte: now },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      expect(expireSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ sweptUsersCount: 1, totalPointsExpired: 30 });
    });

    it('auto-expires points during coupon redemption and rejects if remaining points are insufficient', async () => {
      const prisma = createMockPrisma();

      // User has 100 balance in DB, but 60 points are overdue
      prisma.tx.$queryRaw.mockResolvedValue([
        { user_id: 100n, point_balance: 100, status: 'ACTIVE' },
      ]);
      prisma.tx.coupon.findUnique.mockResolvedValue({
        couponId: 1n,
        merchantId: null,
        couponName: 'ส่วนลด 20 บาท',
        description: null,
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(20),
        pointCost: 50, // requires 50, but after 60 expired, user only has 40
        minPurchase: new Prisma.Decimal(150),
        validityDays: 14,
        status: 'ACTIVE',
        merchant: null,
      });

      const service = new RewardsService(prisma as unknown as PrismaService);
      vi.spyOn(service, 'expireUserPointsInternal').mockResolvedValue(60);

      await expect(service.redeemCoupon(100n, 1n)).rejects.toThrow(
        'พอยต์สะสมไม่เพียงพอสำหรับการแลกคูปองนี้',
      );
      expect(prisma.tx.userCoupon.create).not.toHaveBeenCalled();
    });
  });
});
