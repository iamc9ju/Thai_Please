import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminController } from '../src/admin/admin.controller.js';
import { AdminService } from '../src/admin/admin.service.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import type { ActiveRole } from '../src/auth/auth.types.js';
import { RolesGuard } from '../src/auth/authorization/roles.guard.js';
import { CatalogController } from '../src/catalog/catalog.controller.js';
import { CatalogService } from '../src/catalog/catalog.service.js';
import { OrderController } from '../src/order/order.controller.js';
import { OrderService } from '../src/order/order.service.js';
import { QuestsController } from '../src/quests/quests.controller.js';
import { QuestsService } from '../src/quests/quests.service.js';
import { RewardsController } from '../src/rewards/rewards.controller.js';
import { RewardsService } from '../src/rewards/rewards.service.js';
import { MerchantWalletController } from '../src/wallet/merchant-wallet.controller.js';
import { WalletController } from '../src/wallet/wallet.controller.js';
import { WalletService } from '../src/wallet/wallet.service.js';

interface SimulatedProduct {
  productId: string;
  merchantId: string;
  productName: string;
  description: string | null;
  price: number;
  status: 'ACTIVE' | 'INACTIVE';
  categoryId: string;
  categoryName: string;
}

interface SimulatedOrderItemSnapshot {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface SimulatedOrder {
  orderId: string;
  merchantId: string;
  merchantName: string;
  consumerId: string | null;
  consumerName: string | null;
  status: 'PENDING' | 'PAID';
  qrToken: string;
  qrExpiresAt: string;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  subsidyAmount: number;
  userPaidAmount: number;
  userCouponId: string | null;
  items: SimulatedOrderItemSnapshot[];
  createdAt: string;
  paidAt: string | null;
}

describe('Platform End-to-End Acceptance Flow (Consumer · Merchant · Admin)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  function createStatefulPlatformHarness() {
    // ── Stateful In-Memory Ledger & Domain Store ──────────────────────────────
    let subsidyProgramStatus: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
    const subsidyPercentage = 50;
    const dailySubsidyLimit = 150;

    let merchantStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' = 'PENDING';
    let merchantBalance = 0;

    let consumerPersonalBalance = 200;
    let consumerSubsidyBalance = 600;
    let consumerPointBalance = 40;

    const topupByKey = new Map<
      string,
      { amount: number; transactionId: string; personalBalance: number }
    >();
    const withdrawalByKey = new Map<
      string,
      {
        amount: number;
        withdrawalId: string;
        merchantBalanceAfter: number;
        consumerPersonalBalanceAfter: number;
      }
    >();

    const categories = new Map<
      string,
      { categoryId: string; categoryName: string; description: string }
    >([
      [
        '1',
        {
          categoryId: '1',
          categoryName: 'อาหารและเครื่องดื่ม',
          description: 'ร้านอาหารชุมชน',
        },
      ],
    ]);

    const products = new Map<string, SimulatedProduct>();
    const orders = new Map<string, SimulatedOrder>();
    const ordersByQr = new Map<string, string>();

    const activeQuests: Array<{
      userQuestId: string;
      questId: string;
      title: string;
      description: string;
      questType: string;
      minSpend: number;
      rewardPoints: number;
      status: 'IN_PROGRESS' | 'COMPLETED';
      completedOrderId: string | null;
      expiresAt: string;
    }> = [];

    const generationLogs: Array<{
      generationId: string;
      requestKey: string;
      userId: string;
      userFullName: string;
      status: string;
      provider: string;
      modelVersion: string;
      questId: string;
      questName: string;
      rewardPoints: number;
    }> = [];

    const pointHistory: Array<{
      pointTxId: string;
      type: 'EARN' | 'REDEEM';
      points: number;
      source: string;
    }> = [];

    const couponCatalogue = [
      {
        couponId: '10',
        couponName: 'คูปองส่วนลด 20 บาท',
        discountType: 'FIXED',
        discountValue: 20,
        minPurchase: 50,
        pointCost: 50,
        status: 'ACTIVE',
      },
    ];

    const userCoupons = new Map<
      string,
      {
        userCouponId: string;
        couponId: string;
        couponName: string;
        discountType: 'FIXED';
        discountValue: number;
        minPurchase: number;
        status: 'AVAILABLE' | 'USED';
        usedOrderId: string | null;
      }
    >();

    let seq = 100;
    const nextId = () => String(++seq);

    // ── Service Implementations Bound to Shared State ─────────────────────────
    const adminService = {
      getPlatformOverview: async () => ({
        users: { total: 3, consumers: 1, merchants: 1, admins: 1 },
        merchants: {
          total: 1,
          pending: merchantStatus === 'PENDING' ? 1 : 0,
          active: merchantStatus === 'ACTIVE' ? 1 : 0,
          rejected: 0,
          suspended: merchantStatus === 'SUSPENDED' ? 1 : 0,
        },
        orders: {
          paidCount: [...orders.values()].filter((o) => o.status === 'PAID')
            .length,
          pendingCount: [...orders.values()].filter(
            (o) => o.status === 'PENDING',
          ).length,
          totalSpend: [...orders.values()]
            .filter((o) => o.status === 'PAID')
            .reduce((s, o) => s + o.finalAmount, 0),
          totalSubsidyUsed: [...orders.values()]
            .filter((o) => o.status === 'PAID')
            .reduce((s, o) => s + o.subsidyAmount, 0),
          totalUserPaid: [...orders.values()]
            .filter((o) => o.status === 'PAID')
            .reduce((s, o) => s + o.userPaidAmount, 0),
          totalDiscount: [...orders.values()]
            .filter((o) => o.status === 'PAID')
            .reduce((s, o) => s + o.discountAmount, 0),
        },
        rewards: {
          pointsIssued: pointHistory
            .filter((p) => p.type === 'EARN')
            .reduce((s, p) => s + p.points, 0),
          pointsRedeemed: pointHistory
            .filter((p) => p.type === 'REDEEM')
            .reduce((s, p) => s + Math.abs(p.points), 0),
          couponsIssued: userCoupons.size,
          couponsUsed: [...userCoupons.values()].filter(
            (c) => c.status === 'USED',
          ).length,
          questsAssigned: activeQuests.length,
          questsCompleted: activeQuests.filter((q) => q.status === 'COMPLETED')
            .length,
        },
        activeProgram: {
          programId: '1',
          programName: 'โครงการคนละครึ่งชุมชน',
          subsidyPercentage,
          dailySubsidyLimit,
          status: subsidyProgramStatus,
        },
      }),
      listSubsidyPrograms: async () => [
        {
          programId: '1',
          programName: 'โครงการคนละครึ่งชุมชน',
          initialGrant: 600,
          subsidyPercentage,
          userPercentage: 50,
          dailySubsidyLimit,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          status: subsidyProgramStatus,
          createdAt: new Date().toISOString(),
        },
      ],
      updateSubsidyProgram: async (
        programId: bigint,
        dto: { status?: string; programName?: string },
      ) => {
        if (programId !== 1n) {
          throw new NotFoundException('ไม่พบโครงการเงินอุดหนุน');
        }
        if (dto.status === 'INACTIVE' || dto.status === 'ACTIVE') {
          subsidyProgramStatus = dto.status;
        }
        return {
          programId: '1',
          programName: dto.programName ?? 'โครงการคนละครึ่งชุมชน',
          initialGrant: 600,
          subsidyPercentage,
          userPercentage: 50,
          dailySubsidyLimit,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          status: subsidyProgramStatus,
          createdAt: new Date().toISOString(),
        };
      },
      updateMerchantStatus: async (merchantId: bigint, nextStatus: string) => {
        if (merchantId !== 201n) {
          throw new NotFoundException('ไม่พบร้านค้า');
        }
        merchantStatus = nextStatus === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
        return {
          success: true,
          merchantId: '201',
          merchantName: 'ร้านป้าสมศรี ข้าวแกงชุมชน',
          previousStatus: 'PENDING',
          status: merchantStatus,
          auditAction: 'MERCHANT_STATUS_CHANGED',
          updatedAt: new Date().toISOString(),
        };
      },
      generatePersonalizedQuestForConsumer: async (consumerId: bigint) => {
        const questId = nextId();
        const userQuestId = nextId();
        const generationId = nextId();
        const questTitle = 'ภารกิจเฉพาะคุณ: อุดหนุนร้านอาหารชุมชนครบ 80 บาท';
        activeQuests.push({
          userQuestId,
          questId,
          title: questTitle,
          description: 'ชำระเงินผ่าน QR ครบ 80 บาทใน 1 ใบเสร็จ รับ 30 พอยต์',
          questType: 'MIN_SPEND',
          minSpend: 80,
          rewardPoints: 30,
          status: 'IN_PROGRESS',
          completedOrderId: null,
          expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        });
        generationLogs.push({
          generationId,
          requestKey: `req-${generationId}`,
          userId: consumerId.toString(),
          userFullName: 'สมชาย ใจดี',
          status: 'ASSIGNED',
          provider: 'POLICY_PERSONALIZED_AI',
          modelVersion: 'thai-please-personalized-v1',
          questId,
          questName: questTitle,
          rewardPoints: 30,
        });
        return {
          generationId,
          requestKey: `req-${generationId}`,
          status: 'ASSIGNED',
          reason: 'ASSIGNED',
          assignmentId: userQuestId,
          questId,
          title: questTitle,
          description: 'ชำระเงินผ่าน QR ครบ 80 บาทใน 1 ใบเสร็จ รับ 30 พอยต์',
          rewardPoints: 30,
          minSpend: 80,
          expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          provider: 'POLICY_PERSONALIZED_AI',
          modelVersion: 'thai-please-personalized-v1',
        };
      },
      listQuestGenerationLogs: async () =>
        generationLogs.map((l) => ({
          ...l,
          promptVersion: 'prompt-v1',
          policyVersion: '2026-04-quest-v1',
          selectionReason: 'PERSONALIZED_HISTORY_MATCH',
          generatedAt: new Date().toISOString(),
        })),
      getRewardMonitoring: async () => ({
        quests: {
          assigned: activeQuests.length,
          inProgress: activeQuests.filter((q) => q.status === 'IN_PROGRESS')
            .length,
          completed: activeQuests.filter((q) => q.status === 'COMPLETED')
            .length,
          expired: 0,
          completionRate:
            activeQuests.length > 0
              ? Math.round(
                  (activeQuests.filter((q) => q.status === 'COMPLETED').length /
                    activeQuests.length) *
                    100,
                )
              : 0,
        },
        points: {
          totalIssued: pointHistory
            .filter((p) => p.type === 'EARN')
            .reduce((s, p) => s + p.points, 0),
          totalRedeemed: pointHistory
            .filter((p) => p.type === 'REDEEM')
            .reduce((s, p) => s + Math.abs(p.points), 0),
          totalExpired: 0,
          expiringWithin30Days: 0,
        },
        coupons: {
          catalogueCount: couponCatalogue.length,
          issued: userCoupons.size,
          available: [...userCoupons.values()].filter(
            (c) => c.status === 'AVAILABLE',
          ).length,
          used: [...userCoupons.values()].filter((c) => c.status === 'USED')
            .length,
          expired: 0,
          usageRate:
            userCoupons.size > 0
              ? Math.round(
                  ([...userCoupons.values()].filter((c) => c.status === 'USED')
                    .length /
                    userCoupons.size) *
                    100,
                )
              : 0,
        },
        recentAssignments: [],
      }),
      getSocialImpactDashboard: async () => {
        const paidOrders = [...orders.values()].filter(
          (o) => o.status === 'PAID',
        );
        const totalFinalSpend = paidOrders.reduce(
          (s, o) => s + o.finalAmount,
          0,
        );
        const totalSubsidyUsed = paidOrders.reduce(
          (s, o) => s + o.subsidyAmount,
          0,
        );
        return {
          metricVersion: 'v1.0.0',
          reportingTimezone: 'Asia/Bangkok',
          asOf: new Date().toISOString(),
          summary: {
            activeConsumers: paidOrders.length > 0 ? 1 : 0,
            participatingMerchants: paidOrders.length > 0 ? 1 : 0,
            successfulOrders: paidOrders.length,
            totalFinalSpend,
            totalSubsidyUsed,
            totalPersonalPaid: paidOrders.reduce(
              (s, o) => s + o.userPaidAmount,
              0,
            ),
            averageSalesPerMerchant: totalFinalSpend,
            questAssigned: activeQuests.length,
            questCompleted: activeQuests.filter((q) => q.status === 'COMPLETED')
              .length,
            questCompletionRate:
              activeQuests.length > 0
                ? Math.round(
                    (activeQuests.filter((q) => q.status === 'COMPLETED')
                      .length /
                      activeQuests.length) *
                      100,
                  )
                : 0,
            pointsIssued: pointHistory
              .filter((p) => p.type === 'EARN')
              .reduce((s, p) => s + p.points, 0),
            pointsRedeemed: pointHistory
              .filter((p) => p.type === 'REDEEM')
              .reduce((s, p) => s + Math.abs(p.points), 0),
            couponsIssued: userCoupons.size,
            couponsUsed: [...userCoupons.values()].filter(
              (c) => c.status === 'USED',
            ).length,
            couponUsageRate:
              userCoupons.size > 0
                ? Math.round(
                    ([...userCoupons.values()].filter(
                      (c) => c.status === 'USED',
                    ).length /
                      userCoupons.size) *
                      100,
                  )
                : 0,
          },
          salesByMerchant: [],
          salesByCategory: [],
          dailyTrend: [],
        };
      },
    };

    const catalogService = {
      listCategories: async () => [...categories.values()],
      listProducts: async (merchantId: bigint, includeInactive = false) => {
        const all = [...products.values()].filter(
          (p) => p.merchantId === merchantId.toString(),
        );
        return includeInactive ? all : all.filter((p) => p.status === 'ACTIVE');
      },
      createProduct: async (
        merchantId: bigint,
        dto: {
          categoryId: string | number;
          productName: string;
          description?: string;
          price: number;
        },
      ) => {
        const cat = categories.get(String(dto.categoryId));
        if (!cat) {
          throw new BadRequestException('ไม่พบหมวดหมู่สินค้า');
        }
        const productId = nextId();
        const created: SimulatedProduct = {
          productId,
          merchantId: merchantId.toString(),
          productName: dto.productName,
          description: dto.description ?? null,
          price: dto.price,
          status: 'ACTIVE',
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
        };
        products.set(productId, created);
        return created;
      },
      updateProduct: async (
        merchantId: bigint,
        productId: bigint,
        dto: {
          productName?: string;
          description?: string;
          price?: number;
          status?: 'ACTIVE' | 'INACTIVE';
        },
      ) => {
        const existing = products.get(productId.toString());
        if (!existing) {
          throw new NotFoundException('ไม่พบสินค้า');
        }
        if (existing.merchantId !== merchantId.toString()) {
          throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขสินค้าของร้านอื่น');
        }
        const updated: SimulatedProduct = {
          ...existing,
          productName: dto.productName ?? existing.productName,
          description:
            dto.description !== undefined
              ? dto.description
              : existing.description,
          price: dto.price ?? existing.price,
          status: dto.status ?? existing.status,
        };
        products.set(existing.productId, updated);
        return updated;
      },
      updateProductStatus: async (
        merchantId: bigint,
        productId: bigint,
        status: 'ACTIVE' | 'INACTIVE',
      ) => {
        const existing = products.get(productId.toString());
        if (!existing) {
          throw new NotFoundException('ไม่พบสินค้า');
        }
        if (existing.merchantId !== merchantId.toString()) {
          throw new ForbiddenException(
            'ไม่มีสิทธิ์แก้ไขสถานะสินค้าของร้านอื่น',
          );
        }
        const updated: SimulatedProduct = { ...existing, status };
        products.set(existing.productId, updated);
        return updated;
      },
    };

    const orderService = {
      createOrder: async (
        merchantId: bigint,
        dto: { items: Array<{ productId: string | number; quantity: number }> },
      ) => {
        if (merchantStatus !== 'ACTIVE') {
          throw new ForbiddenException('ร้านค้ายังไม่ได้รับการอนุมัติ');
        }
        let subtotal = 0;
        const items: SimulatedOrderItemSnapshot[] = dto.items.map((item) => {
          const prod = products.get(String(item.productId));
          if (
            !prod ||
            prod.merchantId !== merchantId.toString() ||
            prod.status !== 'ACTIVE'
          ) {
            throw new BadRequestException(
              'สินค้าบางรายการไม่พบหรือไม่พร้อมจำหน่าย',
            );
          }
          const lineTotal = prod.price * item.quantity;
          subtotal += lineTotal;
          // Store immutable snapshot of productName and unitPrice!
          return {
            productId: prod.productId,
            productName: prod.productName,
            unitPrice: prod.price,
            quantity: item.quantity,
            lineTotal,
          };
        });

        const orderId = nextId();
        const qrToken = `qr-token-${orderId}`;
        const qrExpiresAt = new Date(Date.now() + 600_000).toISOString();
        const createdOrder: SimulatedOrder = {
          orderId,
          merchantId: merchantId.toString(),
          merchantName: 'ร้านป้าสมศรี ข้าวแกงชุมชน',
          consumerId: null,
          consumerName: null,
          status: 'PENDING',
          qrToken,
          qrExpiresAt,
          subtotal,
          discountAmount: 0,
          finalAmount: subtotal,
          subsidyAmount: 0,
          userPaidAmount: subtotal,
          userCouponId: null,
          items,
          createdAt: new Date().toISOString(),
          paidAt: null,
        };
        orders.set(orderId, createdOrder);
        ordersByQr.set(qrToken, orderId);
        return {
          orderId,
          status: 'PENDING',
          subtotal,
          finalAmount: subtotal,
          qrToken,
          qrExpiresAt: new Date(qrExpiresAt),
          items,
        };
      },
      previewOrder: async (
        _consumerId: bigint,
        dto: { qrToken: string; userCouponId?: string },
      ) => {
        const orderId = ordersByQr.get(dto.qrToken);
        const order = orderId ? orders.get(orderId) : undefined;
        if (!order) {
          throw new NotFoundException('ไม่พบ QR Code นี้ในระบบ');
        }
        let discountAmount = 0;
        let appliedCoupon: {
          userCouponId: string;
          couponName: string;
          discountType: string;
          discountValue: number;
        } | null = null;

        if (dto.userCouponId) {
          const uc = userCoupons.get(dto.userCouponId);
          if (!uc || uc.status !== 'AVAILABLE') {
            throw new BadRequestException('คูปองนี้ถูกใช้ไปแล้วหรือหมดอายุ');
          }
          if (order.subtotal < uc.minPurchase) {
            throw new BadRequestException('ยอดซื้อไม่ถึงขั้นต่ำของคูปอง');
          }
          discountAmount = Math.min(uc.discountValue, order.subtotal);
          appliedCoupon = {
            userCouponId: uc.userCouponId,
            couponName: uc.couponName,
            discountType: uc.discountType,
            discountValue: uc.discountValue,
          };
        }

        const finalAmount = Math.max(0, order.subtotal - discountAmount);
        const subsidyAmount =
          subsidyProgramStatus === 'ACTIVE'
            ? Math.min(
                Math.floor((finalAmount * subsidyPercentage) / 100),
                consumerSubsidyBalance,
                dailySubsidyLimit,
              )
            : 0;
        const userPaidAmount = finalAmount - subsidyAmount;

        return {
          orderId: order.orderId,
          merchantName: order.merchantName,
          subtotal: order.subtotal,
          discountAmount,
          finalAmount,
          subsidyAmount,
          userPaidAmount,
          personalBalance: consumerPersonalBalance,
          subsidyBalance: consumerSubsidyBalance,
          canAfford: consumerPersonalBalance >= userPaidAmount,
          qrExpiresAt: new Date(order.qrExpiresAt),
          items: order.items.map((i) => ({
            productName: i.productName,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
          })),
          appliedCoupon,
        };
      },
      payByQr: async (
        consumerId: bigint,
        dto: { qrToken: string; userCouponId?: string },
      ) => {
        const orderId = ordersByQr.get(dto.qrToken);
        const order = orderId ? orders.get(orderId) : undefined;
        if (!order) {
          throw new NotFoundException('ไม่พบ QR Code นี้ในระบบ');
        }
        if (order.status === 'PAID') {
          if (order.consumerId !== consumerId.toString()) {
            throw new ConflictException('Order นี้ถูกชำระโดยผู้ใช้อื่นแล้ว');
          }
          return {
            success: true,
            isIdempotentReplay: true,
            orderId: order.orderId,
            status: order.status,
            subtotal: order.subtotal,
            discountAmount: order.discountAmount,
            finalAmount: order.finalAmount,
            subsidyAmount: order.subsidyAmount,
            userPaidAmount: order.userPaidAmount,
            paidAt: new Date(order.paidAt!),
          };
        }

        let discountAmount = 0;
        if (dto.userCouponId) {
          const uc = userCoupons.get(dto.userCouponId);
          if (!uc || uc.status !== 'AVAILABLE') {
            throw new BadRequestException('คูปองนี้ถูกใช้ไปแล้วหรือหมดอายุ');
          }
          discountAmount = Math.min(uc.discountValue, order.subtotal);
          uc.status = 'USED';
          uc.usedOrderId = order.orderId;
        }

        const finalAmount = Math.max(0, order.subtotal - discountAmount);
        const subsidyAmount =
          subsidyProgramStatus === 'ACTIVE'
            ? Math.min(
                Math.floor((finalAmount * subsidyPercentage) / 100),
                consumerSubsidyBalance,
                dailySubsidyLimit,
              )
            : 0;
        const userPaidAmount = finalAmount - subsidyAmount;

        if (consumerPersonalBalance < userPaidAmount) {
          throw new BadRequestException('ยอดเงินส่วนตัวไม่เพียงพอ');
        }

        // Atomic debit & merchant credit
        consumerPersonalBalance -= userPaidAmount;
        consumerSubsidyBalance -= subsidyAmount;
        merchantBalance += finalAmount;

        order.status = 'PAID';
        order.consumerId = consumerId.toString();
        order.consumerName = 'สมชาย ใจดี';
        order.discountAmount = discountAmount;
        order.finalAmount = finalAmount;
        order.subsidyAmount = subsidyAmount;
        order.userPaidAmount = userPaidAmount;
        order.userCouponId = dto.userCouponId ?? null;
        order.paidAt = new Date().toISOString();

        // Deterministic Quest Rule Engine (FR-S06): evaluate on finalAmount after discount
        for (const q of activeQuests) {
          if (q.status === 'IN_PROGRESS' && finalAmount >= q.minSpend) {
            q.status = 'COMPLETED';
            q.completedOrderId = order.orderId;
            consumerPointBalance += q.rewardPoints;
            pointHistory.push({
              pointTxId: nextId(),
              type: 'EARN',
              points: q.rewardPoints,
              source: q.title,
            });
          }
        }

        return {
          success: true,
          isIdempotentReplay: false,
          orderId: order.orderId,
          status: 'PAID',
          subtotal: order.subtotal,
          discountAmount,
          finalAmount,
          subsidyAmount,
          userPaidAmount,
          paidAt: new Date(order.paidAt),
        };
      },
      getConsumerReceipt: async (consumerId: bigint, orderId: bigint) => {
        const order = orders.get(orderId.toString());
        if (!order || order.status !== 'PAID') {
          throw new NotFoundException('ไม่พบใบเสร็จ');
        }
        if (order.consumerId !== consumerId.toString()) {
          throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงใบเสร็จนี้');
        }
        return {
          orderId: order.orderId,
          receiptNumber: `TP-2569-${order.orderId.padStart(6, '0')}`,
          status: order.status,
          paidAt: order.paidAt,
          merchant: {
            merchantId: order.merchantId,
            merchantName: order.merchantName,
          },
          consumer: {
            fullName: order.consumerName,
            citizenIdMasked: '1-1000-XXXXX-00-1',
          },
          items: order.items,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          finalAmount: order.finalAmount,
          subsidyAmount: order.subsidyAmount,
          userPaidAmount: order.userPaidAmount,
        };
      },
      getMerchantReceipt: async (merchantId: bigint, orderId: bigint) => {
        const order = orders.get(orderId.toString());
        if (!order || order.status !== 'PAID') {
          throw new NotFoundException('ไม่พบใบเสร็จ');
        }
        if (order.merchantId !== merchantId.toString()) {
          throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงใบเสร็จนี้');
        }
        return {
          orderId: order.orderId,
          receiptNumber: `TP-2569-${order.orderId.padStart(6, '0')}`,
          status: order.status,
          paidAt: order.paidAt,
          items: order.items,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          finalAmount: order.finalAmount,
          subsidyAmount: order.subsidyAmount,
          userPaidAmount: order.userPaidAmount,
        };
      },
    };

    const walletService = {
      topUpPersonal: async (
        _userId: bigint,
        dto: { amount: number; idempotencyKey: string },
      ) => {
        const existing = topupByKey.get(dto.idempotencyKey);
        if (existing) {
          if (existing.amount !== dto.amount) {
            throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
          }
          return {
            success: true,
            isIdempotentReplay: true,
            transactionId: existing.transactionId,
            amount: existing.amount,
            personalBalance: existing.personalBalance,
            createdAt: new Date(),
          };
        }
        consumerPersonalBalance += dto.amount;
        const txId = nextId();
        topupByKey.set(dto.idempotencyKey, {
          amount: dto.amount,
          transactionId: txId,
          personalBalance: consumerPersonalBalance,
        });
        return {
          success: true,
          isIdempotentReplay: false,
          transactionId: txId,
          amount: dto.amount,
          personalBalance: consumerPersonalBalance,
          createdAt: new Date(),
        };
      },
      getMerchantWalletOverview: async () => ({
        merchant: {
          merchantId: '201',
          merchantName: 'ร้านป้าสมศรี ข้าวแกงชุมชน',
          merchantTypes: ['FOOD_BEVERAGE'],
          status: merchantStatus,
        },
        wallet: {
          walletId: '801',
          walletType: 'MERCHANT',
          status: 'ACTIVE',
          merchantBalance,
          totalSalesIncome: [...orders.values()]
            .filter((o) => o.status === 'PAID')
            .reduce((s, o) => s + o.finalAmount, 0),
          totalSubsidyPortion: [...orders.values()]
            .filter((o) => o.status === 'PAID')
            .reduce((s, o) => s + o.subsidyAmount, 0),
          totalPersonalPortion: [...orders.values()]
            .filter((o) => o.status === 'PAID')
            .reduce((s, o) => s + o.userPaidAmount, 0),
          totalWithdrawn: [...withdrawalByKey.values()].reduce(
            (s, w) => s + w.amount,
            0,
          ),
          paidOrderCount: [...orders.values()].filter(
            (o) => o.status === 'PAID',
          ).length,
        },
        withdrawalEligibility: {
          canWithdraw: merchantBalance > 0,
          isOwner: true,
          hasActiveConsumerRole: true,
          hasActiveConsumerWallet: true,
          consumerPersonalBalance,
        },
        recentOrderIncomes: [],
      }),
      withdrawFromMerchantWallet: async (
        _userId: bigint,
        _merchantId: bigint,
        dto: { amount: number; idempotencyKey: string },
      ) => {
        const existing = withdrawalByKey.get(dto.idempotencyKey);
        if (existing) {
          return {
            success: true,
            isIdempotentReplay: true,
            withdrawalId: existing.withdrawalId,
            merchantDebitTransactionId: existing.withdrawalId,
            consumerCreditTransactionId: existing.withdrawalId,
            amount: existing.amount,
            merchantBalanceAfter: existing.merchantBalanceAfter,
            consumerPersonalBalanceAfter: existing.consumerPersonalBalanceAfter,
            createdAt: new Date().toISOString(),
          };
        }
        if (dto.amount > merchantBalance) {
          throw new BadRequestException('ยอดเงินในกระเป๋าร้านค้าไม่เพียงพอ');
        }
        merchantBalance -= dto.amount;
        consumerPersonalBalance += dto.amount;
        const withdrawalId = nextId();
        withdrawalByKey.set(dto.idempotencyKey, {
          amount: dto.amount,
          withdrawalId,
          merchantBalanceAfter: merchantBalance,
          consumerPersonalBalanceAfter: consumerPersonalBalance,
        });
        return {
          success: true,
          isIdempotentReplay: false,
          withdrawalId,
          merchantDebitTransactionId: withdrawalId,
          consumerCreditTransactionId: withdrawalId,
          amount: dto.amount,
          merchantBalanceAfter: merchantBalance,
          consumerPersonalBalanceAfter: consumerPersonalBalance,
          createdAt: new Date().toISOString(),
        };
      },
      getMerchantDashboard: async () => {
        const paidOrders = [...orders.values()].filter(
          (o) => o.status === 'PAID',
        );
        return {
          merchantId: '201',
          merchantName: 'ร้านป้าสมศรี ข้าวแกงชุมชน',
          summary: {
            totalSales: paidOrders.reduce((s, o) => s + o.finalAmount, 0),
            orderCount: paidOrders.length,
            pendingOrderCount: [...orders.values()].filter(
              (o) => o.status === 'PENDING',
            ).length,
            averageOrderValue:
              paidOrders.length > 0
                ? paidOrders.reduce((s, o) => s + o.finalAmount, 0) /
                  paidOrders.length
                : 0,
            subsidyReceived: paidOrders.reduce(
              (s, o) => s + o.subsidyAmount,
              0,
            ),
            personalPaymentReceived: paidOrders.reduce(
              (s, o) => s + o.userPaidAmount,
              0,
            ),
            couponOrders: paidOrders.filter((o) => o.userCouponId !== null)
              .length,
            totalCouponDiscount: paidOrders.reduce(
              (s, o) => s + o.discountAmount,
              0,
            ),
            couponUsageRate:
              paidOrders.length > 0
                ? Math.round(
                    (paidOrders.filter((o) => o.userCouponId !== null).length /
                      paidOrders.length) *
                      100,
                  )
                : 0,
          },
          topProducts: [],
          salesTrend: [],
          dataFreshness: {
            asOf: new Date().toISOString(),
            timezone: 'Asia/Bangkok',
            periodDays: 7,
          },
        };
      },
    };

    const questsService = {
      list: async () => ({
        summary: {
          activeCount: activeQuests.filter((q) => q.status === 'IN_PROGRESS')
            .length,
          completedCount: activeQuests.filter((q) => q.status === 'COMPLETED')
            .length,
          totalPointsEarned: activeQuests
            .filter((q) => q.status === 'COMPLETED')
            .reduce((s, q) => s + q.rewardPoints, 0),
        },
        active: activeQuests.filter((q) => q.status === 'IN_PROGRESS'),
        history: activeQuests.filter((q) => q.status === 'COMPLETED'),
      }),
    };

    const rewardsService = {
      getConsumerPoints: async () => ({
        pointBalance: consumerPointBalance,
        expiringSoonPoints: 0,
        transactions: pointHistory.map((p) => ({
          pointTxId: p.pointTxId,
          type: p.type,
          points: p.points,
          source: p.source,
          createdAt: new Date().toISOString(),
          expiresAt: null,
        })),
      }),
      getConsumerCoupons: async () => ({
        pointBalance: consumerPointBalance,
        myCoupons: [...userCoupons.values()].map((c) => ({
          ...c,
          merchantId: null,
          merchantName: null,
          redeemedAt: new Date().toISOString(),
          usedAt: null,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        })),
        catalogue: couponCatalogue.map((c) => ({
          ...c,
          merchantId: null,
          merchantName: null,
          validityDays: 30,
          canRedeem: consumerPointBalance >= c.pointCost,
        })),
      }),
      redeemCoupon: async (_userId: bigint, couponId: bigint) => {
        const catalogueItem = couponCatalogue.find(
          (c) => c.couponId === couponId.toString(),
        );
        if (!catalogueItem) {
          throw new NotFoundException('ไม่พบรายการคูปอง');
        }
        if (consumerPointBalance < catalogueItem.pointCost) {
          throw new BadRequestException('พอยต์ไม่เพียงพอสำหรับการแลกคูปอง');
        }
        consumerPointBalance -= catalogueItem.pointCost;
        const userCouponId = nextId();
        userCoupons.set(userCouponId, {
          userCouponId,
          couponId: catalogueItem.couponId,
          couponName: catalogueItem.couponName,
          discountType: 'FIXED',
          discountValue: catalogueItem.discountValue,
          minPurchase: catalogueItem.minPurchase,
          status: 'AVAILABLE',
          usedOrderId: null,
        });
        pointHistory.push({
          pointTxId: nextId(),
          type: 'REDEEM',
          points: -catalogueItem.pointCost,
          source: catalogueItem.couponName,
        });
        return {
          success: true,
          userCouponId,
          couponId: catalogueItem.couponId,
          couponName: catalogueItem.couponName,
          discountType: 'FIXED',
          discountValue: catalogueItem.discountValue,
          minPurchase: catalogueItem.minPurchase,
          pointsSpent: catalogueItem.pointCost,
          pointBalanceAfter: consumerPointBalance,
          status: 'AVAILABLE',
          redeemedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        };
      },
    };

    return {
      adminService,
      catalogService,
      orderService,
      walletService,
      questsService,
      rewardsService,
    };
  }

  it('executes the complete 4-stage platform lifecycle with RBAC, Immutable Snapshots, Quest Evaluation, Coupon Redemption, and Merchant Withdrawal', async () => {
    const harness = createStatefulPlatformHarness();

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AdminController,
        CatalogController,
        OrderController,
        WalletController,
        MerchantWalletController,
        RewardsController,
        QuestsController,
      ],
      providers: [
        Reflector,
        RolesGuard,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: AdminService, useValue: harness.adminService },
        { provide: CatalogService, useValue: harness.catalogService },
        { provide: OrderService, useValue: harness.orderService },
        { provide: WalletService, useValue: harness.walletService },
        { provide: QuestsService, useValue: harness.questsService },
        { provide: RewardsService, useValue: harness.rewardsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const roleHeader = String(
            req.headers['x-test-role'] ?? 'CONSUMER',
          ).toUpperCase() as ActiveRole;

          req.user = {
            userId:
              roleHeader === 'ADMIN' ? 3n : roleHeader === 'MERCHANT' ? 2n : 1n,
            citizenId:
              roleHeader === 'ADMIN'
                ? '1100000000003'
                : roleHeader === 'MERCHANT'
                  ? '1100000000002'
                  : '1100000000001',
            fullName:
              roleHeader === 'ADMIN'
                ? 'ประสิทธิ์ ชัยชนะ'
                : roleHeader === 'MERCHANT'
                  ? 'ป้าสมศรี ข้าวแกง'
                  : 'สมชาย ใจดี',
            role: roleHeader,
            activeMerchantId: roleHeader === 'MERCHANT' ? 201n : null,
            sessionId: 1n,
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();

    const api = async (
      role: ActiveRole,
      method: string,
      path: string,
      body?: unknown,
    ) => {
      const response = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-test-role': role,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await response.json();
      return { status: response.status, data: json };
    };

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 1: Merchant & Admin (FR-M01, FR-M02, FR-A04)
    // ══════════════════════════════════════════════════════════════════════════

    // 1.1 RBAC Guard Check: Consumer cannot call Admin or Merchant endpoints
    const forbiddenAdmin = await api('CONSUMER', 'GET', '/admin/overview');
    expect(forbiddenAdmin.status).toBe(403);

    // 1.2 Unapproved Merchant cannot create a POS order before Admin approval (FR-M01)
    const createdProductWhilePending = await api(
      'MERCHANT',
      'POST',
      '/merchant/products',
      {
        productName: 'ข้าวกะเพราหมูกรอบ',
        price: 60,
        categoryId: 1,
        description: 'หมูกรอบทอดใหม่ทุกวัน',
      },
    );
    expect(createdProductWhilePending.status).toBe(201);
    const productId = Number(createdProductWhilePending.data.productId);

    const orderBeforeApproval = await api(
      'MERCHANT',
      'POST',
      '/merchant/orders',
      {
        items: [{ productId, quantity: 2 }],
      },
    );
    expect(orderBeforeApproval.status).toBe(403);

    // 1.3 Admin pauses and reactivates Subsidy Program (FR-A04) & approves Merchant (FR-M01)
    const pausedProgram = await api(
      'ADMIN',
      'PATCH',
      '/admin/subsidy-programs/1',
      { status: 'INACTIVE' },
    );
    expect(pausedProgram.status).toBe(200);
    expect(pausedProgram.data.status).toBe('INACTIVE');

    const resumedProgram = await api(
      'ADMIN',
      'PATCH',
      '/admin/subsidy-programs/1',
      { status: 'ACTIVE' },
    );
    expect(resumedProgram.status).toBe(200);
    expect(resumedProgram.data.status).toBe('ACTIVE');

    const approvedMerchant = await api(
      'ADMIN',
      'POST',
      '/admin/merchants/201/approve',
    );
    expect(approvedMerchant.status).toBe(200);
    expect(approvedMerchant.data.status).toBe('ACTIVE');

    // 1.4 Merchant edits product and toggles product status (FR-M02)
    const deactivatedProduct = await api(
      'MERCHANT',
      'PATCH',
      `/merchant/products/${productId}/status`,
      { status: 'INACTIVE' },
    );
    expect(deactivatedProduct.status).toBe(200);
    expect(deactivatedProduct.data.status).toBe('INACTIVE');

    // Inactive product cannot be ordered on POS
    const orderWithInactiveProduct = await api(
      'MERCHANT',
      'POST',
      '/merchant/orders',
      { items: [{ productId, quantity: 1 }] },
    );
    expect(orderWithInactiveProduct.status).toBe(400);

    // Reactivate product and update price to 50 THB
    const editedProduct = await api(
      'MERCHANT',
      'PUT',
      `/merchant/products/${productId}`,
      {
        productName: 'ข้าวกะเพราหมูกรอบพิเศษ',
        price: 50,
        status: 'ACTIVE',
      },
    );
    expect(editedProduct.status).toBe(200);
    expect(editedProduct.data.price).toBe(50);
    expect(editedProduct.data.status).toBe('ACTIVE');

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 2: POS & Consumer Payment + Immutable Receipt (FR-C02..FR-C06, FR-M03..FR-M05)
    // ══════════════════════════════════════════════════════════════════════════

    // 2.1 Admin assigns AI Personalized Quest to Consumer first (minSpend: 80, +30 points) (FR-A05)
    const generatedQuest = await api(
      'ADMIN',
      'POST',
      '/admin/quests/generate-personalized',
      { userId: '1', idempotencyKey: 'e2e-quest-gen-key-001' },
    );
    expect(generatedQuest.status).toBe(201);
    expect(generatedQuest.data).toEqual(
      expect.objectContaining({
        status: 'ASSIGNED',
        rewardPoints: 30,
      }),
    );

    // 2.2 Consumer tops up Personal Balance with Idempotency (FR-C02)
    const topup1 = await api('CONSUMER', 'POST', '/wallet/topup', {
      amount: 300,
      idempotencyKey: 'e2e-topup-key-001',
    });
    expect(topup1.status).toBe(200);
    expect(topup1.data.isIdempotentReplay).toBe(false);
    expect(topup1.data.personalBalance).toBe(500);

    const topupReplay = await api('CONSUMER', 'POST', '/wallet/topup', {
      amount: 300,
      idempotencyKey: 'e2e-topup-key-001',
    });
    expect(topupReplay.status).toBe(200);
    expect(topupReplay.data.isIdempotentReplay).toBe(true);
    expect(topupReplay.data.personalBalance).toBe(500);

    // 2.3 Merchant creates POS Order (2 x 50 = 100 THB) and generates QR Token (FR-M03, FR-M04)
    const createdOrder1 = await api('MERCHANT', 'POST', '/merchant/orders', {
      items: [{ productId, quantity: 2 }],
    });
    expect(createdOrder1.status).toBe(201);
    expect(createdOrder1.data.finalAmount).toBe(100);
    const qrToken1 = createdOrder1.data.qrToken as string;
    const orderId1 = createdOrder1.data.orderId as string;

    // 2.4 Consumer previews QR before paying (FR-C04)
    const preview1 = await api('CONSUMER', 'POST', '/consumer/orders/preview', {
      qrToken: qrToken1,
    });
    expect(preview1.status).toBe(200);
    expect(preview1.data).toEqual(
      expect.objectContaining({
        orderId: orderId1,
        subtotal: 100,
        finalAmount: 100,
        subsidyAmount: 50,
        userPaidAmount: 50,
        canAfford: true,
      }),
    );

    // 2.5 Consumer pays by QR atomically + verifies idempotent retry (FR-C05)
    const paid1 = await api('CONSUMER', 'POST', '/consumer/orders/pay', {
      qrToken: qrToken1,
    });
    expect(paid1.status).toBe(200);
    expect(paid1.data).toEqual(
      expect.objectContaining({
        success: true,
        isIdempotentReplay: false,
        status: 'PAID',
        finalAmount: 100,
        subsidyAmount: 50,
        userPaidAmount: 50,
      }),
    );

    const paid1Replay = await api('CONSUMER', 'POST', '/consumer/orders/pay', {
      qrToken: qrToken1,
    });
    expect(paid1Replay.status).toBe(200);
    expect(paid1Replay.data.isIdempotentReplay).toBe(true);

    // 2.6 Merchant later changes product name & price to 99 THB, but Receipt 1 preserves Immutable Snapshot (FR-C06, FR-M08)
    await api('MERCHANT', 'PUT', `/merchant/products/${productId}`, {
      productName: 'ข้าวกะเพราหมูกรอบพรีเมียม',
      price: 99,
    });

    const consumerReceipt1 = await api(
      'CONSUMER',
      'GET',
      `/consumer/orders/${orderId1}/receipt`,
    );
    expect(consumerReceipt1.status).toBe(200);
    expect(consumerReceipt1.data.items[0]).toEqual(
      expect.objectContaining({
        productName: 'ข้าวกะเพราหมูกรอบพิเศษ',
        unitPrice: 50,
        quantity: 2,
        lineTotal: 100,
      }),
    );

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 3: Quest Completion, Points & Coupon Reuse (FR-S06, FR-C07..FR-C09)
    // ══════════════════════════════════════════════════════════════════════════

    // 3.1 Verify Quest was automatically completed by Order 1 (finalAmount 100 >= minSpend 80) (FR-S06, FR-C07)
    const consumerQuests = await api('CONSUMER', 'GET', '/consumer/quests');
    expect(consumerQuests.status).toBe(200);
    expect(consumerQuests.data.summary.completedCount).toBe(1);
    expect(consumerQuests.data.history[0].completedOrderId).toBe(orderId1);

    // 3.2 Verify Consumer Point Balance increased from 40 -> 70 (+30 quest reward) (FR-C08)
    const consumerPoints = await api('CONSUMER', 'GET', '/consumer/points');
    expect(consumerPoints.status).toBe(200);
    expect(consumerPoints.data.pointBalance).toBe(70);

    // 3.3 Consumer redeems 50 points for a 20 THB discount coupon (FR-C09)
    const redeemedCoupon = await api(
      'CONSUMER',
      'POST',
      '/consumer/coupons/10/redeem',
    );
    expect(redeemedCoupon.status).toBe(200);
    expect(redeemedCoupon.data).toEqual(
      expect.objectContaining({
        success: true,
        discountValue: 20,
        pointsSpent: 50,
        pointBalanceAfter: 20,
      }),
    );
    const userCouponId = redeemedCoupon.data.userCouponId as string;

    // 3.4 Merchant creates Order 2 (1 x 99 THB) and Consumer pays using the redeemed coupon (FR-C04, FR-C05, FR-C09)
    const createdOrder2 = await api('MERCHANT', 'POST', '/merchant/orders', {
      items: [{ productId, quantity: 1 }],
    });
    expect(createdOrder2.status).toBe(201);
    const qrToken2 = createdOrder2.data.qrToken as string;

    const preview2 = await api('CONSUMER', 'POST', '/consumer/orders/preview', {
      qrToken: qrToken2,
      userCouponId,
    });
    expect(preview2.status).toBe(200);
    // 99 subtotal - 20 coupon = 79 finalAmount -> 39 subsidy + 40 personal
    expect(preview2.data).toEqual(
      expect.objectContaining({
        subtotal: 99,
        discountAmount: 20,
        finalAmount: 79,
        subsidyAmount: 39,
        userPaidAmount: 40,
      }),
    );

    const paid2 = await api('CONSUMER', 'POST', '/consumer/orders/pay', {
      qrToken: qrToken2,
      userCouponId,
    });
    expect(paid2.status).toBe(200);
    expect(paid2.data.finalAmount).toBe(79);

    // Single-use invariant: attempting to preview/use the same coupon again fails with 400
    const createdOrder3 = await api('MERCHANT', 'POST', '/merchant/orders', {
      items: [{ productId, quantity: 1 }],
    });
    const reuseCouponAttempt = await api(
      'CONSUMER',
      'POST',
      '/consumer/orders/preview',
      {
        qrToken: createdOrder3.data.qrToken,
        userCouponId,
      },
    );
    expect(reuseCouponAttempt.status).toBe(400);

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 4: Merchant Wallet Withdrawal & Analytics (FR-M06, FR-M07, FR-A01..FR-A07)
    // ══════════════════════════════════════════════════════════════════════════

    // 4.1 Merchant checks wallet balance (Order 1: 100 + Order 2: 79 = 179 THB) (FR-M06)
    const merchantWalletBefore = await api(
      'MERCHANT',
      'GET',
      '/merchant/wallet',
    );
    expect(merchantWalletBefore.status).toBe(200);
    expect(merchantWalletBefore.data.wallet.merchantBalance).toBe(179);

    // 4.2 Merchant Owner withdraws 100 THB to Consumer Personal Wallet with Idempotency (FR-M06)
    const withdrawal = await api(
      'MERCHANT',
      'POST',
      '/merchant/wallet/withdrawals',
      {
        amount: 100,
        idempotencyKey: 'e2e-withdraw-key-001',
      },
    );
    expect(withdrawal.status).toBe(200);
    expect(withdrawal.data).toEqual(
      expect.objectContaining({
        success: true,
        isIdempotentReplay: false,
        amount: 100,
        merchantBalanceAfter: 79,
        consumerPersonalBalanceAfter: 510, // 500 - 50 (Order 1) - 40 (Order 2) + 100 (Withdrawal) = 510
      }),
    );

    // 4.3 Merchant Analytics Dashboard reflects 2 paid orders & 179 THB totalSales (FR-M07)
    const merchantDashboard = await api(
      'MERCHANT',
      'GET',
      '/merchant/dashboard?days=7',
    );
    expect(merchantDashboard.status).toBe(200);
    expect(merchantDashboard.data.summary).toEqual(
      expect.objectContaining({
        totalSales: 179,
        orderCount: 2,
        subsidyReceived: 89,
        personalPaymentReceived: 90,
        couponOrders: 1,
      }),
    );

    // 4.4 Admin Social Impact Dashboard & Reward Monitoring reflect full lifecycle (FR-A06, FR-A07)
    const socialImpact = await api(
      'ADMIN',
      'GET',
      '/admin/dashboard/social-impact?days=14',
    );
    expect(socialImpact.status).toBe(200);
    expect(socialImpact.data.summary).toEqual(
      expect.objectContaining({
        activeConsumers: 1,
        participatingMerchants: 1,
        successfulOrders: 2,
        totalFinalSpend: 179,
        totalSubsidyUsed: 89,
        questAssigned: 1,
        questCompleted: 1,
        questCompletionRate: 100,
        pointsIssued: 30,
        pointsRedeemed: 50,
        couponsIssued: 1,
        couponsUsed: 1,
        couponUsageRate: 100,
      }),
    );
  });
});
