import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthActor } from '../auth/auth.types.js';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import { SystemClock } from '../common/time/clock.js';
import { CatalogService } from '../commerce/catalog.service.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly clock: SystemClock,
  ) {}

  async merchant(actor: AuthActor, merchantId: number): Promise<unknown> {
    await this.catalog.requireMerchant(actor, merchantId);
    const [aggregate, couponOrders, topProducts] = await Promise.all([
      this.prisma.receipt.aggregate({
        where: { merchantId },
        _count: { id: true },
        _sum: { finalAmount: true, subsidyPaid: true, personalPaid: true },
      }),
      this.prisma.order.count({
        where: { merchantId, status: 'PAID', userCouponId: { not: null } },
      }),
      this.prisma.receiptItem.groupBy({
        by: ['productId', 'productName'],
        where: { receipt: { merchantId } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);
    return {
      merchant_id: merchantId,
      transaction_count: aggregate._count.id,
      total_sales: aggregate._sum.finalAmount ?? 0,
      subsidy_received: aggregate._sum.subsidyPaid ?? 0,
      personal_received: aggregate._sum.personalPaid ?? 0,
      coupon_orders: couponOrders,
      top_products: topProducts,
      quest_related_sales: null,
      quest_attribution_status: 'UNRESOLVED_TBD_009',
      metric_version: 'prototype-v1',
      as_of: this.clock.now().toISOString(),
    };
  }

  async socialImpact(actor: AuthActor): Promise<unknown> {
    if (actor.role !== 'ADMIN')
      throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
    const [users, merchants, receipts, quests, points, coupons] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'CONSUMER' } }),
        this.prisma.merchant.count({ where: { active: true } }),
        this.prisma.receipt.aggregate({
          _count: { id: true },
          _sum: { finalAmount: true, subsidyPaid: true },
        }),
        this.prisma.userQuest.groupBy({ by: ['status'], _count: { id: true } }),
        this.prisma.pointLedgerEntry.aggregate({
          where: { type: 'QUEST_REWARD' },
          _sum: { amount: true },
        }),
        this.prisma.userCoupon.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
      ]);
    return {
      consumers: users,
      participating_merchants: merchants,
      successful_transactions: receipts._count.id,
      economic_value: receipts._sum.finalAmount ?? 0,
      subsidy_deployed: receipts._sum.subsidyPaid ?? 0,
      quest_statuses: quests,
      points_issued: points._sum.amount ?? 0,
      coupon_statuses: coupons,
      metric_version: 'prototype-v1',
      reporting_timezone: 'Asia/Bangkok',
      as_of: this.clock.now().toISOString(),
    };
  }
}
