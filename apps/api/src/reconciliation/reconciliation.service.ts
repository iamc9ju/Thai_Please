import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CouponDiscrepancy,
  OrderDiscrepancy,
  PointDiscrepancy,
  QuestRewardDiscrepancy,
  ReconciliationReport,
  WalletDiscrepancy,
} from './reconciliation.types.js';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private cachedReport: ReconciliationReport | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * INVARIANTS & NFR-OBS-01: รันการตรวจสอบกระทบยอดทางการเงิน (Reconciliation) แบบครบวงจร
   * ตรวจสอบความสอดคล้องระหว่าง Wallets, Users Point Balance, Immutable Ledgers และ Orders
   */
  async runReconciliation(
    actorUserId?: bigint,
    correlationId?: string,
  ): Promise<ReconciliationReport> {
    const executedAt = new Date().toISOString();
    this.logger.log('Starting financial reconciliation run...');

    const [
      walletDiscrepancies,
      pointDiscrepancies,
      orderDiscrepancies,
      couponDiscrepancies,
      questRewardDiscrepancies,
      stats,
    ] = await Promise.all([
      this.reconcileWallets(),
      this.reconcilePoints(),
      this.reconcilePaidOrders(),
      this.reconcileCoupons(),
      this.reconcileQuestRewards(),
      this.getCounts(),
    ]);

    const totalDiscrepancies =
      walletDiscrepancies.length +
      pointDiscrepancies.length +
      orderDiscrepancies.length +
      couponDiscrepancies.length +
      questRewardDiscrepancies.length;

    const report: ReconciliationReport = {
      status: totalDiscrepancies === 0 ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
      executedAt,
      summary: {
        isHealthy: totalDiscrepancies === 0,
        totalDiscrepancies,
        walletsChecked: stats.walletsCount,
        walletDiscrepanciesCount: walletDiscrepancies.length,
        usersChecked: stats.usersCount,
        pointDiscrepanciesCount: pointDiscrepancies.length,
        ordersChecked: stats.paidOrdersCount,
        orderDiscrepanciesCount: orderDiscrepancies.length,
        couponsChecked: stats.usedCouponsCount,
        couponDiscrepanciesCount: couponDiscrepancies.length,
        questRewardsChecked: stats.questRewardsCount,
        questRewardDiscrepanciesCount: questRewardDiscrepancies.length,
      },
      details: {
        walletDiscrepancies,
        pointDiscrepancies,
        orderDiscrepancies,
        couponDiscrepancies,
        questRewardDiscrepancies,
      },
    };

    // บันทึกลง Persistent Audit Trail (audit_events)
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorUserId,
          actorRole: 'SYSTEM',
          action: 'FINANCIAL_RECONCILIATION_RUN',
          targetType: 'SYSTEM',
          targetId: 'ALL',
          result: report.status === 'RECONCILED' ? 'SUCCESS' : 'FAILED',
          correlationId,
          metadata: report.summary as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (auditErr) {
      this.logger.error(
        'Failed to persist reconciliation audit event',
        auditErr,
      );
    }

    this.cachedReport = report;
    this.logger.log(
      `Reconciliation completed. Status: ${report.status}, Discrepancies: ${totalDiscrepancies}`,
    );

    return report;
  }

  /**
   * ดึงรายงานผลกระทบยอดล่าสุด (ถ้ายังไม่มี ให้รันใหม่)
   */
  async getLatestReport(): Promise<ReconciliationReport> {
    if (this.cachedReport) {
      return this.cachedReport;
    }
    return this.runReconciliation();
  }

  /**
   * 1. ตรวจสอบยอดคงเหลือกระเป๋าเงิน (Wallets) เทียบกับ Ledger (Wallet Transactions)
   */
  private async reconcileWallets(): Promise<WalletDiscrepancy[]> {
    const discrepancies: WalletDiscrepancy[] = [];

    const wallets = await this.prisma.wallet.findMany();

    for (const wallet of wallets) {
      const walletId = wallet.walletId;
      const transactions = await this.prisma.walletTransaction.findMany({
        where: { walletId },
        orderBy: [{ createdAt: 'asc' }, { walletTransactionId: 'asc' }],
      });

      if (wallet.walletType === 'CONSUMER') {
        // ตรวจสอบ Personal Balance
        const personalTxs = transactions.filter(
          (t) => t.fundType === 'PERSONAL',
        );
        const actualPersonal = Number(wallet.personalBalance);

        if (personalTxs.length > 0) {
          const lastTx = personalTxs[personalTxs.length - 1]!;
          const expectedPersonal = Number(lastTx.balanceAfter);
          if (Math.abs(actualPersonal - expectedPersonal) > 0.001) {
            discrepancies.push({
              walletId: walletId.toString(),
              walletType: 'CONSUMER',
              userId: wallet.userId?.toString() ?? null,
              discrepancyType: 'PERSONAL_BALANCE_MISMATCH_WITH_LEDGER',
              expected: expectedPersonal,
              actual: actualPersonal,
              diff: actualPersonal - expectedPersonal,
            });
          }
        } else if (actualPersonal !== 0) {
          discrepancies.push({
            walletId: walletId.toString(),
            walletType: 'CONSUMER',
            userId: wallet.userId?.toString() ?? null,
            discrepancyType: 'PERSONAL_BALANCE_NONZERO_WITHOUT_TRANSACTIONS',
            expected: 0,
            actual: actualPersonal,
            diff: actualPersonal,
          });
        }

        // ตรวจสอบ Subsidy Balance
        const subsidyTxs = transactions.filter((t) => t.fundType === 'SUBSIDY');
        const actualSubsidy = Number(wallet.subsidyBalance);

        if (subsidyTxs.length > 0) {
          const lastTx = subsidyTxs[subsidyTxs.length - 1]!;
          const expectedSubsidy = Number(lastTx.balanceAfter);
          if (Math.abs(actualSubsidy - expectedSubsidy) > 0.001) {
            discrepancies.push({
              walletId: walletId.toString(),
              walletType: 'CONSUMER',
              userId: wallet.userId?.toString() ?? null,
              discrepancyType: 'SUBSIDY_BALANCE_MISMATCH_WITH_LEDGER',
              expected: expectedSubsidy,
              actual: actualSubsidy,
              diff: actualSubsidy - expectedSubsidy,
            });
          }
        }
      } else if (wallet.walletType === 'MERCHANT') {
        // ตรวจสอบ Merchant Balance
        const merchantTxs = transactions.filter(
          (t) => t.fundType === 'MERCHANT',
        );
        const actualMerchant = Number(wallet.merchantBalance);

        if (merchantTxs.length > 0) {
          const lastTx = merchantTxs[merchantTxs.length - 1]!;
          const expectedMerchant = Number(lastTx.balanceAfter);
          if (Math.abs(actualMerchant - expectedMerchant) > 0.001) {
            discrepancies.push({
              walletId: walletId.toString(),
              walletType: 'MERCHANT',
              merchantId: wallet.merchantId?.toString() ?? null,
              discrepancyType: 'MERCHANT_BALANCE_MISMATCH_WITH_LEDGER',
              expected: expectedMerchant,
              actual: actualMerchant,
              diff: actualMerchant - expectedMerchant,
            });
          }
        } else if (actualMerchant !== 0) {
          discrepancies.push({
            walletId: walletId.toString(),
            walletType: 'MERCHANT',
            merchantId: wallet.merchantId?.toString() ?? null,
            discrepancyType: 'MERCHANT_BALANCE_NONZERO_WITHOUT_TRANSACTIONS',
            expected: 0,
            actual: actualMerchant,
            diff: actualMerchant,
          });
        }
      }
    }

    return discrepancies;
  }

  /**
   * 2. ตรวจสอบยอดพอยต์ (Point Balances) เทียบกับประวัติพอยต์ (Point Transactions)
   */
  private async reconcilePoints(): Promise<PointDiscrepancy[]> {
    const discrepancies: PointDiscrepancy[] = [];

    const users = await this.prisma.user.findMany({
      select: { userId: true, citizenId: true, pointBalance: true },
    });

    const pointSums = await this.prisma.pointTransaction.groupBy({
      by: ['userId'],
      _sum: { points: true },
    });

    const sumsByUserId = new Map<string, number>();
    for (const group of pointSums) {
      sumsByUserId.set(group.userId.toString(), group._sum.points ?? 0);
    }

    for (const user of users) {
      const userIdStr = user.userId.toString();
      const actualBalance = user.pointBalance;
      const expectedBalance = sumsByUserId.get(userIdStr) ?? 0;

      if (actualBalance !== expectedBalance) {
        discrepancies.push({
          userId: userIdStr,
          citizenId: user.citizenId,
          actualPointBalance: actualBalance,
          ledgerPointBalance: expectedBalance,
          diff: actualBalance - expectedBalance,
        });
      }

      if (actualBalance < 0) {
        discrepancies.push({
          userId: userIdStr,
          citizenId: user.citizenId,
          actualPointBalance: actualBalance,
          ledgerPointBalance: expectedBalance,
          diff: actualBalance,
        });
      }
    }

    return discrepancies;
  }

  /**
   * 3. ตรวจสอบความถูกต้องของคำสั่งซื้อที่ชำระแล้ว (Paid Orders)
   */
  private async reconcilePaidOrders(): Promise<OrderDiscrepancy[]> {
    const discrepancies: OrderDiscrepancy[] = [];

    const paidOrders = await this.prisma.order.findMany({
      where: { status: 'PAID' },
    });

    for (const order of paidOrders) {
      const finalAmount = Number(order.finalAmount);
      const subsidyAmount = Number(order.subsidyAmount);
      const userPaidAmount = Number(order.userPaidAmount);

      // Invariant: finalAmount === subsidyAmount + userPaidAmount
      if (Math.abs(finalAmount - (subsidyAmount + userPaidAmount)) > 0.001) {
        discrepancies.push({
          orderId: order.orderId.toString(),
          issue: 'ORDER_SPLIT_SUM_MISMATCH',
          details: { finalAmount, subsidyAmount, userPaidAmount },
        });
      }

      if (!order.paidAt) {
        discrepancies.push({
          orderId: order.orderId.toString(),
          issue: 'PAID_ORDER_MISSING_PAID_AT_TIMESTAMP',
        });
      }
    }

    return discrepancies;
  }

  /**
   * 4. ตรวจสอบความถูกต้องของคูปองที่ถูกใช้ (Used Coupons)
   */
  private async reconcileCoupons(): Promise<CouponDiscrepancy[]> {
    const discrepancies: CouponDiscrepancy[] = [];

    const usedCoupons = await this.prisma.userCoupon.findMany({
      where: { status: 'USED' },
      include: { usedOrder: true },
    });

    for (const uc of usedCoupons) {
      if (!uc.usedOrderId) {
        discrepancies.push({
          userCouponId: uc.userCouponId.toString(),
          issue: 'USED_COUPON_MISSING_ORDER_ID',
        });
        continue;
      }

      if (!uc.usedOrder) {
        discrepancies.push({
          userCouponId: uc.userCouponId.toString(),
          issue: 'USED_COUPON_ORDER_NOT_FOUND',
          details: { usedOrderId: uc.usedOrderId.toString() },
        });
        continue;
      }

      if (uc.usedOrder.status !== 'PAID') {
        discrepancies.push({
          userCouponId: uc.userCouponId.toString(),
          issue: 'USED_COUPON_ORDER_NOT_PAID',
          details: {
            usedOrderId: uc.usedOrderId.toString(),
            orderStatus: uc.usedOrder.status,
          },
        });
      }
    }

    return discrepancies;
  }

  /**
   * 5. ตรวจสอบความถูกต้องของการให้รางวัลภารกิจ (Quest Reward Uniqueness)
   */
  private async reconcileQuestRewards(): Promise<QuestRewardDiscrepancy[]> {
    const discrepancies: QuestRewardDiscrepancy[] = [];

    const completedQuests = await this.prisma.userQuest.findMany({
      where: { status: 'COMPLETED' },
      include: { pointTransactions: true },
    });

    for (const uq of completedQuests) {
      const rewardTxs = (
        uq.pointTransactions ? [uq.pointTransactions] : []
      ).filter((t) => t.transactionType === 'QUEST_REWARD');
      if (rewardTxs.length > 1) {
        discrepancies.push({
          userQuestId: uq.userQuestId.toString(),
          issue: 'DUPLICATE_QUEST_REWARDS_DETECTED',
        });
      }
    }

    return discrepancies;
  }

  private async getCounts() {
    const [
      walletsCount,
      usersCount,
      paidOrdersCount,
      usedCouponsCount,
      questRewardsCount,
    ] = await Promise.all([
      this.prisma.wallet.count(),
      this.prisma.user.count(),
      this.prisma.order.count({ where: { status: 'PAID' } }),
      this.prisma.userCoupon.count({ where: { status: 'USED' } }),
      this.prisma.pointTransaction.count({
        where: { transactionType: 'QUEST_REWARD' },
      }),
    ]);

    return {
      walletsCount,
      usersCount,
      paidOrdersCount,
      usedCouponsCount,
      questRewardsCount,
    };
  }
}
