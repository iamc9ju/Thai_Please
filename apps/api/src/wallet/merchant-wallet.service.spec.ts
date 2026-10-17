import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { FundType, TransactionType } from './wallet.constants.js';
import { WalletService } from './wallet.service.js';

interface MockMerchantPrisma {
  merchant: { findUnique: Mock };
  user: { findUnique: Mock };
  wallet: {
    findUnique: Mock;
    create: Mock;
    update: Mock;
  };
  walletTransaction: {
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
  };
  order: { findMany: Mock };
  $queryRaw: Mock;
  $transaction: Mock;
}

describe('WalletService FR-M06 & FR-M07 (Merchant Wallet & Dashboard)', () => {
  let service: WalletService;
  let prismaMock: MockMerchantPrisma;

  beforeEach(() => {
    prismaMock = {
      merchant: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      wallet: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      walletTransaction: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ wallet_id: 10n }]),
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(prismaMock),
      ),
    };

    service = new WalletService(prismaMock as unknown as PrismaService);
  });

  describe('getMerchantWalletOverview (FR-M06)', () => {
    it('returns merchant wallet balance, order income breakdown, and withdrawal eligibility', async () => {
      const ownerId = 101n;
      const merchantId = 301n;

      prismaMock.merchant.findUnique.mockResolvedValue({
        merchantId,
        merchantName: 'ร้านป้าศรี ข้าวแกงไทย',
        ownerUserId: ownerId,
        status: 'ACTIVE',
      });

      prismaMock.user.findUnique.mockResolvedValue({
        userId: ownerId,
        status: 'ACTIVE',
        role: 'MERCHANT',
        roles: [
          { role: 'MERCHANT', status: 'ACTIVE' },
          { role: 'CONSUMER', status: 'ACTIVE' },
        ],
      });

      prismaMock.wallet.findUnique.mockImplementation(
        async (args: { where: { merchantId?: bigint; userId?: bigint } }) => {
          if (args.where.merchantId === merchantId) {
            return {
              walletId: 801n,
              merchantId,
              walletType: 'MERCHANT',
              merchantBalance: new Prisma.Decimal('450.00'),
              personalBalance: new Prisma.Decimal('0.00'),
              subsidyBalance: new Prisma.Decimal('0.00'),
              status: 'ACTIVE',
            };
          }
          if (args.where.userId === ownerId) {
            return {
              walletId: 501n,
              userId: ownerId,
              walletType: 'CONSUMER',
              personalBalance: new Prisma.Decimal('200.00'),
              subsidyBalance: new Prisma.Decimal('900.00'),
              merchantBalance: new Prisma.Decimal('0.00'),
              status: 'ACTIVE',
            };
          }
          return null;
        },
      );

      prismaMock.order.findMany.mockResolvedValue([
        {
          orderId: 55n,
          subtotal: new Prisma.Decimal('120.00'),
          discountAmount: new Prisma.Decimal('20.00'),
          finalAmount: new Prisma.Decimal('100.00'),
          subsidyAmount: new Prisma.Decimal('50.00'),
          userPaidAmount: new Prisma.Decimal('50.00'),
          paidAt: new Date('2026-10-17T03:00:00Z'),
          createdAt: new Date('2026-10-17T02:58:00Z'),
          user: { fullName: 'สมชาย ใจดี' },
        },
      ]);

      prismaMock.walletTransaction.findMany
        .mockResolvedValueOnce([{ amount: new Prisma.Decimal('50.00') }])
        .mockResolvedValueOnce([
          {
            walletTransactionId: 900n,
            fundType: FundType.MERCHANT,
            transactionType: TransactionType.MERCHANT_SALE_CREDIT,
            amount: new Prisma.Decimal('100.00'),
            balanceBefore: new Prisma.Decimal('350.00'),
            balanceAfter: new Prisma.Decimal('450.00'),
            businessRef: 'payment:55:merchant',
            transferReference: null,
            orderId: 55n,
            createdAt: new Date('2026-10-17T03:00:00Z'),
            order: {
              orderId: 55n,
              subtotal: new Prisma.Decimal('120.00'),
              discountAmount: new Prisma.Decimal('20.00'),
              finalAmount: new Prisma.Decimal('100.00'),
              subsidyAmount: new Prisma.Decimal('50.00'),
              userPaidAmount: new Prisma.Decimal('50.00'),
              user: { fullName: 'สมชาย ใจดี' },
            },
          },
        ]);

      const result = await service.getMerchantWalletOverview(
        ownerId,
        merchantId,
      );

      expect(result.wallet).toEqual({
        walletId: '801',
        merchantId: '301',
        merchantName: 'ร้านป้าศรี ข้าวแกงไทย',
        merchantStatus: 'ACTIVE',
        walletStatus: 'ACTIVE',
        merchantBalance: 450,
        totalSalesIncome: 100,
        totalSubsidyPortion: 50,
        totalPersonalPortion: 50,
        totalWithdrawn: 50,
        paidOrderCount: 1,
      });
      expect(result.withdrawalEligibility).toEqual({
        isOwner: true,
        hasConsumerRole: true,
        hasConsumerWallet: true,
        consumerWalletId: '501',
        consumerPersonalBalance: 200,
        canWithdraw: true,
      });
      expect(result.orderIncomes[0]).toMatchObject({
        orderId: '55',
        receiptNumber: 'TP-000055',
        finalAmount: 100,
        subsidyAmount: 50,
        userPaidAmount: 50,
        consumerName: 'สมชาย ใจดี',
      });
    });

    it('rejects access when requestedMerchantId does not match activeMerchantId', async () => {
      await expect(
        service.getMerchantWalletOverview(101n, 301n, 999n),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('withdrawFromMerchantWallet (FR-M06 / BR-WALLET-06)', () => {
    const ownerId = 101n;
    const merchantId = 301n;
    const merchantWalletId = 801n;
    const consumerWalletId = 501n;

    beforeEach(() => {
      prismaMock.merchant.findUnique.mockResolvedValue({
        merchantId,
        merchantName: 'ร้านป้าศรี ข้าวแกงไทย',
        ownerUserId: ownerId,
        status: 'ACTIVE',
      });

      prismaMock.user.findUnique.mockResolvedValue({
        userId: ownerId,
        status: 'ACTIVE',
        role: 'MERCHANT',
        roles: [
          { role: 'MERCHANT', status: 'ACTIVE' },
          { role: 'CONSUMER', status: 'ACTIVE' },
        ],
      });

      prismaMock.wallet.findUnique.mockImplementation(
        async (args: {
          where: { merchantId?: bigint; userId?: bigint; walletId?: bigint };
        }) => {
          if (
            args.where.merchantId === merchantId ||
            args.where.walletId === merchantWalletId
          ) {
            return {
              walletId: merchantWalletId,
              merchantId,
              walletType: 'MERCHANT',
              merchantBalance: new Prisma.Decimal('400.00'),
              personalBalance: new Prisma.Decimal('0.00'),
              subsidyBalance: new Prisma.Decimal('0.00'),
              status: 'ACTIVE',
            };
          }
          if (
            args.where.userId === ownerId ||
            args.where.walletId === consumerWalletId
          ) {
            return {
              walletId: consumerWalletId,
              userId: ownerId,
              walletType: 'CONSUMER',
              personalBalance: new Prisma.Decimal('150.00'),
              subsidyBalance: new Prisma.Decimal('800.00'),
              merchantBalance: new Prisma.Decimal('0.00'),
              status: 'ACTIVE',
            };
          }
          return null;
        },
      );
    });

    it('atomically debits merchant balance and credits owner consumer personal balance', async () => {
      prismaMock.walletTransaction.findUnique.mockResolvedValue(null);
      prismaMock.walletTransaction.create
        .mockResolvedValueOnce({
          walletTransactionId: 1001n,
          createdAt: new Date('2026-10-17T04:00:00Z'),
        })
        .mockResolvedValueOnce({
          walletTransactionId: 1002n,
          createdAt: new Date('2026-10-17T04:00:00Z'),
        });

      const result = await service.withdrawFromMerchantWallet(
        ownerId,
        merchantId,
        {
          amount: 250,
          idempotencyKey: 'withdraw-key-0001',
        },
      );

      expect(result).toEqual({
        success: true,
        isIdempotentReplay: false,
        withdrawalId: '1001',
        creditTransactionId: '1002',
        transferReference: 'transfer_801_withdraw-key-0001',
        amount: 250,
        merchantBalanceBefore: 400,
        merchantBalanceAfter: 150,
        consumerPersonalBalanceBefore: 150,
        consumerPersonalBalanceAfter: 400,
        createdAt: new Date('2026-10-17T04:00:00Z'),
      });

      expect(prismaMock.wallet.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.walletTransaction.create).toHaveBeenCalledTimes(2);
    });

    it('returns idempotent replay when the same withdrawal key and amount are retried', async () => {
      prismaMock.walletTransaction.findUnique
        .mockResolvedValueOnce({
          walletTransactionId: 1001n,
          walletId: merchantWalletId,
          initiatedByUserId: ownerId,
          fundType: FundType.MERCHANT,
          transactionType: TransactionType.MERCHANT_WITHDRAWAL,
          amount: new Prisma.Decimal('250.00'),
          balanceBefore: new Prisma.Decimal('400.00'),
          balanceAfter: new Prisma.Decimal('150.00'),
          transferReference: 'transfer_801_withdraw-key-0001',
          createdAt: new Date('2026-10-17T04:00:00Z'),
        })
        .mockResolvedValueOnce({
          walletTransactionId: 1002n,
          balanceBefore: new Prisma.Decimal('150.00'),
          balanceAfter: new Prisma.Decimal('400.00'),
        });

      const result = await service.withdrawFromMerchantWallet(
        ownerId,
        merchantId,
        {
          amount: 250,
          idempotencyKey: 'withdraw-key-0001',
        },
      );

      expect(result.isIdempotentReplay).toBe(true);
      expect(result.merchantBalanceAfter).toBe(150);
      expect(result.consumerPersonalBalanceAfter).toBe(400);
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    });

    it('rejects reused idempotency key with a different withdrawal amount', async () => {
      prismaMock.walletTransaction.findUnique.mockResolvedValueOnce({
        walletTransactionId: 1001n,
        walletId: merchantWalletId,
        initiatedByUserId: ownerId,
        fundType: FundType.MERCHANT,
        transactionType: TransactionType.MERCHANT_WITHDRAWAL,
        amount: new Prisma.Decimal('250.00'),
        balanceBefore: new Prisma.Decimal('400.00'),
        balanceAfter: new Prisma.Decimal('150.00'),
      });

      await expect(
        service.withdrawFromMerchantWallet(ownerId, merchantId, {
          amount: 300,
          idempotencyKey: 'withdraw-key-0001',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects withdrawal when amount exceeds merchantBalance', async () => {
      prismaMock.walletTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.withdrawFromMerchantWallet(ownerId, merchantId, {
          amount: 500,
          idempotencyKey: 'withdraw-key-over',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects withdrawal when owner lacks an active CONSUMER role', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        userId: ownerId,
        status: 'ACTIVE',
        role: 'MERCHANT',
        roles: [{ role: 'MERCHANT', status: 'ACTIVE' }],
      });

      await expect(
        service.withdrawFromMerchantWallet(ownerId, merchantId, {
          amount: 100,
          idempotencyKey: 'withdraw-key-noconsumer',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMerchantDashboard (FR-M07)', () => {
    it('computes total sales, subsidy/personal split, coupon metrics, top products, and sales trend', async () => {
      const ownerId = 101n;
      const merchantId = 301n;

      prismaMock.merchant.findUnique.mockResolvedValue({
        merchantId,
        merchantName: 'ร้านป้าศรี ข้าวแกงไทย',
        ownerUserId: ownerId,
        status: 'ACTIVE',
      });

      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId: 801n,
        merchantId,
        walletType: 'MERCHANT',
        merchantBalance: new Prisma.Decimal('320.00'),
        status: 'ACTIVE',
      });

      const now = new Date();
      prismaMock.order.findMany.mockResolvedValue([
        {
          orderId: 1n,
          status: 'PAID',
          userCouponId: 10n,
          subtotal: new Prisma.Decimal('120.00'),
          discountAmount: new Prisma.Decimal('20.00'),
          finalAmount: new Prisma.Decimal('100.00'),
          subsidyAmount: new Prisma.Decimal('50.00'),
          userPaidAmount: new Prisma.Decimal('50.00'),
          paidAt: now,
          createdAt: now,
          orderItems: [
            {
              productId: 11n,
              productNameSnapshot: 'ข้าวกะเพราไก่ไข่ดาว',
              quantity: 2,
              lineTotal: new Prisma.Decimal('120.00'),
              category: { categoryName: 'อาหารและเครื่องดื่ม' },
            },
          ],
        },
        {
          orderId: 2n,
          status: 'PENDING',
          userCouponId: null,
          subtotal: new Prisma.Decimal('60.00'),
          discountAmount: new Prisma.Decimal('0.00'),
          finalAmount: new Prisma.Decimal('60.00'),
          subsidyAmount: new Prisma.Decimal('0.00'),
          userPaidAmount: new Prisma.Decimal('0.00'),
          paidAt: null,
          createdAt: now,
          orderItems: [],
        },
      ]);

      const dashboard = await service.getMerchantDashboard(
        ownerId,
        merchantId,
        7,
      );

      expect(dashboard.summary).toEqual({
        totalSales: 100,
        totalSubtotal: 120,
        totalDiscountAmount: 20,
        orderCount: {
          paid: 1,
          pending: 1,
          total: 2,
          averageOrderValue: 100,
        },
        subsidyReceived: 50,
        personalPaymentReceived: 50,
        subsidySharePercent: 50,
        personalSharePercent: 50,
        couponOrders: {
          count: 1,
          totalDiscount: 20,
          usageRatePercent: 100,
        },
      });
      expect(dashboard.topProducts).toEqual([
        {
          productId: '11',
          productName: 'ข้าวกะเพราไก่ไข่ดาว',
          categoryName: 'อาหารและเครื่องดื่ม',
          totalQuantity: 2,
          totalRevenue: 120,
          orderCount: 1,
        },
      ]);
      expect(dashboard.salesTrend).toHaveLength(7);
      expect(dashboard.dataFreshness.timezone).toBe('Asia/Bangkok');
    });
  });
});
