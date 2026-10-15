import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderService } from './order.service.js';

interface MockPrisma {
  order: {
    findUnique: Mock;
    update: Mock;
    create: Mock;
    findMany: Mock;
  };
  wallet: { findUnique: Mock; update: Mock };
  walletTransaction: { findMany: Mock; create: Mock };
  subsidyProgram: { findFirst: Mock };
  userCoupon: { findUnique: Mock; updateMany: Mock };
  merchant: { findUnique: Mock };
  product: { findMany: Mock };
  $queryRaw: Mock;
  $transaction: Mock;
}

const future = new Date('2099-01-01T00:00:00.000Z');
const paidAt = new Date('2026-10-13T10:00:00.000Z');

function paymentOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 10n,
    merchantId: 20n,
    userId: null,
    walletId: null,
    programId: null,
    userCouponId: null,
    subtotal: '100.00',
    discountAmount: '0.00',
    finalAmount: '100.00',
    subsidyAmount: '0.00',
    userPaidAmount: '0.00',
    status: 'PENDING',
    qrToken: 'secure-token',
    qrExpiresAt: future,
    createdAt: new Date('2026-10-13T09:00:00.000Z'),
    paidAt: null,
    merchant: { status: 'ACTIVE' },
    ...overrides,
  };
}

describe('OrderService payment', () => {
  let service: OrderService;
  let prismaMock: MockPrisma;

  function arrangePayableOrder(
    options: {
      subtotal?: string;
      personalBalance?: string;
      subsidyBalance?: string;
      dailyUsed?: string[];
      subsidyPercentage?: string;
    } = {},
  ) {
    const pendingOrder = paymentOrder({
      subtotal: options.subtotal ?? '100.00',
      finalAmount: options.subtotal ?? '100.00',
    });
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(pendingOrder);
    prismaMock.wallet.findUnique
      .mockResolvedValueOnce({
        walletId: 30n,
        userId: 100n,
        status: 'ACTIVE',
        personalBalance: options.personalBalance ?? '500.00',
        subsidyBalance: options.subsidyBalance ?? '300.00',
      })
      .mockResolvedValueOnce({
        walletId: 40n,
        merchantId: 20n,
        status: 'ACTIVE',
        merchantBalance: '25.00',
      });
    prismaMock.subsidyProgram.findFirst.mockResolvedValue({
      programId: 1n,
      subsidyPercentage: options.subsidyPercentage ?? '60.00',
      dailySubsidyLimit: '200.00',
    });
    prismaMock.walletTransaction.findMany.mockResolvedValue(
      (options.dailyUsed ?? []).map((amount) => ({ amount })),
    );
    prismaMock.wallet.update.mockResolvedValue({});
    prismaMock.walletTransaction.create.mockResolvedValue({});
    prismaMock.order.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...pendingOrder, ...data }),
    );

    return pendingOrder;
  }

  beforeEach(() => {
    prismaMock = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      wallet: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      walletTransaction: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      subsidyProgram: { findFirst: vi.fn() },
      userCoupon: { findUnique: vi.fn(), updateMany: vi.fn() },
      merchant: { findUnique: vi.fn() },
      product: { findMany: vi.fn() },
      $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
        const sql = query.join(' ');
        if (sql.includes('FROM "orders"')) return [{ order_id: 10n }];
        if (sql.includes('"user_id"')) return [{ wallet_id: 30n }];
        if (sql.includes('"merchant_id"')) return [{ wallet_id: 40n }];
        return [];
      }),
      $transaction: vi.fn(
        async (callback: (tx: MockPrisma) => Promise<unknown>) =>
          callback(prismaMock),
      ),
    };
    service = new OrderService(
      prismaMock as unknown as PrismaService,
      { getOrThrow: vi.fn().mockReturnValue('test-secret') } as never,
    );
  });

  it('debits the consumer, credits the merchant, and persists stable ledger keys', async () => {
    arrangePayableOrder({ subtotal: '101.00' });

    const result = await service.payByQr(100n, {
      qrToken: 'secure-token',
    });

    expect(result).toMatchObject({
      success: true,
      isIdempotentReplay: false,
      orderId: '10',
      finalAmount: 101,
      subsidyAmount: 60.6,
      userPaidAmount: 40.4,
    });
    expect(prismaMock.wallet.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.walletTransaction.create).toHaveBeenCalledTimes(3);
    expect(prismaMock.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessRef: 'payment:10:personal',
        }),
      }),
    );
    expect(prismaMock.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessRef: 'payment:10:subsidy',
        }),
      }),
    );
    expect(prismaMock.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessRef: 'payment:10:merchant',
        }),
      }),
    );
    expect(prismaMock.subsidyProgram.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startDate: 'desc' }, { programId: 'desc' }],
      }),
    );
    expect(prismaMock.walletTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: expect.any(Date),
            lt: expect.any(Date),
          },
        }),
      }),
    );
  });

  it.each([
    {
      name: 'uses only the remaining daily allowance',
      dailyUsed: ['170.00'],
      subsidyBalance: '300.00',
      subsidyAmount: 30,
      userPaidAmount: 70,
    },
    {
      name: 'uses no subsidy after the daily allowance is exhausted',
      dailyUsed: ['200.00'],
      subsidyBalance: '300.00',
      subsidyAmount: 0,
      userPaidAmount: 100,
    },
    {
      name: 'falls back to personal money when subsidy balance is low',
      dailyUsed: [],
      subsidyBalance: '20.00',
      subsidyAmount: 20,
      userPaidAmount: 80,
    },
  ])(
    '$name',
    async ({ dailyUsed, subsidyBalance, subsidyAmount, userPaidAmount }) => {
      arrangePayableOrder({ dailyUsed, subsidyBalance });

      const result = await service.payByQr(100n, { qrToken: 'secure-token' });

      expect(result).toMatchObject({ subsidyAmount, userPaidAmount });
    },
  );

  it('uses a half-open Bangkok day and Bangkok business date for program selection', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));

    try {
      arrangePayableOrder();

      await service.payByQr(100n, { qrToken: 'secure-token' });

      const businessDate = new Date('2026-10-15T00:00:00.000Z');
      expect(prismaMock.subsidyProgram.findFirst).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          startDate: { lte: businessDate },
          endDate: { gte: businessDate },
        },
        orderBy: [{ startDate: 'desc' }, { programId: 'desc' }],
      });
      expect(prismaMock.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-10-14T17:00:00.000Z'),
              lt: new Date('2026-10-15T17:00:00.000Z'),
            },
          }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies a coupon before calculating the subsidy split', async () => {
    arrangePayableOrder();
    prismaMock.userCoupon.findUnique.mockResolvedValue({
      userCouponId: 50n,
      userId: 100n,
      status: 'AVAILABLE',
      expiresAt: future,
      coupon: {
        merchantId: null,
        couponName: 'ลด 20 บาท',
        status: 'ACTIVE',
        discountType: 'FIXED',
        discountValue: '20.00',
        minPurchase: '50.00',
      },
    });
    prismaMock.userCoupon.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.payByQr(100n, {
      qrToken: 'secure-token',
      userCouponId: '50',
    });

    expect(result).toMatchObject({
      discountAmount: 20,
      finalAmount: 80,
      subsidyAmount: 48,
      userPaidAmount: 32,
    });
  });

  it('rejects insufficient personal balance without writing value movements', async () => {
    arrangePayableOrder({
      personalBalance: '39.99',
      subsidyBalance: '300.00',
    });

    await expect(
      service.payByQr(100n, { qrToken: 'secure-token' }),
    ).rejects.toThrow('ยอดเงินในกระเป๋าไม่เพียงพอ');
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it.each(['-1.00', '100.01'])(
    'rejects invalid subsidy percentage %s without writing value movements',
    async (subsidyPercentage) => {
      arrangePayableOrder({ subsidyPercentage });

      await expect(
        service.payByQr(100n, { qrToken: 'secure-token' }),
      ).rejects.toThrow('SUBSIDY_POLICY_INVALID');
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    },
  );

  it('rejects a coupon when the order does not meet its minimum purchase', async () => {
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(paymentOrder({ subtotal: '40.00' }));
    prismaMock.wallet.findUnique.mockResolvedValueOnce({
      walletId: 30n,
      userId: 100n,
      status: 'ACTIVE',
      personalBalance: '500.00',
      subsidyBalance: '0.00',
    });
    prismaMock.userCoupon.findUnique.mockResolvedValue({
      userCouponId: 50n,
      userId: 100n,
      status: 'AVAILABLE',
      expiresAt: future,
      coupon: {
        merchantId: null,
        couponName: 'ลด 10 บาท',
        status: 'ACTIVE',
        discountType: 'FIXED',
        discountValue: '10.00',
        minPurchase: '50.00',
      },
    });
    prismaMock.subsidyProgram.findFirst.mockResolvedValue(null);

    await expect(
      service.payByQr(100n, {
        qrToken: 'secure-token',
        userCouponId: '50',
      }),
    ).rejects.toThrow('ยอดซื้อไม่ถึงขั้นต่ำของคูปอง');
    expect(prismaMock.userCoupon.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('returns the stored result for a retry by the original consumer', async () => {
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(
        paymentOrder({
          userId: 100n,
          walletId: 30n,
          status: 'PAID',
          subsidyAmount: '50.00',
          userPaidAmount: '50.00',
          paidAt,
        }),
      );

    const result = await service.payByQr(100n, {
      qrToken: 'secure-token',
    });

    expect(result.isIdempotentReplay).toBe(true);
    expect(result.userPaidAmount).toBe(50);
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects replay by a different consumer without moving value', async () => {
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(
        paymentOrder({
          userId: 100n,
          walletId: 30n,
          status: 'PAID',
          subsidyAmount: '50.00',
          userPaidAmount: '50.00',
          paidAt,
        }),
      );

    await expect(
      service.payByQr(999n, { qrToken: 'secure-token' }),
    ).rejects.toThrow(ConflictException);
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
  });
});
