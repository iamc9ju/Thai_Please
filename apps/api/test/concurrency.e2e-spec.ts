import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { OrderService } from '../src/order/order.service.js';
import { WalletService } from '../src/wallet/wallet.service.js';
import { ConfigService } from '@nestjs/config';
import type { QuestsService } from '../src/quests/quests.service.js';

describe('Real DB Concurrency & Race Condition Suite (NFR-DATA-01)', () => {
  let prisma: PrismaService;
  let orderService: OrderService;
  let walletService: WalletService;
  let configService: ConfigService;

  // Unique test IDs
  const TEST_PREFIX = `conc_${Date.now()}`;
  const CONSUMER_CITIZEN_ID = `9${Math.floor(100000000000 + Math.random() * 899999999999)}`;
  const MERCHANT_CITIZEN_ID = `8${Math.floor(100000000000 + Math.random() * 899999999999)}`;

  let consumerUserId: bigint;
  let merchantUserId: bigint;
  let merchantId: bigint;
  let consumerWalletId: bigint;
  let merchantWalletId: bigint;
  let merchantOwnerConsumerWalletId: bigint;
  let testProductId: number;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    configService = {
      getOrThrow: (key: string) => {
        if (key === 'JWT_SECRET') {
          return process.env.JWT_SECRET || 'concurrency_jwt_test_secret_key_32bytes_long!';
        }
        return process.env[key] || '';
      },
      get: (key: string) => process.env[key],
    } as unknown as ConfigService;

    const mockQuestsService = {
      evaluateOrder: vi.fn().mockResolvedValue(undefined),
    } as unknown as QuestsService;

    orderService = new OrderService(prisma, configService, mockQuestsService);
    walletService = new WalletService(prisma);

    // 1. Create Test Consumer User & Consumer Wallet
    const consumerUser = await prisma.user.create({
      data: {
        citizenId: CONSUMER_CITIZEN_ID,
        title: 'นาย',
        firstName: 'ทดสอบ',
        lastName: `ผู้บริโภค_${TEST_PREFIX}`,
        fullName: `นาย ทดสอบ ผู้บริโภค_${TEST_PREFIX}`,
        phone: '0811111111',
        passwordHash: 'dummy_hash',
        status: 'ACTIVE',
        roles: {
          create: [{ role: 'CONSUMER', status: 'ACTIVE' }],
        },
      },
    });
    consumerUserId = consumerUser.userId;

    const consumerWallet = await prisma.wallet.create({
      data: {
        user: { connect: { userId: consumerUserId } },
        walletType: 'CONSUMER',
        personalBalance: new Prisma.Decimal(1000),
        subsidyBalance: new Prisma.Decimal(0),
        status: 'ACTIVE',
      },
    });
    consumerWalletId = consumerWallet.walletId;

    // 2. Create Test Merchant User (has MERCHANT and CONSUMER roles for withdrawal)
    const merchantUser = await prisma.user.create({
      data: {
        citizenId: MERCHANT_CITIZEN_ID,
        title: 'นาง',
        firstName: 'ทดสอบ',
        lastName: `ร้านค้า_${TEST_PREFIX}`,
        fullName: `นาง ทดสอบ ร้านค้า_${TEST_PREFIX}`,
        phone: '0822222222',
        passwordHash: 'dummy_hash',
        status: 'ACTIVE',
        roles: {
          create: [
            { role: 'MERCHANT', status: 'ACTIVE' },
            { role: 'CONSUMER', status: 'ACTIVE' },
          ],
        },
      },
    });
    merchantUserId = merchantUser.userId;

    // Merchant owner's personal consumer wallet (to receive withdrawn funds)
    const ownerConsumerWallet = await prisma.wallet.create({
      data: {
        user: { connect: { userId: merchantUserId } },
        walletType: 'CONSUMER',
        personalBalance: new Prisma.Decimal(0),
        subsidyBalance: new Prisma.Decimal(0),
        status: 'ACTIVE',
      },
    });
    merchantOwnerConsumerWalletId = ownerConsumerWallet.walletId;

    // Merchant Record
    const merchant = await prisma.merchant.create({
      data: {
        ownerUserId: merchantUserId,
        merchantName: `ร้านทดสอบ_${TEST_PREFIX}`,
        merchantTypes: ['FOOD_BEVERAGE'],
        status: 'ACTIVE',
        address: '123 ถนนทดสอบ',
      },
    });
    merchantId = merchant.merchantId;

    // Merchant Membership (OWNER)
    await prisma.merchantMember.create({
      data: {
        merchantId,
        userId: merchantUserId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    // Merchant Business Wallet
    const merchantWallet = await prisma.wallet.create({
      data: {
        merchant: { connect: { merchantId: merchantId } },
        walletType: 'MERCHANT',
        personalBalance: new Prisma.Decimal(0),
        merchantBalance: new Prisma.Decimal(0),
        subsidyBalance: new Prisma.Decimal(0),
        status: 'ACTIVE',
      },
    });
    merchantWalletId = merchantWallet.walletId;

    // Test Product
    const category =
      (await prisma.productCategory.findFirst()) ||
      (await prisma.productCategory.create({
        data: { categoryName: 'อาหารและเครื่องดื่ม' },
      }));

    const product = await prisma.product.create({
      data: {
        merchantId,
        categoryId: category.categoryId,
        productName: 'กะเพราไก่',
        price: new Prisma.Decimal(100),
        status: 'ACTIVE',
      },
    });
    testProductId = Number(product.productId);
  }, 60_000);

  afterAll(async () => {
    try {
      if (consumerUserId || merchantUserId || merchantId) {
        await prisma.walletTransaction.deleteMany({
          where: {
            OR: [
              { walletId: consumerWalletId },
              { walletId: merchantWalletId },
              { walletId: merchantOwnerConsumerWalletId },
            ],
          },
        });
        await prisma.orderItem.deleteMany({
          where: { order: { merchantId } },
        });
        await prisma.product.deleteMany({
          where: { merchantId },
        });
        await prisma.userCoupon.deleteMany({
          where: { userId: consumerUserId },
        });
        await prisma.coupon.deleteMany({
          where: { merchantId },
        });
        await prisma.order.deleteMany({
          where: { merchantId },
        });
        await prisma.merchantMember.deleteMany({
          where: { merchantId },
        });
        await prisma.wallet.deleteMany({
          where: {
            OR: [
              { walletId: consumerWalletId },
              { walletId: merchantWalletId },
              { walletId: merchantOwnerConsumerWalletId },
            ],
          },
        });
        await prisma.merchant.deleteMany({
          where: { merchantId },
        });
        await prisma.userRole.deleteMany({
          where: {
            userId: { in: [consumerUserId, merchantUserId] },
          },
        });
        await prisma.user.deleteMany({
          where: {
            userId: { in: [consumerUserId, merchantUserId] },
          },
        });
      }
    } catch {
      // Ignore cleanup error in test tear-down
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);

  it('Scenario 1: Prevents double-payment under 5 concurrent payment attempts on the same order', async () => {
    // Reset consumer wallet to 1,000 THB, merchant wallet to 0 THB
    await prisma.wallet.update({
      where: { walletId: consumerWalletId },
      data: { personalBalance: new Prisma.Decimal(1000) },
    });
    await prisma.wallet.update({
      where: { walletId: merchantWalletId },
      data: { merchantBalance: new Prisma.Decimal(0) },
    });

    // Create an order of 100 THB
    const createdOrder = await orderService.createOrder(merchantId, {
      items: [
        {
          productId: testProductId,
          quantity: 1,
        },
      ],
    });

    const qrToken = createdOrder.qrToken;

    // Fire 5 concurrent payment requests on the SAME QR token
    const CONCURRENCY = 5;
    const paymentPromises = Array.from({ length: CONCURRENCY }, () =>
      orderService.payByQr(consumerUserId, { qrToken }),
    );

    const results = await Promise.allSettled(paymentPromises);

    // Filter fulfilled outcomes
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // Check order state in DB
    const finalOrder = await prisma.order.findUniqueOrThrow({
      where: { orderId: BigInt(createdOrder.orderId) },
    });
    expect(finalOrder.status).toBe('PAID');

    // Invariant: Consumer must be charged EXACTLY 100 THB, NOT 500 THB
    const finalConsumerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { walletId: consumerWalletId },
    });
    expect(finalConsumerWallet.personalBalance.toNumber()).toBe(900);

    // Invariant: Merchant must receive EXACTLY 100 THB, NOT 500 THB
    const finalMerchantWallet = await prisma.wallet.findUniqueOrThrow({
      where: { walletId: merchantWalletId },
    });
    expect(finalMerchantWallet.merchantBalance.toNumber()).toBe(100);

    // Invariant: Exactly 1 payment transaction debited from consumer
    const debitTxs = await prisma.walletTransaction.findMany({
      where: {
        walletId: consumerWalletId,
        orderId: BigInt(createdOrder.orderId),
      },
    });
    expect(debitTxs.length).toBe(1);
    expect(debitTxs[0].amount.toNumber()).toBe(100);
  });

  it('Scenario 2: Single-Use Coupon Race — 2 concurrent orders competing for 1 coupon', async () => {
    // Reset consumer wallet to 1,000 THB
    await prisma.wallet.update({
      where: { walletId: consumerWalletId },
      data: { personalBalance: new Prisma.Decimal(1000) },
    });

    // Create 1 fixed discount coupon (30 THB discount)
    const coupon = await prisma.coupon.create({
      data: {
        merchantId,
        couponName: 'ส่วนลด 30 บาท',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(30),
        pointCost: 10,
        minPurchase: new Prisma.Decimal(50),
        validityDays: 30,
        status: 'ACTIVE',
      },
    });

    // Issue coupon to consumer
    const userCoupon = await prisma.userCoupon.create({
      data: {
        userId: consumerUserId,
        couponId: coupon.couponId,
        status: 'AVAILABLE',
        redeemedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });

    // Create 2 distinct orders for 100 THB each
    const order1 = await orderService.createOrder(merchantId, {
      items: [{ productId: testProductId, quantity: 1 }],
    });
    const order2 = await orderService.createOrder(merchantId, {
      items: [{ productId: testProductId, quantity: 1 }],
    });

    // Fire 2 concurrent payments attempting to use the SAME userCouponId
    const [res1, res2] = await Promise.allSettled([
      orderService.payByQr(consumerUserId, {
        qrToken: order1.qrToken,
        userCouponId: userCoupon.userCouponId.toString(),
      }),
      orderService.payByQr(consumerUserId, {
        qrToken: order2.qrToken,
        userCouponId: userCoupon.userCouponId.toString(),
      }),
    ]);

    // Check database state of the coupon
    const finalUserCoupon = await prisma.userCoupon.findUniqueOrThrow({
      where: { userCouponId: userCoupon.userCouponId },
    });

    // Invariant: Coupon must be marked USED exactly once
    expect(finalUserCoupon.status).toBe('USED');
    expect(finalUserCoupon.usedAt).not.toBeNull();

    // Check which order received the coupon discount
    const dbOrder1 = await prisma.order.findUniqueOrThrow({ where: { orderId: BigInt(order1.orderId) } });
    const dbOrder2 = await prisma.order.findUniqueOrThrow({ where: { orderId: BigInt(order2.orderId) } });

    const discountedOrders = [dbOrder1, dbOrder2].filter(
      (o) => o.userCouponId === userCoupon.userCouponId && o.discountAmount.toNumber() === 30,
    );

    // Invariant: Exactly ONE order received the 30 THB coupon discount
    expect(discountedOrders.length).toBe(1);

    // The other order must have either failed, or was paid at full 100 THB without discount
    if (res1.status === 'fulfilled' && res2.status === 'fulfilled') {
      const nonDiscounted = [dbOrder1, dbOrder2].find(
        (o) => o.orderId !== discountedOrders[0].orderId,
      );
      expect(nonDiscounted?.discountAmount.toNumber()).toBe(0);
    }
  });

  it('Scenario 3: Double-Withdrawal Race — 3 concurrent merchant withdrawals of 500 THB when balance is 500 THB', async () => {
    // Setup merchant wallet with exactly 500 THB
    await prisma.wallet.update({
      where: { walletId: merchantWalletId },
      data: { merchantBalance: new Prisma.Decimal(500) },
    });
    // Reset owner consumer wallet personal balance to 0
    await prisma.wallet.update({
      where: { walletId: merchantOwnerConsumerWalletId },
      data: { personalBalance: new Prisma.Decimal(0) },
    });

    // Fire 3 concurrent withdrawal requests for 500 THB each with different idempotency keys
    const results = await Promise.allSettled([
      walletService.withdrawFromMerchantWallet(
        merchantUserId,
        merchantId,
        { amount: 500, idempotencyKey: `with_key_1_${Date.now()}` },
        merchantId,
      ),
      walletService.withdrawFromMerchantWallet(
        merchantUserId,
        merchantId,
        { amount: 500, idempotencyKey: `with_key_2_${Date.now()}` },
        merchantId,
      ),
      walletService.withdrawFromMerchantWallet(
        merchantUserId,
        merchantId,
        { amount: 500, idempotencyKey: `with_key_3_${Date.now()}` },
        merchantId,
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Invariant: Exactly 1 withdrawal of 500 THB succeeds
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(2);

    // Invariant: Merchant balance is exactly 0 THB (NEVER negative!)
    const finalMerchantWallet = await prisma.wallet.findUniqueOrThrow({
      where: { walletId: merchantWalletId },
    });
    expect(finalMerchantWallet.merchantBalance.toNumber()).toBe(0);

    // Invariant: Consumer wallet received exactly 500 THB
    const finalOwnerConsumerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { walletId: merchantOwnerConsumerWalletId },
    });
    expect(finalOwnerConsumerWallet.personalBalance.toNumber()).toBe(500);
  });

  it('Scenario 4: Negative Balance Prevention — 2 concurrent payments of 100 THB when consumer balance is 150 THB', async () => {
    // Setup consumer wallet with 150 THB
    await prisma.wallet.update({
      where: { walletId: consumerWalletId },
      data: { personalBalance: new Prisma.Decimal(150), subsidyBalance: new Prisma.Decimal(0) },
    });

    // Create 2 separate orders for 100 THB each (total 200 THB > 150 THB balance)
    const orderA = await orderService.createOrder(merchantId, {
      items: [{ productId: testProductId, quantity: 1 }],
    });
    const orderB = await orderService.createOrder(merchantId, {
      items: [{ productId: testProductId, quantity: 1 }],
    });

    // Fire both payments concurrently
    const [resA, resB] = await Promise.allSettled([
      orderService.payByQr(consumerUserId, { qrToken: orderA.qrToken }),
      orderService.payByQr(consumerUserId, { qrToken: orderB.qrToken }),
    ]);

    const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
    const rejected = [resA, resB].filter((r) => r.status === 'rejected');

    // Invariant: Exactly 1 payment can succeed, the other MUST be rejected due to insufficient funds
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Invariant: Consumer wallet balance must be 50 THB (150 - 100), NEVER negative
    const finalConsumerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { walletId: consumerWalletId },
    });
    expect(finalConsumerWallet.personalBalance.toNumber()).toBe(50);
  });
});
