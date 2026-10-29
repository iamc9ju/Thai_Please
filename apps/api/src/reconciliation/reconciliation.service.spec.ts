import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReconciliationService } from './reconciliation.service.js';

describe('ReconciliationService (Invariants & NFR-OBS-01)', () => {
  function createMockPrisma() {
    return {
      wallet: {
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
      },
      walletTransaction: {
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
      },
      pointTransaction: {
        groupBy: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      order: {
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      userCoupon: {
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      userQuest: {
        findMany: vi.fn(),
      },
      auditEvent: {
        create: vi.fn().mockResolvedValue({ auditEventId: 1n }),
      },
    };
  }

  it('reports RECONCILED when all balances match immutable ledger entries', async () => {
    const prisma = createMockPrisma();

    // 1 wallet with 100 personal balance matching last transaction
    prisma.wallet.findMany.mockResolvedValue([
      {
        walletId: 1n,
        userId: 10n,
        merchantId: null,
        walletType: 'CONSUMER',
        personalBalance: new Prisma.Decimal('100.00'),
        subsidyBalance: new Prisma.Decimal('0.00'),
        merchantBalance: new Prisma.Decimal('0.00'),
      },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([
      {
        walletTransactionId: 101n,
        walletId: 1n,
        fundType: 'PERSONAL',
        amount: new Prisma.Decimal('100.00'),
        balanceAfter: new Prisma.Decimal('100.00'),
      },
    ]);

    // 1 user with 50 point balance matching sum of point transactions
    prisma.user.findMany.mockResolvedValue([
      { userId: 10n, citizenId: '1100000000001', pointBalance: 50 },
    ]);
    prisma.pointTransaction.groupBy.mockResolvedValue([
      { userId: 10n, _sum: { points: 50 } },
    ]);

    prisma.order.findMany.mockResolvedValue([]);
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userQuest.findMany.mockResolvedValue([]);

    const service = new ReconciliationService(
      prisma as unknown as PrismaService,
    );
    const report = await service.runReconciliation(1n, 'corr-test-01');

    expect(report.status).toBe('RECONCILED');
    expect(report.summary.isHealthy).toBe(true);
    expect(report.summary.totalDiscrepancies).toBe(0);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'FINANCIAL_RECONCILIATION_RUN',
          result: 'SUCCESS',
          correlationId: 'corr-test-01',
        }),
      }),
    );
  });

  it('detects discrepancy when wallet cached balance diverges from ledger balanceAfter', async () => {
    const prisma = createMockPrisma();

    prisma.wallet.findMany.mockResolvedValue([
      {
        walletId: 1n,
        userId: 10n,
        merchantId: null,
        walletType: 'CONSUMER',
        personalBalance: new Prisma.Decimal('500.00'), // Cached shows 500
        subsidyBalance: new Prisma.Decimal('0.00'),
        merchantBalance: new Prisma.Decimal('0.00'),
      },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([
      {
        walletTransactionId: 101n,
        walletId: 1n,
        fundType: 'PERSONAL',
        amount: new Prisma.Decimal('100.00'),
        balanceAfter: new Prisma.Decimal('100.00'), // Ledger shows 100
      },
    ]);

    prisma.user.findMany.mockResolvedValue([]);
    prisma.pointTransaction.groupBy.mockResolvedValue([]);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userQuest.findMany.mockResolvedValue([]);

    const service = new ReconciliationService(
      prisma as unknown as PrismaService,
    );
    const report = await service.runReconciliation();

    expect(report.status).toBe('DISCREPANCY_DETECTED');
    expect(report.summary.isHealthy).toBe(false);
    expect(report.summary.walletDiscrepanciesCount).toBe(1);
    expect(report.details.walletDiscrepancies[0]).toMatchObject({
      walletId: '1',
      discrepancyType: 'PERSONAL_BALANCE_MISMATCH_WITH_LEDGER',
      expected: 100,
      actual: 500,
      diff: 400,
    });
  });

  it('detects point balance discrepancy when user point_balance does not match sum of points', async () => {
    const prisma = createMockPrisma();

    prisma.wallet.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([
      { userId: 10n, citizenId: '1100000000001', pointBalance: 200 }, // Cached 200
    ]);
    prisma.pointTransaction.groupBy.mockResolvedValue([
      { userId: 10n, _sum: { points: 150 } }, // Ledger sum 150
    ]);

    prisma.order.findMany.mockResolvedValue([]);
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userQuest.findMany.mockResolvedValue([]);

    const service = new ReconciliationService(
      prisma as unknown as PrismaService,
    );
    const report = await service.runReconciliation();

    expect(report.status).toBe('DISCREPANCY_DETECTED');
    expect(report.summary.pointDiscrepanciesCount).toBe(1);
    expect(report.details.pointDiscrepancies[0]).toMatchObject({
      userId: '10',
      actualPointBalance: 200,
      ledgerPointBalance: 150,
      diff: 50,
    });
  });

  it('detects paid order math discrepancy when finalAmount != subsidyAmount + userPaidAmount', async () => {
    const prisma = createMockPrisma();

    prisma.wallet.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.pointTransaction.groupBy.mockResolvedValue([]);
    prisma.order.findMany.mockResolvedValue([
      {
        orderId: 99n,
        finalAmount: new Prisma.Decimal('100.00'),
        subsidyAmount: new Prisma.Decimal('50.00'),
        userPaidAmount: new Prisma.Decimal('40.00'), // 50 + 40 = 90 != 100
        paidAt: new Date(),
      },
    ]);
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userQuest.findMany.mockResolvedValue([]);

    const service = new ReconciliationService(
      prisma as unknown as PrismaService,
    );
    const report = await service.runReconciliation();

    expect(report.status).toBe('DISCREPANCY_DETECTED');
    expect(report.summary.orderDiscrepanciesCount).toBe(1);
    expect(report.details.orderDiscrepancies[0]).toMatchObject({
      orderId: '99',
      issue: 'ORDER_SPLIT_SUM_MISMATCH',
    });
  });
});
