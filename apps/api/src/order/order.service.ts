import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BANGKOK_TZ_OFFSET_HOURS,
  FundType,
  TransactionType,
} from '../wallet/wallet.constants.js';
import { QuestsService } from '../quests/quests.service.js';
import type {
  CreateOrderDto,
  PayByQrDto,
  PreviewOrderDto,
} from './dto/order.dto.js';

const QR_TTL_MS = 10 * 60 * 1000;
const ZERO = new Prisma.Decimal(0);
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

type MoneyInput = Prisma.Decimal | number | string;

type CouponWithDetails = {
  userCouponId: bigint;
  userId: bigint;
  status: string;
  expiresAt: Date;
  coupon: {
    merchantId: bigint | null;
    couponName: string;
    status: string;
    discountType: string;
    discountValue: Prisma.Decimal;
    minPurchase: Prisma.Decimal;
  };
};

type ConfirmationFacts = {
  orderId: bigint;
  consumerId: bigint;
  couponId: bigint | null;
  programId: bigint | null;
  subtotal: MoneyInput;
  discountAmount: MoneyInput;
  finalAmount: MoneyInput;
  subsidyAmount: MoneyInput;
  userPaidAmount: MoneyInput;
  qrExpiresAt: Date | null;
};

function money(value: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

function minMoney(...values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((minimum, value) =>
    value.lessThan(minimum) ? value : minimum,
  );
}

function splitPayment(
  finalAmount: Prisma.Decimal,
  subsidyPercentage: Prisma.Decimal,
  subsidyBalance: Prisma.Decimal,
  dailyCapRemaining: Prisma.Decimal,
): { subsidyAmount: Prisma.Decimal; userPaidAmount: Prisma.Decimal } {
  const configuredShare = finalAmount
    .mul(subsidyPercentage)
    .dividedBy(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_FLOOR);
  const subsidyAmount = Prisma.Decimal.max(
    ZERO,
    minMoney(configuredShare, subsidyBalance, dailyCapRemaining),
  );

  return {
    subsidyAmount,
    userPaidAmount: Prisma.Decimal.max(
      ZERO,
      money(finalAmount.minus(subsidyAmount)),
    ),
  };
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly questsService: QuestsService,
  ) {}

  private paymentConfirmationToken(facts: ConfirmationFacts): string {
    const canonicalFacts = [
      'payment-confirmation-v1',
      facts.orderId.toString(),
      facts.consumerId.toString(),
      facts.couponId?.toString() ?? 'none',
      facts.programId?.toString() ?? 'none',
      money(facts.subtotal).toFixed(2),
      money(facts.discountAmount).toFixed(2),
      money(facts.finalAmount).toFixed(2),
      money(facts.subsidyAmount).toFixed(2),
      money(facts.userPaidAmount).toFixed(2),
      facts.qrExpiresAt?.toISOString() ?? 'none',
    ].join('|');

    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(canonicalFacts)
      .digest('hex');
  }

  private assertPaymentConfirmation(
    receivedToken: string,
    facts: ConfirmationFacts,
  ): void {
    const expectedToken = this.paymentConfirmationToken(facts);
    const receivedBuffer = Buffer.from(receivedToken, 'hex');
    const expectedBuffer = Buffer.from(expectedToken, 'hex');

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new ConflictException(
        'ข้อมูลการชำระเงินเปลี่ยนแปลง กรุณาตรวจสอบรายการอีกครั้ง',
      );
    }
  }

  private getBangkokDayBoundaries(now = new Date()): {
    startOfDayUtc: Date;
    endOfDayUtc: Date;
  } {
    const offsetMs = BANGKOK_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const bangkokNow = new Date(now.getTime() + offsetMs);
    const startOfDayUtc = new Date(
      Date.UTC(
        bangkokNow.getUTCFullYear(),
        bangkokNow.getUTCMonth(),
        bangkokNow.getUTCDate(),
      ) - offsetMs,
    );
    const endOfDayUtc = new Date(
      Date.UTC(
        bangkokNow.getUTCFullYear(),
        bangkokNow.getUTCMonth(),
        bangkokNow.getUTCDate(),
        23,
        59,
        59,
        999,
      ) - offsetMs,
    );
    return { startOfDayUtc, endOfDayUtc };
  }

  private applyCouponDiscount(
    subtotal: Prisma.Decimal,
    coupon: CouponWithDetails | null,
  ): Prisma.Decimal {
    if (!coupon) {
      return ZERO;
    }

    if (subtotal.lessThan(coupon.coupon.minPurchase)) {
      throw new BadRequestException('ยอดซื้อไม่ถึงขั้นต่ำของคูปอง');
    }

    if (coupon.coupon.discountType === 'FIXED') {
      return minMoney(money(coupon.coupon.discountValue), subtotal);
    }

    if (coupon.coupon.discountType === 'PERCENTAGE') {
      const percentageDiscount = money(
        subtotal.mul(coupon.coupon.discountValue).dividedBy(100),
      );
      return minMoney(percentageDiscount, subtotal);
    }

    throw new BadRequestException('ประเภทส่วนลดของคูปองไม่ถูกต้อง');
  }

  private paymentResponse(
    order: {
      orderId: bigint;
      status: string;
      subtotal: MoneyInput;
      discountAmount: MoneyInput;
      finalAmount: MoneyInput;
      subsidyAmount: MoneyInput;
      userPaidAmount: MoneyInput;
      paidAt: Date | null;
    },
    isIdempotentReplay: boolean,
  ) {
    if (!order.paidAt) {
      throw new ConflictException('ข้อมูลการชำระเงินไม่สมบูรณ์');
    }

    return {
      success: true,
      isIdempotentReplay,
      orderId: order.orderId.toString(),
      status: order.status,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
      subsidyAmount: Number(order.subsidyAmount),
      userPaidAmount: Number(order.userPaidAmount),
      paidAt: order.paidAt,
    };
  }

  private validateCoupon(
    coupon: CouponWithDetails,
    consumerId: bigint,
    merchantId: bigint,
    now: Date,
  ): void {
    if (coupon.userId !== consumerId) {
      throw new ForbiddenException('คูปองนี้ไม่ใช่ของคุณ');
    }
    if (coupon.status !== 'AVAILABLE') {
      throw new BadRequestException('คูปองนี้ถูกใช้ไปแล้วหรือหมดอายุ');
    }
    if (coupon.coupon.status !== 'ACTIVE') {
      throw new BadRequestException('คูปองนี้ไม่พร้อมใช้งาน');
    }
    if (coupon.expiresAt <= now) {
      throw new BadRequestException('คูปองหมดอายุแล้ว');
    }
    if (
      coupon.coupon.merchantId !== null &&
      coupon.coupon.merchantId !== merchantId
    ) {
      throw new BadRequestException('คูปองนี้ใช้กับร้านค้านี้ไม่ได้');
    }
  }

  /** FR-M02: Merchant สร้าง Order และ Generate QR Token */
  async createOrder(merchantId: bigint, dto: CreateOrderDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
    });
    if (!merchant || merchant.status !== 'ACTIVE') {
      throw new ForbiddenException('ร้านค้ายังไม่ได้รับการอนุมัติ');
    }

    const merchantWallet = await this.prisma.wallet.findFirst({
      where: {
        merchantId,
        walletType: 'MERCHANT',
        status: 'ACTIVE',
      },
    });
    if (!merchantWallet) {
      throw new BadRequestException(
        'ร้านค้ายังไม่มีกระเป๋าเงินที่พร้อมรับเงิน',
      );
    }

    const productIds = dto.items.map((item) => BigInt(item.productId));
    const products = await this.prisma.product.findMany({
      where: { productId: { in: productIds }, merchantId, status: 'ACTIVE' },
      include: { category: true },
    });

    if (products.length !== dto.items.length) {
      throw new BadRequestException('สินค้าบางรายการไม่พบหรือไม่พร้อมจำหน่าย');
    }

    const productMap = new Map(
      products.map((product) => [product.productId.toString(), product]),
    );

    let subtotal = ZERO;
    const itemsData = dto.items.map((item) => {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        throw new BadRequestException('สินค้าบางรายการไม่พร้อมจำหน่าย');
      }

      const unitPrice = money(product.price);
      const lineTotal = money(unitPrice.mul(item.quantity));
      subtotal = money(subtotal.plus(lineTotal));

      return {
        productId: product.productId,
        categoryId: product.categoryId,
        productNameSnapshot: product.productName,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const qrToken = randomBytes(32).toString('hex');
    const qrExpiresAt = new Date(Date.now() + QR_TTL_MS);
    const finalAmount = subtotal;

    const order = await this.prisma.$transaction(
      (tx) =>
        tx.order.create({
          data: {
            merchantId,
            subtotal,
            discountAmount: ZERO,
            finalAmount,
            subsidyAmount: ZERO,
            userPaidAmount: finalAmount,
            status: 'PENDING',
            qrToken,
            qrExpiresAt,
            orderItems: {
              createMany: { data: itemsData },
            },
          },
          include: { orderItems: true },
        }),
      TRANSACTION_OPTIONS,
    );

    return {
      orderId: order.orderId.toString(),
      status: order.status,
      subtotal: Number(order.subtotal),
      finalAmount: Number(order.finalAmount),
      qrToken: order.qrToken,
      qrExpiresAt: order.qrExpiresAt,
      items: itemsData.map((item) => ({
        productId: item.productId.toString(),
        productName: item.productNameSnapshot,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  /** FR-C04: Consumer Preview ข้อมูล order ก่อนจ่าย (ไม่ตัดเงิน) */
  async previewOrder(consumerId: bigint, dto: PreviewOrderDto) {
    const { order, coupon, wallet, activeProgram, dailySubsidyRemaining } =
      await this.resolveOrderContext(consumerId, dto.qrToken, dto.userCouponId);

    const subtotal = money(order.subtotal);
    const discountAmount = this.applyCouponDiscount(subtotal, coupon);
    const finalAmount = money(subtotal.minus(discountAmount));
    let subsidyAmount = ZERO;
    let userPaidAmount = finalAmount;

    if (activeProgram && wallet) {
      ({ subsidyAmount, userPaidAmount } = splitPayment(
        finalAmount,
        money(activeProgram.subsidyPercentage),
        money(wallet.subsidyBalance),
        dailySubsidyRemaining,
      ));
    }

    const personalBalance = wallet ? money(wallet.personalBalance) : ZERO;

    return {
      orderId: order.orderId.toString(),
      merchantName: order.merchant.merchantName,
      subtotal: Number(subtotal),
      discountAmount: Number(discountAmount),
      finalAmount: Number(finalAmount),
      subsidyAmount: Number(subsidyAmount),
      userPaidAmount: Number(userPaidAmount),
      personalBalance: Number(personalBalance),
      subsidyBalance: wallet ? Number(wallet.subsidyBalance) : 0,
      canAfford: personalBalance.greaterThanOrEqualTo(userPaidAmount),
      qrExpiresAt: order.qrExpiresAt,
      items: order.orderItems.map((item) => ({
        productName: item.productNameSnapshot,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
      })),
      appliedCoupon: coupon
        ? {
            userCouponId: coupon.userCouponId.toString(),
            couponName: coupon.coupon.couponName,
            discountType: coupon.coupon.discountType,
            discountValue: Number(coupon.coupon.discountValue),
          }
        : null,
    };
  }

  /**
   * FR-C05: Consumer ชำระเงินผ่าน QR Token
   * Order, wallets, coupon, ledgers, and final status are committed atomically.
   */
  async payByQr(consumerId: bigint, dto: PayByQrDto) {
    const orderReference = await this.prisma.order.findUnique({
      where: { qrToken: dto.qrToken },
      select: { orderId: true },
    });
    if (!orderReference) {
      throw new NotFoundException('ไม่พบ QR Code นี้ในระบบ');
    }

    const paymentResult = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ order_id: bigint }>>`
        SELECT "order_id"
        FROM "orders"
        WHERE "order_id" = ${orderReference.orderId}
        FOR UPDATE
      `;

      const lockedOrder = await tx.order.findUnique({
        where: { orderId: orderReference.orderId },
        include: { merchant: { select: { status: true } } },
      });
      if (!lockedOrder) {
        throw new NotFoundException('ไม่พบ Order นี้ในระบบ');
      }

      if (lockedOrder.status === 'PAID') {
        if (lockedOrder.userId !== consumerId) {
          throw new ConflictException('Order นี้ถูกชำระโดยผู้ใช้อื่นแล้ว');
        }
        if (
          dto.userCouponId &&
          lockedOrder.userCouponId?.toString() !== dto.userCouponId
        ) {
          throw new ConflictException('ข้อมูลคูปองไม่ตรงกับรายการชำระเงินเดิม');
        }
        return this.paymentResponse(lockedOrder, true);
      }

      if (lockedOrder.status !== 'PENDING') {
        throw new ConflictException('Order นี้ไม่อยู่ในสถานะที่ชำระเงินได้');
      }

      const now = new Date();
      if (lockedOrder.qrExpiresAt && lockedOrder.qrExpiresAt <= now) {
        throw new BadRequestException('QR Code หมดอายุแล้ว');
      }
      if (lockedOrder.merchant.status !== 'ACTIVE') {
        throw new ForbiddenException('ร้านค้าไม่พร้อมให้บริการ');
      }

      const consumerWalletRows = await tx.$queryRaw<
        Array<{ wallet_id: bigint }>
      >`
        SELECT "wallet_id"
        FROM "wallets"
        WHERE "user_id" = ${consumerId}
        FOR UPDATE
      `;
      const consumerWalletId = consumerWalletRows[0]?.wallet_id;
      if (!consumerWalletId) {
        throw new BadRequestException('ไม่พบกระเป๋าเงิน');
      }

      const lockedWallet = await tx.wallet.findUnique({
        where: { walletId: consumerWalletId },
      });
      if (!lockedWallet || lockedWallet.status !== 'ACTIVE') {
        throw new BadRequestException('กระเป๋าเงินไม่อยู่ในสถานะที่ใช้งานได้');
      }

      let coupon: CouponWithDetails | null = null;
      if (dto.userCouponId) {
        const couponId = BigInt(dto.userCouponId);
        await tx.$queryRaw<Array<{ user_coupon_id: bigint }>>`
          SELECT "user_coupon_id"
          FROM "user_coupons"
          WHERE "user_coupon_id" = ${couponId}
          FOR UPDATE
        `;
        coupon = await tx.userCoupon.findUnique({
          where: { userCouponId: couponId },
          include: {
            coupon: {
              select: {
                merchantId: true,
                couponName: true,
                status: true,
                discountType: true,
                discountValue: true,
                minPurchase: true,
              },
            },
          },
        });
        if (!coupon) {
          throw new NotFoundException('ไม่พบคูปองที่ระบุ');
        }
        this.validateCoupon(coupon, consumerId, lockedOrder.merchantId, now);
      }

      const activeProgram = await tx.subsidyProgram.findFirst({
        where: {
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });

      let dailySubsidyRemaining = ZERO;
      if (activeProgram) {
        const { startOfDayUtc, endOfDayUtc } =
          this.getBangkokDayBoundaries(now);
        const todaySubsidyTransactions = await tx.walletTransaction.findMany({
          where: {
            walletId: lockedWallet.walletId,
            fundType: FundType.SUBSIDY,
            transactionType: TransactionType.PAYMENT_SUBSIDY,
            createdAt: { gte: startOfDayUtc, lte: endOfDayUtc },
          },
          select: { amount: true },
        });
        const dailySubsidyUsed = todaySubsidyTransactions.reduce(
          (sum, transaction) => sum.plus(transaction.amount),
          ZERO,
        );
        dailySubsidyRemaining = Prisma.Decimal.max(
          ZERO,
          minMoney(
            money(lockedWallet.subsidyBalance),
            money(activeProgram.dailySubsidyLimit).minus(dailySubsidyUsed),
          ),
        );
      }

      const subtotal = money(lockedOrder.subtotal);
      const discountAmount = this.applyCouponDiscount(subtotal, coupon);
      const finalAmount = money(subtotal.minus(discountAmount));
      let subsidyAmount = ZERO;
      let userPaidAmount = finalAmount;
      if (activeProgram) {
        ({ subsidyAmount, userPaidAmount } = splitPayment(
          finalAmount,
          money(activeProgram.subsidyPercentage),
          money(lockedWallet.subsidyBalance),
          dailySubsidyRemaining,
        ));
      }

      const personalBalance = money(lockedWallet.personalBalance);
      const subsidyBalance = money(lockedWallet.subsidyBalance);
      if (personalBalance.lessThan(userPaidAmount)) {
        throw new BadRequestException('ยอดเงินในกระเป๋าไม่เพียงพอ');
      }
      if (subsidyBalance.lessThan(subsidyAmount)) {
        throw new BadRequestException('ยอดเงินอุดหนุนไม่เพียงพอ');
      }

      const merchantWalletRows = await tx.$queryRaw<
        Array<{ wallet_id: bigint }>
      >`
        SELECT "wallet_id"
        FROM "wallets"
        WHERE "merchant_id" = ${lockedOrder.merchantId}
        FOR UPDATE
      `;
      const merchantWalletId = merchantWalletRows[0]?.wallet_id;
      if (!merchantWalletId) {
        throw new BadRequestException('ไม่พบกระเป๋าเงินของร้านค้า');
      }

      const merchantWallet = await tx.wallet.findUnique({
        where: { walletId: merchantWalletId },
      });
      if (!merchantWallet || merchantWallet.status !== 'ACTIVE') {
        throw new BadRequestException('กระเป๋าเงินร้านค้าไม่พร้อมใช้งาน');
      }

      const personalAfter = money(personalBalance.minus(userPaidAmount));
      const subsidyAfter = money(subsidyBalance.minus(subsidyAmount));
      const merchantBalanceBefore = money(merchantWallet.merchantBalance);
      const merchantBalanceAfter = money(
        merchantBalanceBefore.plus(finalAmount),
      );
      const correlationId = randomUUID();

      await tx.wallet.update({
        where: { walletId: lockedWallet.walletId },
        data: {
          personalBalance: personalAfter,
          subsidyBalance: subsidyAfter,
          version: { increment: 1 },
          updatedAt: now,
        },
      });

      if (userPaidAmount.greaterThan(ZERO)) {
        await tx.walletTransaction.create({
          data: {
            walletId: lockedWallet.walletId,
            orderId: lockedOrder.orderId,
            userId: consumerId,
            programId: activeProgram?.programId ?? null,
            fundType: FundType.PERSONAL,
            transactionType: TransactionType.PAYMENT_PERSONAL,
            amount: userPaidAmount,
            balanceBefore: personalBalance,
            balanceAfter: personalAfter,
            businessRef: `payment:${lockedOrder.orderId}:personal`,
            correlationId,
            walletTypeSnapshot: 'CONSUMER',
          },
        });
      }

      if (subsidyAmount.greaterThan(ZERO)) {
        await tx.walletTransaction.create({
          data: {
            walletId: lockedWallet.walletId,
            orderId: lockedOrder.orderId,
            userId: consumerId,
            programId: activeProgram?.programId ?? null,
            fundType: FundType.SUBSIDY,
            transactionType: TransactionType.PAYMENT_SUBSIDY,
            amount: subsidyAmount,
            balanceBefore: subsidyBalance,
            balanceAfter: subsidyAfter,
            businessRef: `payment:${lockedOrder.orderId}:subsidy`,
            correlationId,
            walletTypeSnapshot: 'CONSUMER',
          },
        });
      }

      await tx.wallet.update({
        where: { walletId: merchantWallet.walletId },
        data: {
          merchantBalance: merchantBalanceAfter,
          version: { increment: 1 },
          updatedAt: now,
        },
      });

      if (finalAmount.greaterThan(ZERO)) {
        await tx.walletTransaction.create({
          data: {
            walletId: merchantWallet.walletId,
            orderId: lockedOrder.orderId,
            programId: activeProgram?.programId ?? null,
            fundType: FundType.MERCHANT,
            transactionType: TransactionType.MERCHANT_SALE_CREDIT,
            amount: finalAmount,
            balanceBefore: merchantBalanceBefore,
            balanceAfter: merchantBalanceAfter,
            businessRef: `payment:${lockedOrder.orderId}:merchant`,
            correlationId,
            walletTypeSnapshot: 'MERCHANT',
            metadata: { consumerId: consumerId.toString() },
          },
        });
      }

      if (coupon) {
        const couponUpdate = await tx.userCoupon.updateMany({
          where: {
            userCouponId: coupon.userCouponId,
            userId: consumerId,
            status: 'AVAILABLE',
          },
          data: {
            status: 'USED',
            usedAt: now,
            usedOrderId: lockedOrder.orderId,
          },
        });
        if (couponUpdate.count !== 1) {
          throw new ConflictException('คูปองถูกใช้ไปแล้ว');
        }
      }

      const paidOrder = await tx.order.update({
        where: { orderId: lockedOrder.orderId },
        data: {
          status: 'PAID',
          userId: consumerId,
          walletId: lockedWallet.walletId,
          programId: activeProgram?.programId ?? null,
          userCouponId: coupon?.userCouponId ?? null,
          discountAmount,
          finalAmount,
          subsidyAmount,
          userPaidAmount,
          paidAt: now,
        },
      });

      this.logger.log(
        `Payment success: orderId=${lockedOrder.orderId}, consumer=${consumerId}`,
      );

      return this.paymentResponse(paidOrder, false);
    }, TRANSACTION_OPTIONS);

    if (!paymentResult.isIdempotentReplay) {
      try {
        await this.questsService.evaluateOrder(orderReference.orderId);
      } catch (error) {
        this.logger.error(
          `Quest evaluation failed for order ${orderReference.orderId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return paymentResult;
  }

  /** FR-M02: Merchant ดูรายการ orders ของร้าน */
  async listMerchantOrders(merchantId: bigint) {
    const orders = await this.prisma.order.findMany({
      where: { merchantId },
      include: {
        orderItems: true,
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return orders.map((order) => ({
      orderId: order.orderId.toString(),
      status: order.status,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
      subsidyAmount: Number(order.subsidyAmount),
      userPaidAmount: Number(order.userPaidAmount),
      consumerName: order.user?.fullName ?? null,
      itemCount: order.orderItems.length,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    }));
  }

  private async resolveOrderContext(
    consumerId: bigint,
    qrToken: string,
    userCouponId?: string,
  ) {
    const now = new Date();
    const order = await this.prisma.order.findUnique({
      where: { qrToken },
      include: {
        merchant: { select: { merchantName: true, status: true } },
        orderItems: true,
      },
    });

    if (!order) {
      throw new NotFoundException('ไม่พบ QR Code นี้ในระบบ');
    }
    if (order.status !== 'PENDING') {
      throw new ConflictException('Order นี้ถูกชำระเงินแล้วหรือยกเลิกแล้ว');
    }
    if (order.qrExpiresAt && order.qrExpiresAt <= now) {
      throw new BadRequestException('QR Code หมดอายุแล้ว');
    }
    if (order.merchant.status !== 'ACTIVE') {
      throw new ForbiddenException('ร้านค้าไม่พร้อมให้บริการ');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: consumerId },
    });
    const activeProgram = await this.prisma.subsidyProgram.findFirst({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    let dailySubsidyRemaining = ZERO;
    if (activeProgram && wallet) {
      const { startOfDayUtc, endOfDayUtc } = this.getBangkokDayBoundaries(now);
      const todaySubsidyTransactions =
        await this.prisma.walletTransaction.findMany({
          where: {
            walletId: wallet.walletId,
            fundType: FundType.SUBSIDY,
            transactionType: TransactionType.PAYMENT_SUBSIDY,
            createdAt: { gte: startOfDayUtc, lte: endOfDayUtc },
          },
          select: { amount: true },
        });
      const dailySubsidyUsed = todaySubsidyTransactions.reduce(
        (sum, transaction) => sum.plus(transaction.amount),
        ZERO,
      );
      dailySubsidyRemaining = Prisma.Decimal.max(
        ZERO,
        minMoney(
          money(wallet.subsidyBalance),
          money(activeProgram.dailySubsidyLimit).minus(dailySubsidyUsed),
        ),
      );
    }

    let coupon: CouponWithDetails | null = null;
    if (userCouponId) {
      coupon = await this.prisma.userCoupon.findUnique({
        where: { userCouponId: BigInt(userCouponId) },
        include: {
          coupon: {
            select: {
              merchantId: true,
              couponName: true,
              status: true,
              discountType: true,
              discountValue: true,
              minPurchase: true,
            },
          },
        },
      });
      if (!coupon) {
        throw new NotFoundException('ไม่พบคูปองที่ระบุ');
      }
      this.validateCoupon(coupon, consumerId, order.merchantId, now);
    }

    return {
      order,
      coupon,
      wallet,
      activeProgram,
      dailySubsidyRemaining,
    };
  }
}
