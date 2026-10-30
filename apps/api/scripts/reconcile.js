import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required for running reconciliation');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const startTime = Date.now();

  console.log('====================================================');
  console.log(' THAI CHUAY THAI - FINANCIAL RECONCILIATION RUNNER  ');
  console.log('====================================================');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    // 1. Wallets vs Ledger
    const wallets = await prisma.wallet.findMany();
    const walletDiscrepancies = [];

    for (const w of wallets) {
      const txs = await prisma.walletTransaction.findMany({
        where: { walletId: w.walletId },
        orderBy: [{ createdAt: 'asc' }, { walletTransactionId: 'asc' }],
      });

      if (w.walletType === 'CONSUMER') {
        const pTxs = txs.filter((t) => t.fundType === 'PERSONAL');
        const actualP = Number(w.personalBalance);
        if (pTxs.length > 0) {
          const expectedP = Number(pTxs[pTxs.length - 1].balanceAfter);
          if (Math.abs(actualP - expectedP) > 0.001) {
            walletDiscrepancies.push({
              walletId: w.walletId.toString(),
              type: 'CONSUMER',
              issue: 'PERSONAL_BALANCE_MISMATCH',
              expected: expectedP,
              actual: actualP,
              diff: actualP - expectedP,
            });
          }
        } else if (actualP !== 0) {
          walletDiscrepancies.push({
            walletId: w.walletId.toString(),
            type: 'CONSUMER',
            issue: 'PERSONAL_BALANCE_NONZERO_WITHOUT_TX',
            expected: 0,
            actual: actualP,
            diff: actualP,
          });
        }

        const sTxs = txs.filter((t) => t.fundType === 'SUBSIDY');
        const actualS = Number(w.subsidyBalance);
        if (sTxs.length > 0) {
          const expectedS = Number(sTxs[sTxs.length - 1].balanceAfter);
          if (Math.abs(actualS - expectedS) > 0.001) {
            walletDiscrepancies.push({
              walletId: w.walletId.toString(),
              type: 'CONSUMER',
              issue: 'SUBSIDY_BALANCE_MISMATCH',
              expected: expectedS,
              actual: actualS,
              diff: actualS - expectedS,
            });
          }
        }
      } else if (w.walletType === 'MERCHANT') {
        const mTxs = txs.filter((t) => t.fundType === 'MERCHANT');
        const actualM = Number(w.merchantBalance);
        if (mTxs.length > 0) {
          const expectedM = Number(mTxs[mTxs.length - 1].balanceAfter);
          if (Math.abs(actualM - expectedM) > 0.001) {
            walletDiscrepancies.push({
              walletId: w.walletId.toString(),
              type: 'MERCHANT',
              issue: 'MERCHANT_BALANCE_MISMATCH',
              expected: expectedM,
              actual: actualM,
              diff: actualM - expectedM,
            });
          }
        } else if (actualM !== 0) {
          walletDiscrepancies.push({
            walletId: w.walletId.toString(),
            type: 'MERCHANT',
            issue: 'MERCHANT_BALANCE_NONZERO_WITHOUT_TX',
            expected: 0,
            actual: actualM,
            diff: actualM,
          });
        }
      }
    }

    // 2. Point Balances vs Ledger
    const users = await prisma.user.findMany({
      select: { userId: true, citizenId: true, pointBalance: true },
    });
    const pointSums = await prisma.pointTransaction.groupBy({
      by: ['userId'],
      _sum: { points: true },
    });
    const sumMap = new Map();
    for (const g of pointSums) {
      sumMap.set(g.userId.toString(), g._sum.points ?? 0);
    }
    const pointDiscrepancies = [];
    for (const u of users) {
      const actualPts = u.pointBalance;
      const expectedPts = sumMap.get(u.userId.toString()) ?? 0;
      if (actualPts !== expectedPts || actualPts < 0) {
        pointDiscrepancies.push({
          userId: u.userId.toString(),
          citizenId: u.citizenId,
          expected: expectedPts,
          actual: actualPts,
          diff: actualPts - expectedPts,
        });
      }
    }

    // 3. Paid Orders Consistency
    const paidOrders = await prisma.order.findMany({
      where: { status: 'PAID' },
    });
    const orderDiscrepancies = [];
    for (const o of paidOrders) {
      const finalAmt = Number(o.finalAmount);
      const subAmt = Number(o.subsidyAmount);
      const userAmt = Number(o.userPaidAmount);
      if (Math.abs(finalAmt - (subAmt + userAmt)) > 0.001) {
        orderDiscrepancies.push({
          orderId: o.orderId.toString(),
          issue: `ORDER_SUM_MISMATCH: final (${finalAmt}) != subsidy (${subAmt}) + user (${userAmt})`,
        });
      }
      if (!o.paidAt) {
        orderDiscrepancies.push({
          orderId: o.orderId.toString(),
          issue: 'PAID_ORDER_MISSING_PAID_AT_TIMESTAMP',
        });
      }
    }

    const totalDiscrepancies =
      walletDiscrepancies.length +
      pointDiscrepancies.length +
      orderDiscrepancies.length;

    const durationMs = Date.now() - startTime;

    console.log('------------------ SUMMARY ------------------');
    console.log(`Wallets checked:     ${wallets.length}`);
    console.log(`Users checked:       ${users.length}`);
    console.log(`Paid orders checked: ${paidOrders.length}`);
    console.log(`Duration:            ${durationMs}ms`);
    console.log('---------------------------------------------');

    if (totalDiscrepancies === 0) {
      console.log(' RESULT: 100% RECONCILED (NO DISCREPANCIES DETECTED) ');
      console.log(' All wallet & point balances reconcile with immutable ledgers.');
      console.log('====================================================\n');

      // Record in persistent audit_events
      await prisma.auditEvent.create({
        data: {
          actorRole: 'SYSTEM_CLI',
          action: 'FINANCIAL_RECONCILIATION_RUN',
          targetType: 'SYSTEM',
          targetId: 'ALL',
          result: 'SUCCESS',
          metadata: {
            walletsChecked: wallets.length,
            usersChecked: users.length,
            ordersChecked: paidOrders.length,
            totalDiscrepancies: 0,
            durationMs,
          },
        },
      });

      process.exitCode = 0;
    } else {
      console.error(` RESULT: DISCREPANCY DETECTED (${totalDiscrepancies}) `);
      if (walletDiscrepancies.length > 0) {
        console.error('Wallet Discrepancies:', JSON.stringify(walletDiscrepancies, null, 2));
      }
      if (pointDiscrepancies.length > 0) {
        console.error('Point Discrepancies:', JSON.stringify(pointDiscrepancies, null, 2));
      }
      if (orderDiscrepancies.length > 0) {
        console.error('Order Discrepancies:', JSON.stringify(orderDiscrepancies, null, 2));
      }
      console.error('====================================================\n');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Reconciliation failed with error:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
