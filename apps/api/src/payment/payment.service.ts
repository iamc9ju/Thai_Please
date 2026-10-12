import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import {
  PROTOTYPE_MONEY,
  PrototypePolicyService,
} from '../common/policy/prototype-policy.service.js';
import { hashCanonical, hashToken } from '../common/security/token.js';
import { SystemClock } from '../common/time/clock.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { isPrismaConcurrencyConflict } from '../infrastructure/database/prisma-errors.js';
import { RewardsService } from '../rewards/rewards.service.js';
import { calculateFinalAmount } from '../commerce/domain/pricing.js';
import { allocateSubsidy } from '../wallet/domain/subsidy-allocation.js';
import { isCouponUsable } from '../rewards/domain/coupon-rule.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PrototypePolicyService,
    private readonly clock: SystemClock,
    private readonly rewards: RewardsService,
  ) {}

  async pay(
    userId: number,
    orderId: number,
    qrToken: string,
    idempotencyKey: string | undefined,
    correlationId: string,
  ): Promise<unknown> {
    if (
      idempotencyKey === undefined ||
      !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
    ) {
      throw new DomainException(
        DOMAIN_ERRORS.invalidIdempotencyKey,
        HttpStatus.BAD_REQUEST,
      );
    }
    const key = idempotencyKey;
    const scope = `payment:${userId}:${orderId}`;
    const requestHash = hashCanonical([userId, orderId, hashToken(qrToken)]);
    const result = await this.runPaymentTransaction(
      userId,
      orderId,
      qrToken,
      scope,
      key,
      requestHash,
      correlationId,
    );
    if (result.receiptId !== undefined) {
      await this.rewards.evaluateReceipt(result.receiptId, correlationId);
    }
    return result.response;
  }

  private async runPaymentTransaction(
    userId: number,
    orderId: number,
    qrToken: string,
    scope: string,
    key: string,
    requestHash: string,
    correlationId: string,
  ): Promise<{ response: unknown; receiptId?: number }> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.idempotencyRecord.findUnique({
            where: { scope_key: { scope, key } },
          });
          if (existing !== null) {
            if (existing.requestHash !== requestHash)
              throw new DomainException(
                DOMAIN_ERRORS.idempotencyConflict,
                HttpStatus.CONFLICT,
              );
            return {
              response: existing.response,
              receiptId: this.receiptIdFromResponse(existing.response),
            };
          }

          await transaction.$queryRaw<
            Array<{ id: number }>
          >`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
          const order = await transaction.order.findUnique({
            where: { id: orderId },
            include: {
              merchant: true,
              items: true,
              userCoupon: { include: { definition: true } },
            },
          });
          if (order === null)
            throw new DomainException(
              DOMAIN_ERRORS.notFound,
              HttpStatus.NOT_FOUND,
            );
          if (order.status === 'PAID')
            throw new DomainException(
              DOMAIN_ERRORS.alreadyPaid,
              HttpStatus.CONFLICT,
            );
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
          if (order.qrExpiresAt === null || order.qrExpiresAt <= now)
            throw new DomainException(DOMAIN_ERRORS.qrExpired, HttpStatus.GONE);
          if (order.userId !== null && order.userId !== userId)
            throw new DomainException(
              DOMAIN_ERRORS.forbidden,
              HttpStatus.FORBIDDEN,
            );

          await transaction.$queryRaw<
            Array<{ id: number }>
          >`SELECT id FROM wallets WHERE user_id = ${userId} FOR UPDATE`;
          const wallet = await transaction.wallet.findUnique({
            where: { userId },
          });
          if (wallet === null)
            throw new DomainException(
              DOMAIN_ERRORS.notFound,
              HttpStatus.NOT_FOUND,
            );
          if (order.userCouponId !== null) {
            await transaction.$queryRaw<
              Array<{ id: number }>
            >`SELECT id FROM user_coupons WHERE id = ${order.userCouponId} FOR UPDATE`;
            if (order.userCoupon === null || order.userCoupon.userId !== userId)
              throw new DomainException(
                DOMAIN_ERRORS.couponInvalid,
                HttpStatus.CONFLICT,
              );
            if (
              !isCouponUsable(
                order.userCoupon.status,
                order.userCoupon.expiresAt,
                now,
              )
            ) {
              if (order.userCoupon.expiresAt <= now)
                throw new DomainException(
                  DOMAIN_ERRORS.couponExpired,
                  HttpStatus.CONFLICT,
                );
              throw new DomainException(
                DOMAIN_ERRORS.couponInvalid,
                HttpStatus.CONFLICT,
              );
            }
          }

          const subtotal = order.items.reduce(
            (sum, item) => sum + item.lineTotal,
            0,
          );
          const priced = calculateFinalAmount(
            subtotal,
            order.userCoupon?.definition.discountAmount ?? 0,
          );
          const { discount, finalAmount } = priced;
          if (
            subtotal !== order.subtotal ||
            discount !== order.discount ||
            finalAmount !== order.finalAmount
          )
            throw new DomainException(
              DOMAIN_ERRORS.invalidOrderState,
              HttpStatus.CONFLICT,
            );

          const bounds = this.policy.bangkokDayBounds(now);
          const subsidyAggregate =
            await transaction.walletLedgerEntry.aggregate({
              where: {
                userId,
                bucket: 'SUBSIDY',
                type: 'PAYMENT',
                occurredAt: { gte: bounds.start, lt: bounds.end },
              },
              _sum: { amount: true },
            });
          const usedToday = Math.abs(subsidyAggregate._sum.amount ?? 0);
          const allocation = allocateSubsidy({
            finalAmount,
            subsidyBalance: wallet.subsidyBalance,
            personalBalance: wallet.personalBalance,
            subsidyUsedToday: usedToday,
            dailySubsidyCap: this.policy.dailySubsidyCap,
            subsidyPercent: this.policy.subsidyPercent,
          });
          const { subsidyPaid, personalPaid } = allocation;
          if (!allocation.sufficient)
            throw new DomainException(
              DOMAIN_ERRORS.insufficientBalance,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );

          const updatedWallet = await transaction.wallet.updateMany({
            where: {
              id: wallet.id,
              personalBalance: { gte: personalPaid },
              subsidyBalance: { gte: subsidyPaid },
            },
            data: {
              personalBalance: { decrement: personalPaid },
              subsidyBalance: { decrement: subsidyPaid },
              version: { increment: 1 },
            },
          });
          if (updatedWallet.count !== 1)
            throw new DomainException(
              DOMAIN_ERRORS.insufficientBalance,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          if (subsidyPaid > 0)
            await transaction.walletLedgerEntry.create({
              data: {
                walletId: wallet.id,
                userId,
                orderId,
                bucket: 'SUBSIDY',
                type: 'PAYMENT',
                amount: -subsidyPaid,
                currency: PROTOTYPE_MONEY.currency,
                businessRef: `payment:${orderId}:subsidy`,
                correlationId,
                occurredAt: now,
              },
            });
          if (personalPaid > 0)
            await transaction.walletLedgerEntry.create({
              data: {
                walletId: wallet.id,
                userId,
                orderId,
                bucket: 'PERSONAL',
                type: 'PAYMENT',
                amount: -personalPaid,
                currency: PROTOTYPE_MONEY.currency,
                businessRef: `payment:${orderId}:personal`,
                correlationId,
                occurredAt: now,
              },
            });

          if (order.userCouponId !== null) {
            const coupon = await transaction.userCoupon.updateMany({
              where: {
                id: order.userCouponId,
                userId,
                status: 'ACTIVE',
                expiresAt: { gt: now },
                usedOrderId: null,
              },
              data: { status: 'USED', usedAt: now, usedOrderId: orderId },
            });
            if (coupon.count !== 1)
              throw new DomainException(
                DOMAIN_ERRORS.couponInvalid,
                HttpStatus.CONFLICT,
              );
          }
          const paid = await transaction.order.updateMany({
            where: {
              id: orderId,
              status: 'CHECKED_OUT',
              OR: [{ userId: null }, { userId }],
            },
            data: {
              status: 'PAID',
              userId,
              subsidyPaid,
              personalPaid,
              paidAt: now,
            },
          });
          if (paid.count !== 1)
            throw new DomainException(
              DOMAIN_ERRORS.alreadyPaid,
              HttpStatus.CONFLICT,
            );
          const receipt = await transaction.receipt.create({
            data: {
              orderId,
              userId,
              merchantId: order.merchantId,
              merchantNameSnapshot: order.merchant.name,
              currency: order.currency,
              subtotal,
              discount,
              finalAmount,
              subsidyPaid,
              personalPaid,
              paidAt: now,
              items: {
                create: order.items.map((item) => ({
                  productId: item.productId,
                  productName: item.productNameSnapshot,
                  categoryId: item.categoryIdSnapshot,
                  categoryName: item.categoryNameSnapshot,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                  currency: item.currency,
                })),
              },
            },
          });
          await transaction.outboxEvent.create({
            data: {
              eventId: randomUUID(),
              type: 'receipt.created.v1',
              schemaVersion: 1,
              aggregateId: String(receipt.id),
              correlationId,
              payload: { receiptId: receipt.id, orderId, userId },
            },
          });
          const response = {
            order_id: orderId,
            receipt_id: receipt.id,
            status: 'PAID',
            subtotal,
            discount,
            final_amount: finalAmount,
            subsidy_paid: subsidyPaid,
            personal_paid: personalPaid,
            currency: order.currency,
            paid_at: now.toISOString(),
          };
          await transaction.idempotencyRecord.create({
            data: {
              scope,
              key,
              requestHash,
              statusCode: HttpStatus.OK,
              response,
            },
          });
          return { response, receiptId: receipt.id };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: unknown) {
      if (isPrismaConcurrencyConflict(error)) {
        const existing = await this.prisma.idempotencyRecord.findUnique({
          where: { scope_key: { scope, key } },
        });
        if (existing !== null && existing.requestHash === requestHash)
          return {
            response: existing.response,
            receiptId: this.receiptIdFromResponse(existing.response),
          };
      }
      throw error;
    }
  }

  private receiptIdFromResponse(response: unknown): number | undefined {
    if (typeof response !== 'object' || response === null) return undefined;
    if (!('receipt_id' in response)) return undefined;
    return typeof response.receipt_id === 'number'
      ? response.receipt_id
      : undefined;
  }
}
