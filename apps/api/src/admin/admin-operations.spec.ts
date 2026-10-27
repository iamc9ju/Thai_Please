import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';
import { ADMIN_OPERATION_ERRORS } from './admin.constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const programFixture = () => ({
  programId: 21n,
  programName: 'โครงการทดสอบ',
  initialGrant: 1000,
  subsidyPercentage: 60,
  userPercentage: 40,
  dailySubsidyLimit: 200,
  startDate: new Date('2026-10-01T00:00:00Z'),
  endDate: new Date('2026-12-31T00:00:00Z'),
  status: 'ACTIVE',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  _count: { orders: 0, wallets: 0, walletTransactions: 0 },
});
function makeDatabase() {
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    subsidyProgram: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    merchant: { findUnique: vi.fn(), update: vi.fn() },
    userRole: { upsert: vi.fn() },
    wallet: { create: vi.fn(), update: vi.fn() },
    authSession: { updateMany: vi.fn() },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { pointBalance: 0 } }),
    },
    userQuest: { findMany: vi.fn() },
    pointTransaction: { findMany: vi.fn() },
    userCoupon: { findMany: vi.fn() },
    coupon: { count: vi.fn().mockResolvedValue(0) },
  };
  return {
    ...db,
    $transaction: vi.fn(
      async <T>(operation: (transaction: typeof db) => Promise<T>) =>
        operation(db),
    ),
  };
}
describe('Non-account admin operations', () => {
  let db: ReturnType<typeof makeDatabase>;
  let service: AdminService;
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T00:00:00Z'));
    db = makeDatabase();
    service = new AdminService(db as unknown as PrismaService);
    db.subsidyProgram.findUnique.mockResolvedValue(programFixture());
    db.subsidyProgram.update.mockImplementation(
      async ({ data }: { data: object }) => ({ ...programFixture(), ...data }),
    );
  });

  it('FR-A04 locks before checking references and editing an unused policy', async () => {
    const result = await service.updateSubsidyProgram(
      21n,
      { initialGrant: 2000 },
      1n,
    );
    expect(result.initialGrant).toBe(2000);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.subsidyProgram.findUnique.mock.invocationCallOrder[0] ?? 0,
    );
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.subsidyProgram.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { initialGrant: 2000 } }),
    );
  });

  it.each(['orders', 'wallets', 'walletTransactions'] as const)(
    'FR-A04 rejects changed policy referenced by %s',
    async (kind) => {
      const fixture = programFixture();
      fixture._count[kind] = 1;
      db.subsidyProgram.findUnique.mockResolvedValue(fixture);
      await expect(
        service.updateSubsidyProgram(21n, { subsidyPercentage: 50 }, 1n),
      ).rejects.toThrow(ADMIN_OPERATION_ERRORS.programPolicyInUse);
      expect(db.subsidyProgram.update).not.toHaveBeenCalled();
    },
  );

  it('FR-A04 permits unchanged terms plus lifecycle change on a used program', async () => {
    const fixture = programFixture();
    fixture._count.orders = 1;
    db.subsidyProgram.findUnique.mockResolvedValue(fixture);
    const result = await service.updateSubsidyProgram(
      21n,
      {
        initialGrant: 1000,
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        status: 'INACTIVE',
      },
      1n,
    );
    expect(result.status).toBe('INACTIVE');
    expect(result.orderCount).toBe(1);
  });

  it('FR-A04 rejects reversed dates and unsupported prototype currency/timezone', async () => {
    await expect(
      service.updateSubsidyProgram(21n, { startDate: '2027-01-01' }, 1n),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createSubsidyProgram({ currency: 'USD' } as never, 1n),
    ).rejects.toThrow(ADMIN_OPERATION_ERRORS.programCurrencyUnsupported);
    await expect(
      service.updateSubsidyProgram(21n, { timezone: 'UTC' } as never, 1n),
    ).rejects.toThrow(ADMIN_OPERATION_ERRORS.programTimezoneUnsupported);
    expect(db.subsidyProgram.update).not.toHaveBeenCalled();
  });

  it('FR-A02 reads previous status under lock and revokes only the suspended merchant sessions', async () => {
    db.merchant.findUnique.mockResolvedValue({
      merchantId: 10n,
      ownerUserId: 2n,
      status: 'ACTIVE',
      wallet: null,
    });
    db.merchant.update.mockResolvedValue({
      merchantId: 10n,
      merchantName: 'ร้านทดสอบ',
      status: 'SUSPENDED',
      updatedAt: new Date('2026-10-28T00:00:00Z'),
    });
    const result = await service.updateMerchantStatus(10n, 'SUSPENDED', 1n);
    expect(result.previousStatus).toBe('ACTIVE');
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.merchant.findUnique.mock.invocationCallOrder[0] ?? 0,
    );
    expect(db.authSession.updateMany).toHaveBeenCalledWith({
      where: { activeMerchantId: 10n, activeRole: 'MERCHANT', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(db.userRole.upsert).not.toHaveBeenCalled();
  });

  it('FR-A06 selects only monitoring fields, including nested point sources (P2022 regression)', async () => {
    db.userQuest.findMany.mockResolvedValue([]);
    db.pointTransaction.findMany.mockResolvedValue([]);
    db.userCoupon.findMany.mockResolvedValue([]);
    const result = await service.getRewardMonitoring();
    const questQuery = db.userQuest.findMany.mock.calls[0]?.[0];
    const pointQuery = db.pointTransaction.findMany.mock.calls[0]?.[0];
    const couponQuery = db.userCoupon.findMany.mock.calls[0]?.[0];
    // An include fetches every scalar (including cancelled_at, absent in the
    // deployed database). A select prevents that unrelated schema dependency.
    expect(questQuery).not.toHaveProperty('include');
    expect(questQuery).toHaveProperty('select.userQuestId', true);
    expect(questQuery).not.toHaveProperty('select.cancelledAt');
    expect(questQuery).not.toHaveProperty('select.cancellationReason');
    expect(pointQuery).toHaveProperty(
      'select.userQuest.select.quest.select.questName',
      true,
    );
    expect(pointQuery).toHaveProperty(
      'select.userCoupon.select.coupon.select.couponName',
      true,
    );
    expect(pointQuery).not.toHaveProperty('include');
    expect(couponQuery).toHaveProperty('select.userCouponId', true);
    expect(couponQuery).not.toHaveProperty('include');
    expect(result.recentPointTransactions).toEqual([]);
    expect(result.recentCouponRedemptions).toEqual([]);
  });
  it('FR-A02 rejects stale bulk approval before changing a concurrently suspended merchant', async () => {
    db.merchant.findUnique.mockResolvedValue({
      merchantId: 10n,
      status: 'SUSPENDED',
      ownerUserId: 2n,
      wallet: null,
    });
    await expect(
      service.updateMerchantStatus(10n, 'ACTIVE', 1n, undefined, 'PENDING'),
    ).rejects.toThrow(ADMIN_OPERATION_ERRORS.merchantStatusChanged);
    expect(db.merchant.update).not.toHaveBeenCalled();
    expect(db.userRole.upsert).not.toHaveBeenCalled();
    expect(db.wallet.create).not.toHaveBeenCalled();
  });

  it('FR-A02 approves a matching pending snapshot inside the existing audited transaction', async () => {
    db.merchant.findUnique.mockResolvedValue({
      merchantId: 10n,
      status: 'PENDING',
      ownerUserId: 2n,
      wallet: { status: 'ACTIVE' },
    });
    db.merchant.update.mockResolvedValue({
      merchantId: 10n,
      merchantName: 'ร้านทดสอบ',
      status: 'ACTIVE',
      updatedAt: new Date(),
    });
    const result = await service.updateMerchantStatus(
      10n,
      'ACTIVE',
      1n,
      'ตรวจสอบแล้ว',
      'PENDING',
    );
    expect(result.previousStatus).toBe('PENDING');
    expect(result.audit.reason).toBe('ตรวจสอบแล้ว');
    expect(db.userRole.upsert).toHaveBeenCalledOnce();
    expect(db.$transaction).toHaveBeenCalledOnce();
  });
});
