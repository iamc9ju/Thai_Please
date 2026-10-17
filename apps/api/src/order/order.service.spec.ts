import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashQrToken, OrderService } from './order.service.js';

interface MockPrisma {
  order: {
    findUnique: Mock;
    findFirst: Mock;
    update: Mock;
    create: Mock;
    findMany: Mock;
  };
  wallet: { findUnique: Mock; findFirst: Mock; update: Mock };
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
  let questsServiceMock: { evaluateOrder: Mock };

  beforeEach(() => {
    prismaMock = {
      order: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      wallet: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
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
    questsServiceMock = {
      evaluateOrder: vi.fn().mockResolvedValue(null),
    };
    service = new OrderService(
      prismaMock as unknown as PrismaService,
      { getOrThrow: vi.fn().mockReturnValue('test-secret') } as never,
      questsServiceMock as never,
    );
  });

  it('debits the consumer, credits the merchant, and persists stable ledger keys', async () => {
    const pendingOrder = paymentOrder({
      subtotal: '100.01',
      finalAmount: '100.01',
    });
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(pendingOrder);
    prismaMock.wallet.findUnique
      .mockResolvedValueOnce({
        walletId: 30n,
        userId: 100n,
        status: 'ACTIVE',
        personalBalance: '500.00',
        subsidyBalance: '300.00',
      })
      .mockResolvedValueOnce({
        walletId: 40n,
        merchantId: 20n,
        status: 'ACTIVE',
        merchantBalance: '25.00',
      });
    prismaMock.subsidyProgram.findFirst.mockResolvedValue({
      programId: 1n,
      subsidyPercentage: '60.00',
      dailySubsidyLimit: '200.00',
    });
    prismaMock.walletTransaction.findMany.mockResolvedValue([]);
    prismaMock.wallet.update.mockResolvedValue({});
    prismaMock.walletTransaction.create.mockResolvedValue({});
    prismaMock.order.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...pendingOrder, ...data }),
    );

    const result = await service.payByQr(100n, {
      qrToken: 'secure-token',
    });

    expect(result).toMatchObject({
      success: true,
      isIdempotentReplay: false,
      orderId: '10',
      finalAmount: 100.01,
      subsidyAmount: 60,
      userPaidAmount: 40.01,
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
  });

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

  it('triggers quest evaluation for the paid order outside the payment lock', async () => {
    const pendingOrder = paymentOrder({
      subtotal: '100.00',
      finalAmount: '100.00',
    });
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(pendingOrder);
    prismaMock.wallet.findUnique
      .mockResolvedValueOnce({
        walletId: 30n,
        userId: 100n,
        status: 'ACTIVE',
        personalBalance: '500.00',
        subsidyBalance: '0.00',
      })
      .mockResolvedValueOnce({
        walletId: 40n,
        merchantId: 20n,
        status: 'ACTIVE',
        merchantBalance: '0.00',
      });
    prismaMock.order.update.mockResolvedValueOnce({
      ...pendingOrder,
      status: 'PAID',
      paidAt,
    });

    const result = await service.payByQr(100n, { qrToken: 'secure-token' });

    expect(result.success).toBe(true);
    expect(questsServiceMock.evaluateOrder).toHaveBeenCalledTimes(1);
    expect(questsServiceMock.evaluateOrder).toHaveBeenCalledWith(10n);
  });

  it('does not fail payment when quest evaluation fails', async () => {
    const pendingOrder = paymentOrder({
      subtotal: '100.00',
      finalAmount: '100.00',
    });
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(pendingOrder);
    prismaMock.wallet.findUnique
      .mockResolvedValueOnce({
        walletId: 30n,
        userId: 100n,
        status: 'ACTIVE',
        personalBalance: '500.00',
        subsidyBalance: '0.00',
      })
      .mockResolvedValueOnce({
        walletId: 40n,
        merchantId: 20n,
        status: 'ACTIVE',
        merchantBalance: '0.00',
      });
    prismaMock.order.update.mockResolvedValueOnce({
      ...pendingOrder,
      status: 'PAID',
      paidAt,
    });
    questsServiceMock.evaluateOrder.mockRejectedValueOnce(
      new Error('Evaluation DB timeout'),
    );

    const result = await service.payByQr(100n, { qrToken: 'secure-token' });

    expect(result.success).toBe(true);
    expect(questsServiceMock.evaluateOrder).toHaveBeenCalledWith(10n);
  });

  it('does not trigger quest evaluation on idempotent replay', async () => {
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ orderId: 10n })
      .mockResolvedValueOnce(
        paymentOrder({
          userId: 100n,
          walletId: 30n,
          status: 'PAID',
          subsidyAmount: '0.00',
          userPaidAmount: '100.00',
          paidAt,
        }),
      );

    const result = await service.payByQr(100n, { qrToken: 'secure-token' });

    expect(result.isIdempotentReplay).toBe(true);
    expect(questsServiceMock.evaluateOrder).not.toHaveBeenCalled();
  });

  it('creates order with userPaidAmount equal to finalAmount to satisfy orders_check1 constraint', async () => {
    prismaMock.merchant.findUnique.mockResolvedValueOnce({
      merchantId: 1n,
      status: 'ACTIVE',
    });
    prismaMock.wallet.findFirst.mockResolvedValueOnce({
      walletId: 10n,
      status: 'ACTIVE',
    });
    prismaMock.product.findMany.mockResolvedValueOnce([
      {
        productId: 1n,
        categoryId: 1n,
        productName: 'ข้าวกะเพราหมูกรอบ',
        price: '60.00',
        merchantId: 1n,
        status: 'ACTIVE',
      },
    ]);
    prismaMock.order.create.mockImplementationOnce(async ({ data }) => ({
      orderId: 5n,
      status: data.status,
      subtotal: data.subtotal,
      finalAmount: data.finalAmount,
      subsidyAmount: data.subsidyAmount,
      userPaidAmount: data.userPaidAmount,
      qrToken: data.qrToken,
      qrExpiresAt: data.qrExpiresAt,
    }));

    const result = await service.createOrder(1n, {
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(result.orderId).toBe('5');
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subsidyAmount: expect.anything(),
          userPaidAmount: expect.anything(),
        }),
      }),
    );
    const createData = prismaMock.order.create.mock.calls[0][0].data;
    // Check that subsidyAmount + userPaidAmount === finalAmount (orders_check1)
    expect(
      Number(createData.subsidyAmount) + Number(createData.userPaidAmount),
    ).toBe(Number(createData.finalAmount));
    // FR-M04: Database stores only the SHA-256 hash, while merchant receives the raw token
    expect(createData.qrToken).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.qrToken).toMatch(/^[a-f0-9]{64}$/);
    expect(hashQrToken(result.qrToken)).toBe(createData.qrToken);
  });

  it('rejects direct replay of a leaked sha256: database hash in previewOrder and payByQr (FR-M04)', async () => {
    const leakedDbHash = hashQrToken('secret-raw-qr-token');

    await expect(
      service.previewOrder(100n, { qrToken: leakedDbHash }),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.payByQr(100n, { qrToken: leakedDbHash }),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
  });

  it('rejects order creation if merchant does not have an active wallet', async () => {
    prismaMock.merchant.findUnique.mockResolvedValueOnce({
      merchantId: 1n,
      status: 'ACTIVE',
    });
    prismaMock.wallet.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createOrder(1n, { items: [{ productId: 1, quantity: 1 }] }),
    ).rejects.toThrow('ร้านค้ายังไม่มีกระเป๋าเงินที่พร้อมรับเงิน');
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  describe('FR-C06 & FR-M08: Orders and Receipts', () => {
    it('listConsumerOrders returns mapped orders with items and merchant snapshot', async () => {
      const now = new Date();
      prismaMock.order.findMany.mockResolvedValueOnce([
        {
          orderId: 10n,
          status: 'PAID',
          subtotal: '200.00',
          discountAmount: '20.00',
          finalAmount: '180.00',
          subsidyAmount: '90.00',
          userPaidAmount: '90.00',
          createdAt: now,
          paidAt: now,
          merchant: {
            merchantId: 1n,
            merchantName: 'ร้านครัวบ้านเรา',
            address: 'เขตบางรัก',
            phone: '0812345678',
          },
          orderItems: [
            {
              orderItemId: 101n,
              productId: 5n,
              productNameSnapshot: 'ข้าวกะเพรา',
              unitPrice: '60.00',
              quantity: 2,
              lineTotal: '120.00',
              category: { categoryName: 'อาหาร' },
            },
          ],
          appliedUserCoupon: {
            coupon: {
              couponName: 'ลด 20 บาท',
              discountValue: '20.00',
              discountType: 'FIXED',
            },
          },
        },
      ]);

      const result = await service.listConsumerOrders(100n);

      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe('10');
      expect(result[0].receiptNumber).toBe('TP-000010');
      expect(result[0].merchantName).toBe('ร้านครัวบ้านเรา');
      expect(result[0].finalAmount).toBe(180);
      expect(result[0].items[0].productName).toBe('ข้าวกะเพรา');
      expect(result[0].appliedCoupon?.couponName).toBe('ลด 20 บาท');
    });

    it('getConsumerReceipt returns receipt and throws NotFoundException when order not found', async () => {
      const now = new Date();
      prismaMock.order.findFirst.mockResolvedValueOnce({
        orderId: 10n,
        status: 'PAID',
        subtotal: '100.00',
        discountAmount: '0.00',
        finalAmount: '100.00',
        subsidyAmount: '50.00',
        userPaidAmount: '50.00',
        createdAt: now,
        paidAt: now,
        merchant: {
          merchantId: 1n,
          merchantName: 'ร้านค้าชุมชน',
          address: 'กรุงเทพฯ',
          phone: null,
        },
        user: {
          fullName: 'สมชาย รักชาติ',
          citizenId: '1100000000001',
        },
        orderItems: [
          {
            orderItemId: 1n,
            productId: 1n,
            productNameSnapshot: 'น้ำดื่ม',
            unitPrice: '10.00',
            quantity: 10,
            lineTotal: '100.00',
            category: { categoryName: 'เครื่องดื่ม' },
          },
        ],
        appliedUserCoupon: null,
      });

      const receipt = await service.getConsumerReceipt(100n, 10n);
      expect(receipt.orderId).toBe('10');
      expect(receipt.consumer.fullName).toBe('สมชาย รักชาติ');
      expect(receipt.consumer.maskedCitizenId).toBe('1-XXXX-XXXXX-00-1');
      expect(receipt.items).toHaveLength(1);

      prismaMock.order.findFirst.mockResolvedValueOnce(null);
      await expect(service.getConsumerReceipt(100n, 999n)).rejects.toThrow(
        'ไม่พบคำสั่งซื้อหรือไม่มีสิทธิ์เข้าถึงใบเสร็จนี้',
      );
    });

    it('getMerchantReceipt returns receipt and throws NotFoundException when order not found', async () => {
      prismaMock.order.findFirst.mockResolvedValueOnce(null);
      await expect(service.getMerchantReceipt(1n, 999n)).rejects.toThrow(
        'ไม่พบคำสั่งซื้อหรือไม่มีสิทธิ์เข้าถึงใบเสร็จนี้',
      );
    });
  });
});
