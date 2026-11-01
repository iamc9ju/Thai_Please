import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminService } from './admin.service.js';
import type { QuestsService } from '../quests/quests.service.js';

describe('AdminService (FR-A01 through FR-A07, FR-M01, FR-S04)', () => {
  let service: AdminService;
  let proposals: { generate: ReturnType<typeof vi.fn> };
  let prismaMock: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    merchant: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    order: {
      findMany: ReturnType<typeof vi.fn>;
    };
    pointTransaction: {
      findMany: ReturnType<typeof vi.fn>;
    };
    coupon: {
      count: ReturnType<typeof vi.fn>;
    };
    userCoupon: {
      findMany: ReturnType<typeof vi.fn>;
    };
    quest: {
      count: ReturnType<typeof vi.fn>;
    };
    userQuest: {
      findMany: ReturnType<typeof vi.fn>;
    };
    subsidyProgram: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    userRole: {
      upsert: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    wallet: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    authSession: {
      updateMany: ReturnType<typeof vi.fn>;
    };
    questGenerationLog: {
      findMany: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
    auditEvent: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      merchant: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
      },
      pointTransaction: {
        findMany: vi.fn(),
      },
      coupon: {
        count: vi.fn(),
      },
      userCoupon: {
        findMany: vi.fn(),
      },
      quest: {
        count: vi.fn(),
      },
      userQuest: {
        findMany: vi.fn(),
      },
      subsidyProgram: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      userRole: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      wallet: {
        create: vi.fn(),
        update: vi.fn(),
      },
      authSession: {
        updateMany: vi.fn(),
      },
      questGenerationLog: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: 'ae_test' }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback(prismaMock),
      ),
    };

    proposals = { generate: vi.fn() };
    service = new AdminService(
      prismaMock as unknown as PrismaService,
      proposals as unknown as QuestsService,
    );
  });

  it('FR-C07 queues proposals through the authoritative quest service without assigning or inventing rewards', async () => {
    const key = '541c432e-94e6-4a46-bda4-da5dd0864b71';
    const result = {
      requestKey: key,
      status: 'PENDING',
      assignmentId: null,
      reason: null,
    };
    proposals.generate.mockResolvedValue(result);
    await expect(
      service.generatePersonalizedQuestForConsumer(3n, 1n, key),
    ).resolves.toEqual(result);
    expect(proposals.generate).toHaveBeenCalledWith(3n, 1n, key);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(['not-a-uuid', '541c432e-94e6-1a46-bda4-da5dd0864b71'])(
    'rejects unsupported generation idempotency key %s',
    async (key) => {
      await expect(
        service.generatePersonalizedQuestForConsumer(3n, 1n, key),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(proposals.generate).not.toHaveBeenCalled();
    },
  );

  it('FR-M01: lists merchant categories from assignments without legacy columns', async () => {
    prismaMock.merchant.findMany.mockResolvedValue([
      {
        merchantId: 10n,
        merchantName: 'Test merchant',
        status: 'PENDING',
        categoryAssignments: [
          {
            category: {
              categoryCode: 'FOOD_BEVERAGE',
              sortOrder: 1,
            },
          },
        ],
        owner: {
          userId: 1n,
          fullName: 'Owner',
          citizenId: '1234567890123',
          phone: null,
        },
        wallet: null,
        products: [],
        orders: [],
        createdAt: new Date('2026-10-30T00:00:00Z'),
        updatedAt: new Date('2026-10-30T00:00:00Z'),
      },
    ]);
    const result = await service.listMerchants();
    expect(
      prismaMock.merchant.findMany.mock.calls[0]?.[0].include,
    ).not.toHaveProperty('merchant_category_assignments');
    expect(result.items[0]).toMatchObject({
      merchantTypes: ['FOOD_BEVERAGE'],
    });
    expect(prismaMock.merchant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          categoryAssignments: {
            select: { category: { select: { categoryCode: true } } },
            orderBy: { category: { sortOrder: 'asc' } },
          },
        }),
      }),
    );
  });

  describe('getPlatformOverview (FR-A01)', () => {
    it('aggregates platform users, merchants, orders, points, coupons, quests, and active program', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          userId: 1n,
          status: 'ACTIVE',
          role: 'CONSUMER',
          pointBalance: 120,
          roles: [{ role: 'CONSUMER', status: 'ACTIVE' }],
        },
        {
          userId: 2n,
          status: 'ACTIVE',
          role: 'MERCHANT',
          pointBalance: 50,
          roles: [
            { role: 'MERCHANT', status: 'ACTIVE' },
            { role: 'ADMIN', status: 'ACTIVE' },
          ],
        },
      ]);
      prismaMock.merchant.findMany.mockResolvedValue([
        { merchantId: 10n, status: 'ACTIVE' },
        { merchantId: 11n, status: 'PENDING' },
      ]);
      prismaMock.order.findMany.mockResolvedValue([
        {
          status: 'PAID',
          finalAmount: new Prisma.Decimal(200),
          subsidyAmount: new Prisma.Decimal(100),
          userPaidAmount: new Prisma.Decimal(100),
          discountAmount: new Prisma.Decimal(20),
        },
        {
          status: 'PENDING',
          finalAmount: new Prisma.Decimal(80),
          subsidyAmount: new Prisma.Decimal(40),
          userPaidAmount: new Prisma.Decimal(40),
          discountAmount: new Prisma.Decimal(0),
        },
      ]);
      prismaMock.pointTransaction.findMany.mockResolvedValue([
        { transactionType: 'QUEST_REWARD', points: 220 },
        { transactionType: 'COUPON_REDEEM', points: -50 },
      ]);
      prismaMock.coupon.count.mockResolvedValue(5);
      prismaMock.userCoupon.findMany.mockResolvedValue([
        { status: 'USED', expiresAt: new Date('2026-12-31T00:00:00.000Z') },
        {
          status: 'AVAILABLE',
          expiresAt: new Date('2099-12-31T00:00:00.000Z'),
        },
      ]);
      prismaMock.quest.count.mockResolvedValue(3);
      prismaMock.userQuest.findMany.mockResolvedValue([
        {
          status: 'COMPLETED',
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
        { status: 'ACTIVE', expiresAt: new Date('2099-12-31T00:00:00.000Z') },
      ]);
      prismaMock.subsidyProgram.findFirst.mockResolvedValue({
        programId: 1n,
        programName: 'โครงการไทยช่วยไทยพลีส (ระยะที่ 1)',
        initialGrant: new Prisma.Decimal(1000),
        subsidyPercentage: new Prisma.Decimal(50),
        dailySubsidyLimit: new Prisma.Decimal(200),
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        status: 'ACTIVE',
      });

      const result = await service.getPlatformOverview();

      expect(result.users).toEqual({
        total: 2,
        consumers: 1,
        merchants: 1,
        admins: 1,
      });
      expect(result.merchants).toEqual({
        total: 2,
        active: 1,
        pending: 1,
        rejected: 0,
        suspended: 0,
      });
      expect(result.orders).toEqual({
        totalOrders: 2,
        paidOrders: 1,
        pendingOrders: 1,
        totalFinalSpend: 200,
        totalSubsidyUsed: 100,
        totalPersonalPaid: 100,
        totalDiscount: 20,
      });
      expect(result.points).toEqual({
        totalCurrentBalance: 170,
        totalIssued: 220,
        totalRedeemed: 50,
        totalExpired: 0,
      });
      expect(result.coupons.usedCount).toBe(1);
      expect(result.quests.completedCount).toBe(1);
      expect(result.activeProgram?.programName).toBe(
        'โครงการไทยช่วยไทยพลีส (ระยะที่ 1)',
      );
    });
  });

  describe('updateMerchantStatus (FR-A02 & FR-M01)', () => {
    it('approves a PENDING merchant, activates owner MERCHANT role and creates MERCHANT wallet if missing', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue({
        merchantId: 10n,
        ownerUserId: 2n,
        merchantName: 'ร้านป้าศรี ข้าวแกง',
        status: 'PENDING',
        owner: { userId: 2n, fullName: 'ป้าศรี ใจดี' },
        wallet: null,
      });
      prismaMock.merchant.update.mockResolvedValue({
        merchantId: 10n,
        merchantName: 'ร้านป้าศรี ข้าวแกง',
        status: 'ACTIVE',
        updatedAt: new Date('2026-10-17T05:00:00.000Z'),
      });
      prismaMock.userRole.upsert.mockResolvedValue({
        userRoleId: 5n,
        status: 'ACTIVE',
      });
      prismaMock.wallet.create.mockResolvedValue({
        walletId: 20n,
      });

      const result = await service.updateMerchantStatus(
        10n,
        'ACTIVE',
        1n,
        'ตรวจสอบเอกสารครบถ้วน',
      );

      expect(result.previousStatus).toBe('PENDING');
      expect(result.status).toBe('ACTIVE');
      expect(result.audit.event).toBe('ADMIN_MERCHANT_STATUS_CHANGED');
      expect(result.audit.reason).toBe('ตรวจสอบเอกสารครบถ้วน');
      expect(prismaMock.userRole.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.wallet.create).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when merchant does not exist', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMerchantStatus(999n, 'ACTIVE', 1n),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('grantAdminRole & updateAdminRoleStatus (FR-A03 & FR-AUTH-05)', () => {
    it('grants ADMIN role to an active user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        userId: 3n,
        fullName: 'สมชาย ใจดี',
        status: 'ACTIVE',
      });
      prismaMock.userRole.upsert.mockResolvedValue({
        userRoleId: 9n,
        userId: 3n,
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      const result = await service.grantAdminRole(3n, 1n);

      expect(result.role).toBe('ADMIN');
      expect(result.status).toBe('ACTIVE');
      expect(result.audit.event).toBe('ADMIN_ROLE_GRANTED');
    });

    it('prevents suspending the last active ADMIN (last-active-admin protection)', async () => {
      prismaMock.userRole.findUnique.mockResolvedValue({
        userRoleId: 1n,
        userId: 1n,
        role: 'ADMIN',
        status: 'ACTIVE',
        user: { userId: 1n, fullName: 'ผู้ดูแลระบบหลัก' },
      });
      prismaMock.userRole.count.mockResolvedValue(1);

      await expect(
        service.updateAdminRoleStatus(1n, 'SUSPENDED', 1n),
      ).rejects.toThrow(ConflictException);
    });

    it('suspends an ADMIN role and revokes active ADMIN sessions when another active admin exists', async () => {
      prismaMock.userRole.findUnique.mockResolvedValue({
        userRoleId: 2n,
        userId: 2n,
        role: 'ADMIN',
        status: 'ACTIVE',
        user: { userId: 2n, fullName: 'ผู้ดูแลระบบคนที่สอง' },
      });
      prismaMock.userRole.count.mockResolvedValue(2);
      prismaMock.userRole.update.mockResolvedValue({
        userRoleId: 2n,
        status: 'SUSPENDED',
      });
      prismaMock.authSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateAdminRoleStatus(2n, 'SUSPENDED', 1n);

      expect(result.status).toBe('SUSPENDED');
      expect(prismaMock.authSession.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('createSubsidyProgram & updateSubsidyProgram (FR-A04)', () => {
    it('creates a new subsidy program with computed userPercentage', async () => {
      prismaMock.subsidyProgram.create.mockResolvedValue({
        programId: 2n,
        programName: 'โครงการไทยช่วยไทยพลีส (ระยะที่ 2)',
        initialGrant: new Prisma.Decimal(1500),
        subsidyPercentage: new Prisma.Decimal(60),
        userPercentage: new Prisma.Decimal(40),
        dailySubsidyLimit: new Prisma.Decimal(250),
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        status: 'ACTIVE',
        createdAt: new Date('2026-10-17T05:00:00.000Z'),
      });

      const result = await service.createSubsidyProgram(
        {
          programName: 'โครงการไทยช่วยไทยพลีส (ระยะที่ 2)',
          initialGrant: 1500,
          subsidyPercentage: 60,
          dailySubsidyLimit: 250,
          startDate: '2026-11-01',
          endDate: '2026-12-31',
          status: 'ACTIVE',
        },
        1n,
      );

      expect(result.subsidyPercentage).toBe(60);
      expect(result.userPercentage).toBe(40);
      expect(result.dailySubsidyLimit).toBe(250);
    });

    it('rejects subsidy program creation when startDate is after endDate', async () => {
      await expect(
        service.createSubsidyProgram(
          {
            programName: 'โครงการวันที่ผิดพลาด',
            initialGrant: 1000,
            subsidyPercentage: 50,
            dailySubsidyLimit: 200,
            startDate: '2026-12-31',
            endDate: '2026-01-01',
          },
          1n,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('normalizes non-ACTIVE subsidy program status to INACTIVE to satisfy subsidy_programs_status_check', async () => {
      prismaMock.subsidyProgram.findUnique.mockResolvedValue({
        programId: 1n,
        programName: 'โครงการไทยช่วยไทยพลีส (ระยะที่ 1)',
        initialGrant: new Prisma.Decimal(1000),
        subsidyPercentage: new Prisma.Decimal(50),
        userPercentage: new Prisma.Decimal(50),
        dailySubsidyLimit: new Prisma.Decimal(200),
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        status: 'ACTIVE',
        _count: { orders: 0, wallets: 0, walletTransactions: 0 },
      });
      prismaMock.subsidyProgram.update.mockResolvedValue({
        programId: 1n,
        programName: 'โครงการไทยช่วยไทยพลีส (ระยะที่ 1)',
        initialGrant: new Prisma.Decimal(1000),
        subsidyPercentage: new Prisma.Decimal(50),
        userPercentage: new Prisma.Decimal(50),
        dailySubsidyLimit: new Prisma.Decimal(200),
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        status: 'INACTIVE',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.updateSubsidyProgram(
        1n,
        { status: 'PAUSED' },
        1n,
      );

      expect(prismaMock.subsidyProgram.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId: 1n },
          data: expect.objectContaining({ status: 'INACTIVE' }),
        }),
      );
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('getSocialImpactDashboard (FR-A07)', () => {
    it('returns merchants beyond the former top ten for the full list (FR-A01)', async () => {
      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.merchant.findMany.mockResolvedValue(
        Array.from({ length: 24 }, (_, index) => ({
          merchantId: BigInt(index + 1),
          merchantName: `Merchant ${index}`,
        })),
      );
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.userQuest.findMany.mockResolvedValue([]);
      prismaMock.pointTransaction.findMany.mockResolvedValue([]);
      prismaMock.userCoupon.findMany.mockResolvedValue([]);
      const result = await service.getSocialImpactDashboard(7);
      expect(result.salesByMerchant).toHaveLength(24);
    });
    it('computes social impact metrics, sales by merchant/category, and daily trend', async () => {
      prismaMock.user.count.mockResolvedValue(12);
      prismaMock.merchant.findMany.mockResolvedValue([
        { merchantId: 1n, merchantName: 'ร้านป้าศรี ข้าวแกง' },
        { merchantId: 2n, merchantName: 'ร้านลุงพล ของชำ' },
      ]);
      prismaMock.order.findMany.mockResolvedValue([
        {
          orderId: 101n,
          merchantId: 1n,
          finalAmount: new Prisma.Decimal(140),
          subsidyAmount: new Prisma.Decimal(70),
          userPaidAmount: new Prisma.Decimal(70),
          discountAmount: new Prisma.Decimal(10),
          paidAt: new Date(),
          createdAt: new Date(),
          merchant: { merchantId: 1n, merchantName: 'ร้านป้าศรี ข้าวแกง' },
          orderItems: [
            {
              categoryId: 1n,
              quantity: 2,
              lineTotal: new Prisma.Decimal(150),
              category: { categoryId: 1n, categoryName: 'อาหารและเครื่องดื่ม' },
            },
          ],
        },
      ]);
      prismaMock.userQuest.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'ACTIVE' },
      ]);
      prismaMock.pointTransaction.findMany.mockResolvedValue([
        { transactionType: 'QUEST_REWARD', points: 100 },
        { transactionType: 'COUPON_REDEEM', points: -20 },
      ]);
      prismaMock.userCoupon.findMany.mockResolvedValue([
        { status: 'USED' },
        { status: 'AVAILABLE' },
      ]);

      const result = await service.getSocialImpactDashboard(7);

      expect(result.activeConsumers).toBe(12);
      expect(result.participatingMerchants).toBe(2);
      expect(result.successfulOrders).toBe(1);
      expect(result.totalFinalSpend).toBe(140);
      expect(result.totalSubsidyUsed).toBe(70);
      expect(result.averageSalesPerMerchant).toBe(70);
      expect(result.questCompletionRate).toBe(50);
      expect(result.couponUsageRate).toBe(50);
      expect(result.salesByCategory[0]?.categoryName).toBe(
        'อาหารและเครื่องดื่ม',
      );
      expect(result.dailyTrend).toHaveLength(7);
      expect(result.reportingTimezone).toBe('Asia/Bangkok');
    });
  });

  describe('Audit Events (NFR-OBS-01 & BR-POLICY-01)', () => {
    it('records an audit event successfully to prisma.auditEvent', async () => {
      await service.recordAuditEvent({
        actorUserId: 1n,
        actorRole: 'ADMIN',
        action: 'TEST_ACTION',
        targetType: 'MERCHANT',
        targetId: '10',
        metadata: { key: 'value' },
      });

      expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: 1n,
          actorRole: 'ADMIN',
          action: 'TEST_ACTION',
          targetType: 'MERCHANT',
          targetId: '10',
          result: 'SUCCESS',
        }),
      });
    });

    it('lists audit events with pagination and filters', async () => {
      const mockEvent = {
        auditEventId: 'ae_1',
        action: 'ADMIN_MERCHANT_STATUS_CHANGED',
        actorRole: 'ADMIN',
        targetType: 'MERCHANT',
        targetId: '10',
        result: 'SUCCESS',
        createdAt: new Date(),
        actorUser: { fullName: 'Super Admin', email: 'admin@tp.th' },
      };
      prismaMock.auditEvent.findMany.mockResolvedValue([mockEvent]);
      prismaMock.auditEvent.count.mockResolvedValue(1);

      const result = await service.listAuditEvents({
        action: 'ADMIN_MERCHANT_STATUS_CHANGED',
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].action).toBe('ADMIN_MERCHANT_STATUS_CHANGED');
    });
  });
});
