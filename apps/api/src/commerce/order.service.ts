import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthActor } from '../auth/auth.types.js';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import {
  PROTOTYPE_MONEY,
  PrototypePolicyService,
} from '../common/policy/prototype-policy.service.js';
import { createOpaqueToken, hashToken } from '../common/security/token.js';
import { SystemClock } from '../common/time/clock.js';
import { isUnexpired } from '../common/time/expiry.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { CatalogService } from './catalog.service.js';
import { calculateFinalAmount } from './domain/pricing.js';
import { isOrderMutable } from './domain/order-state.js';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly policy: PrototypePolicyService,
    private readonly clock: SystemClock,
  ) {}

  async create(actor: AuthActor, merchantId: number): Promise<unknown> {
    await this.catalog.requireMerchant(actor, merchantId);
    return this.prisma.order.create({
      data: { merchantId, currency: PROTOTYPE_MONEY.currency },
    });
  }

  async addItem(
    actor: AuthActor,
    orderId: number,
    productId: number,
    quantity: number,
  ): Promise<unknown> {
    const order = await this.mutableOrder(actor, orderId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId: order.merchantId, active: true },
      include: { category: true },
    });
    if (product === null)
      throw new DomainException(
        DOMAIN_ERRORS.invalidProduct,
        HttpStatus.BAD_REQUEST,
      );
    return this.prisma.$transaction(async (transaction) => {
      const item = await transaction.orderItem.create({
        data: {
          orderId,
          productId,
          productNameSnapshot: product.name,
          categoryIdSnapshot: product.categoryId,
          categoryNameSnapshot: product.category.name,
          quantity,
          unitPrice: product.price,
          lineTotal: product.price * quantity,
          currency: product.currency,
        },
      });
      await this.reprice(transaction, orderId);
      return item;
    });
  }

  async removeItem(
    actor: AuthActor,
    orderId: number,
    itemId: number,
  ): Promise<unknown> {
    await this.mutableOrder(actor, orderId);
    return this.prisma.$transaction(async (transaction) => {
      const removed = await transaction.orderItem.deleteMany({
        where: { id: itemId, orderId },
      });
      if (removed.count !== 1)
        throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
      await this.reprice(transaction, orderId);
      return { removed: true };
    });
  }

  async applyCoupon(
    actor: AuthActor,
    orderId: number,
    userCouponId: number,
    qrToken: string,
  ): Promise<unknown> {
    if (actor.role !== 'CONSUMER')
      throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (order === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    if (order.status !== 'CHECKED_OUT')
      throw new DomainException(
        DOMAIN_ERRORS.invalidOrderState,
        HttpStatus.CONFLICT,
      );
    const now = this.clock.now();
    if (order.qrTokenHash !== hashToken(qrToken))
      throw new DomainException(
        DOMAIN_ERRORS.qrInvalid,
        HttpStatus.UNAUTHORIZED,
      );
    if (order.qrExpiresAt === null || !isUnexpired(order.qrExpiresAt, now))
      throw new DomainException(DOMAIN_ERRORS.qrExpired, HttpStatus.GONE);
    if (order.userId !== null && order.userId !== actor.userId)
      throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
    const coupon = await this.prisma.userCoupon.findFirst({
      where: {
        id: userCouponId,
        userId: actor.userId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      include: { definition: true },
    });
    if (coupon === null)
      throw new DomainException(
        DOMAIN_ERRORS.couponInvalid,
        HttpStatus.CONFLICT,
      );
    const replacementToken = createOpaqueToken();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.order.update({
        where: { id: orderId },
        data: {
          userId: actor.userId,
          userCouponId,
          qrTokenHash: hashToken(replacementToken),
        },
      });
      await this.reprice(transaction, orderId);
    });
    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        merchant: true,
        userCoupon: { include: { definition: true } },
      },
    });
    return {
      order: updated,
      qr: {
        token: replacementToken,
        expires_at: order.qrExpiresAt.toISOString(),
        payload: `thai-please://pay/${replacementToken}`,
      },
    };
  }

  async checkout(actor: AuthActor, orderId: number): Promise<unknown> {
    await this.mutableOrder(actor, orderId);
    const items = await this.prisma.orderItem.count({ where: { orderId } });
    if (items === 0)
      throw new DomainException(
        DOMAIN_ERRORS.invalidOrderState,
        HttpStatus.BAD_REQUEST,
      );
    const token = createOpaqueToken();
    const now = this.clock.now();
    const qrExpiresAt = this.policy.addSeconds(now, this.policy.qrTtlSeconds);
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CHECKED_OUT',
        qrTokenHash: hashToken(token),
        qrExpiresAt,
        checkedOutAt: now,
      },
      include: { items: true, merchant: true },
    });
    return {
      order: updated,
      qr: {
        token,
        expires_at: qrExpiresAt.toISOString(),
        payload: `thai-please://pay/${token}`,
      },
    };
  }

  async scan(actor: AuthActor, token: string): Promise<unknown> {
    if (actor.role !== 'CONSUMER')
      throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
    const order = await this.prisma.order.findUnique({
      where: { qrTokenHash: hashToken(token) },
      include: {
        merchant: true,
        items: true,
        userCoupon: { include: { definition: true } },
      },
    });
    if (order === null)
      throw new DomainException(DOMAIN_ERRORS.qrInvalid, HttpStatus.NOT_FOUND);
    if (order.status !== 'CHECKED_OUT')
      throw new DomainException(
        DOMAIN_ERRORS.invalidOrderState,
        HttpStatus.CONFLICT,
      );
    if (
      order.qrExpiresAt === null ||
      !isUnexpired(order.qrExpiresAt, this.clock.now())
    )
      throw new DomainException(DOMAIN_ERRORS.qrExpired, HttpStatus.GONE);
    if (order.userId !== null && order.userId !== actor.userId)
      throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
    return order;
  }

  async listForUser(userId: number): Promise<unknown> {
    return this.prisma.order.findMany({
      where: { userId, status: 'PAID' },
      include: { merchant: true },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  async getOrder(
    actor: AuthActor,
    orderId: number,
    enforceMerchant = true,
  ): Promise<unknown> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, items: true },
    });
    if (order === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    if (order.status === 'PAID') {
      if (order.userId !== actor.userId && actor.role !== 'ADMIN')
        throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    } else if (enforceMerchant) {
      await this.catalog.requireMerchant(actor, order.merchantId);
    }
    return order;
  }

  async receipt(userId: number, orderId: number): Promise<unknown> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { orderId, userId },
      include: { items: true },
    });
    if (receipt === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    return receipt;
  }

  async rejectPaidMutation(actor: AuthActor, orderId: number): Promise<never> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (order === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    if (order.status === 'PAID')
      throw new DomainException(
        DOMAIN_ERRORS.paidImmutable,
        HttpStatus.CONFLICT,
      );
    await this.catalog.requireMerchant(actor, order.merchantId);
    throw new DomainException(
      DOMAIN_ERRORS.invalidOrderState,
      HttpStatus.METHOD_NOT_ALLOWED,
    );
  }

  private async mutableOrder(actor: AuthActor, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (order === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    if (order.status === 'PAID')
      throw new DomainException(
        DOMAIN_ERRORS.paidImmutable,
        HttpStatus.CONFLICT,
      );
    if (!isOrderMutable(order.status))
      throw new DomainException(
        DOMAIN_ERRORS.invalidOrderState,
        HttpStatus.CONFLICT,
      );
    await this.catalog.requireMerchant(actor, order.merchantId);
    return order;
  }

  private async reprice(
    transaction: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    orderId: number,
  ): Promise<void> {
    const order = await transaction.order.findUnique({
      where: { id: orderId },
      include: { items: true, userCoupon: { include: { definition: true } } },
    });
    if (order === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    const subtotal = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const priced = calculateFinalAmount(
      subtotal,
      order.userCoupon?.definition.discountAmount ?? 0,
    );
    await transaction.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        discount: priced.discount,
        finalAmount: priced.finalAmount,
      },
    });
  }
}
