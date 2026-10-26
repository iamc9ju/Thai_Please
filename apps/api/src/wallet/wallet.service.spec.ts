import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { WalletService } from './wallet.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface MockPrisma {
  user: { findUnique: Mock };
  wallet: {
    findFirst: Mock;
    findUnique: Mock;
    create: Mock;
    update: Mock;
  };
  subsidyProgram: { findFirst: Mock };
  walletTransaction: {
    aggregate: Mock;
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
  };
  userQuest: { findMany: Mock; create: Mock };
  userCoupon: { findMany: Mock };
  quest: { findFirst: Mock };
  order: { findMany: Mock };
  $queryRaw: Mock;
  $transaction: Mock;
}

describe('WalletService', () => {
  let service: WalletService;
  let prismaMock: MockPrisma;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: vi.fn(),
      },
      wallet: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      subsidyProgram: {
        findFirst: vi.fn(),
      },
      walletTransaction: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      userQuest: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      userCoupon: {
        findMany: vi.fn(),
      },
      quest: {
        findFirst: vi.fn(),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ wallet_id: 1n }]),
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(prismaMock),
      ),
    };

    service = new WalletService(prismaMock as unknown as PrismaService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getConsumerOverview', () => {
    it('returns wallet overview with calculated daily subsidy', async () => {
      const userId = 100n;
      const walletId = 1n;

      prismaMock.user.findUnique.mockResolvedValue({
        userId,
        citizenId: '1234567890123',
        fullName: 'สมชาย ใจดี',
        pointBalance: 250,
      });

      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        userId,
        walletType: 'CONSUMER',
        personalBalance: '500.00',
        subsidyBalance: '800.00',
        status: 'ACTIVE',
      });

      prismaMock.subsidyProgram.findFirst.mockResolvedValue({
        programId: 1n,
        programName: 'โครงการทดสอบ',
        dailySubsidyLimit: '200.00',
        subsidyPercentage: '50.00',
        userPercentage: '50.00',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      prismaMock.walletTransaction.aggregate.mockResolvedValue({
        _sum: { amount: '50.00' },
      });
      prismaMock.walletTransaction.findMany.mockResolvedValue([
        {
          walletTransactionId: 1n,
          fundType: 'PERSONAL',
          transactionType: 'PERSONAL_TOPUP',
          amount: '100.00',
          balanceBefore: '0.00',
          balanceAfter: '100.00',
          createdAt: new Date(),
        },
      ]);

      prismaMock.userQuest.findMany.mockResolvedValue([]);
      prismaMock.userCoupon.findMany.mockResolvedValue([]);
      prismaMock.quest.findFirst.mockResolvedValue(null);

      const result = await service.getConsumerOverview(userId);

      expect(result.wallet.personalBalance).toBe(500);
      expect(result.wallet.subsidyBalance).toBe(800);
      expect(result.wallet.totalBalance).toBe(1300);
      expect(result.wallet.dailySubsidyLimit).toBe(200);
      expect(result.wallet.dailySubsidyUsed).toBe(50);
      expect(result.wallet.dailySubsidyRemaining).toBe(150); // 200 - 50 = 150
      expect(result.wallet.pointBalance).toBe(250);
      expect(result.recentOrders).toEqual([]);
      expect(JSON.stringify(result)).not.toContain('1234567890123');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { userId },
        select: { pointBalance: true },
      });
      expect(prismaMock.quest.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.userQuest.create).not.toHaveBeenCalled();
      expect(prismaMock.wallet.create).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['2026-10-13T17:00:01.000Z', '2026-10-14T00:00:00.000Z'],
      ['2026-10-14T16:59:59.999Z', '2026-10-14T00:00:00.000Z'],
      ['2026-10-14T17:00:00.000Z', '2026-10-15T00:00:00.000Z'],
    ])(
      'queries the inclusive program date for Bangkok instant %s',
      async (instant, expectedBusinessDate) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(instant));
        prismaMock.user.findUnique.mockResolvedValue({
          userId: 100n,
          pointBalance: 0,
        });
        prismaMock.wallet.findUnique.mockResolvedValue({
          walletId: 1n,
          userId: 100n,
          personalBalance: '0.00',
          subsidyBalance: '0.00',
          status: 'ACTIVE',
        });
        prismaMock.subsidyProgram.findFirst.mockResolvedValue(null);
        prismaMock.walletTransaction.findMany.mockResolvedValue([]);
        prismaMock.userQuest.findMany.mockResolvedValue([]);
        prismaMock.userCoupon.findMany.mockResolvedValue([]);

        await service.getConsumerOverview(100n);

        const businessDate = new Date(expectedBusinessDate);
        expect(prismaMock.subsidyProgram.findFirst).toHaveBeenCalledWith({
          where: {
            status: 'ACTIVE',
            startDate: { lte: businessDate },
            endDate: { gte: businessDate },
          },
        });
      },
    );

    it('uses a half-open Bangkok day interval for daily subsidy transactions', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-14T10:30:00.000Z'));
      prismaMock.user.findUnique.mockResolvedValue({
        userId: 100n,
        pointBalance: 0,
      });
      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId: 1n,
        userId: 100n,
        personalBalance: '0.00',
        subsidyBalance: '0.00',
        status: 'ACTIVE',
      });
      prismaMock.subsidyProgram.findFirst.mockResolvedValue(null);
      prismaMock.walletTransaction.findMany.mockResolvedValue([]);
      prismaMock.userQuest.findMany.mockResolvedValue([]);
      prismaMock.userCoupon.findMany.mockResolvedValue([]);

      await service.getConsumerOverview(100n);

      expect(prismaMock.walletTransaction.aggregate).toHaveBeenCalledWith({
        where: {
          walletId: 1n,
          fundType: 'SUBSIDY',
          transactionType: 'PAYMENT_SUBSIDY',
          createdAt: {
            gte: new Date('2026-10-13T17:00:00.000Z'),
            lt: new Date('2026-10-14T17:00:00.000Z'),
          },
        },
        _sum: { amount: true },
      });
    });

    it('runs dependent overview reads with concurrency bounded at three after wallet identity is known', async () => {
      const calls: string[] = [];
      const pending = <T>() => {
        let settle: ((value: T) => void) | undefined;
        const promise = new Promise<T>((resolve) => {
          settle = resolve;
        });
        return {
          promise,
          resolve(value: T) {
            if (!settle) {
              throw new Error('deferred promise was not initialized');
            }
            settle(value);
          },
        };
      };

      const user = pending<{ pointBalance: number }>();
      const wallet = pending<{
        walletId: bigint;
        personalBalance: string;
        subsidyBalance: string;
      }>();
      prismaMock.user.findUnique.mockImplementation(() => {
        calls.push('user');
        return user.promise;
      });
      prismaMock.wallet.findUnique.mockImplementation(() => {
        calls.push('wallet');
        return wallet.promise;
      });

      const program = pending<null>();
      const subsidy = pending<{ _sum: { amount: null } }>();
      const quests = pending<never[]>();
      const coupons = pending<never[]>();
      const transactions = pending<never[]>();
      const orders = pending<never[]>();
      prismaMock.subsidyProgram.findFirst.mockImplementation(() => {
        calls.push('program');
        return program.promise;
      });
      prismaMock.walletTransaction.aggregate.mockImplementation(() => {
        calls.push('subsidy');
        return subsidy.promise;
      });
      prismaMock.userQuest.findMany.mockImplementation(() => {
        calls.push('quests');
        return quests.promise;
      });
      prismaMock.userCoupon.findMany.mockImplementation(() => {
        calls.push('coupons');
        return coupons.promise;
      });
      prismaMock.walletTransaction.findMany.mockImplementation(() => {
        calls.push('transactions');
        return transactions.promise;
      });
      prismaMock.order.findMany.mockImplementation(() => {
        calls.push('orders');
        return orders.promise;
      });

      const overview = service.getConsumerOverview(100n);

      expect(calls).toEqual(['user', 'wallet']);
      expect(prismaMock.subsidyProgram.findFirst).not.toHaveBeenCalled();

      user.resolve({ pointBalance: 0 });
      wallet.resolve({
        walletId: 1n,
        personalBalance: '0.00',
        subsidyBalance: '0.00',
      });

      await vi.waitFor(() => {
        expect(calls).toEqual([
          'user',
          'wallet',
          'program',
          'subsidy',
          'quests',
        ]);
      });
      expect(prismaMock.userCoupon.findMany).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.findMany).not.toHaveBeenCalled();
      expect(prismaMock.order.findMany).not.toHaveBeenCalled();

      program.resolve(null);
      subsidy.resolve({ _sum: { amount: null } });
      quests.resolve([]);

      await vi.waitFor(() => {
        expect(calls).toEqual([
          'user',
          'wallet',
          'program',
          'subsidy',
          'quests',
          'coupons',
          'transactions',
          'orders',
        ]);
      });
      coupons.resolve([]);
      transactions.resolve([]);
      orders.resolve([]);

      await expect(overview).resolves.toMatchObject({
        wallet: { dailySubsidyUsed: 0 },
      });
    });

    it('returns the latest paid orders scoped to the requesting consumer', async () => {
      const userId = 100n;
      const walletId = 1n;
      const latestPaidAt = new Date('2026-10-14T03:00:00.000Z');
      const earlierPaidAt = new Date('2026-10-13T03:00:00.000Z');

      prismaMock.user.findUnique.mockResolvedValue({
        userId,
        citizenId: '1234567890123',
        fullName: 'สมชาย ใจดี',
        pointBalance: 250,
      });
      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        userId,
        walletType: 'CONSUMER',
        personalBalance: '500.00',
        subsidyBalance: '800.00',
        status: 'ACTIVE',
      });
      prismaMock.subsidyProgram.findFirst.mockResolvedValue(null);
      prismaMock.walletTransaction.findMany.mockResolvedValue([]);
      prismaMock.userQuest.findMany.mockResolvedValue([]);
      prismaMock.userCoupon.findMany.mockResolvedValue([]);
      prismaMock.quest.findFirst.mockResolvedValue(null);
      prismaMock.order.findMany.mockResolvedValue([
        {
          orderId: 12n,
          finalAmount: '175.00',
          paidAt: latestPaidAt,
          merchant: { merchantName: 'ร้านล่าสุด' },
        },
        {
          orderId: 11n,
          finalAmount: '80.00',
          paidAt: earlierPaidAt,
          merchant: { merchantName: 'ร้านก่อนหน้า' },
        },
      ]);

      const result = await service.getConsumerOverview(userId);

      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          status: 'PAID',
          paidAt: { not: null },
        },
        select: {
          orderId: true,
          finalAmount: true,
          paidAt: true,
          merchant: {
            select: { merchantName: true },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: 5,
      });
      expect(result.recentOrders).toEqual([
        {
          orderId: '12',
          merchantName: 'ร้านล่าสุด',
          finalAmount: 175,
          paidAt: latestPaidAt,
        },
        {
          orderId: '11',
          merchantName: 'ร้านก่อนหน้า',
          finalAmount: 80,
          paidAt: earlierPaidAt,
        },
      ]);
    });
  });

  describe('getConsumerTransactions', () => {
    const userId = 100n;
    const walletId = 1n;

    it('scopes to the session wallet and maps new and legacy top-up rows within inclusive Bangkok dates', async () => {
      const firstCreatedAt = new Date('2026-10-14T10:00:00.000Z');
      const secondCreatedAt = new Date('2026-10-13T10:00:00.000Z');
      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        walletType: 'CONSUMER',
      });
      prismaMock.walletTransaction.findMany.mockResolvedValue([
        {
          walletTransactionId: 12n,
          fundType: 'PERSONAL',
          transactionType: 'PERSONAL_TOPUP',
          amount: '100.00',
          balanceBefore: '200.00',
          balanceAfter: '300.00',
          createdAt: firstCreatedAt,
        },
        {
          walletTransactionId: 11n,
          fundType: 'PERSONAL',
          transactionType: 'TOPUP',
          amount: '50.00',
          balanceBefore: '150.00',
          balanceAfter: '200.00',
          createdAt: secondCreatedAt,
        },
      ]);

      const result = await service.getConsumerTransactions(userId, {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-14',
      });

      expect(prismaMock.wallet.findUnique).toHaveBeenCalledWith({
        where: { userId },
        select: { walletId: true, walletType: true },
      });
      expect(prismaMock.walletTransaction.findMany).toHaveBeenCalledWith({
        where: {
          walletId,
          createdAt: {
            gte: new Date('2026-09-30T17:00:00.000Z'),
            lt: new Date('2026-10-14T17:00:00.000Z'),
          },
        },
        select: {
          walletTransactionId: true,
          fundType: true,
          transactionType: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { walletTransactionId: 'desc' }],
        take: 21,
      });
      expect(result).toEqual({
        items: [
          {
            transactionId: '12',
            fundType: 'PERSONAL',
            transactionType: 'PERSONAL_TOPUP',
            amount: 100,
            balanceBefore: 200,
            balanceAfter: 300,
            createdAt: firstCreatedAt,
          },
          {
            transactionId: '11',
            fundType: 'PERSONAL',
            transactionType: 'TOPUP',
            amount: 50,
            balanceBefore: 150,
            balanceAfter: 200,
            createdAt: secondCreatedAt,
          },
        ],
        nextCursor: null,
      });
    });

    it('returns a stable cursor and applies createdAt plus id keyset ordering', async () => {
      const sameCreatedAt = new Date('2026-10-14T10:00:00.000Z');
      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        walletType: 'CONSUMER',
      });
      prismaMock.walletTransaction.findMany.mockResolvedValue([
        {
          walletTransactionId: 12n,
          fundType: 'PERSONAL',
          transactionType: 'PERSONAL_TOPUP',
          amount: '100.00',
          balanceBefore: '200.00',
          balanceAfter: '300.00',
          createdAt: sameCreatedAt,
        },
        {
          walletTransactionId: 11n,
          fundType: 'PERSONAL',
          transactionType: 'TOPUP',
          amount: '50.00',
          balanceBefore: '150.00',
          balanceAfter: '200.00',
          createdAt: sameCreatedAt,
        },
        {
          walletTransactionId: 10n,
          fundType: 'PERSONAL',
          transactionType: 'PAYMENT_PERSONAL',
          amount: '20.00',
          balanceBefore: '170.00',
          balanceAfter: '150.00',
          createdAt: sameCreatedAt,
        },
      ]);

      const firstPage = await service.getConsumerTransactions(userId, {
        limit: 2,
      });

      expect(firstPage.items.map((item) => item.transactionId)).toEqual([
        '12',
        '11',
      ]);
      expect(firstPage.nextCursor).toEqual(expect.any(String));
      const nextCursor = firstPage.nextCursor;
      if (!nextCursor) {
        throw new Error('expected a next cursor for the bounded first page');
      }

      prismaMock.walletTransaction.findMany.mockClear();
      prismaMock.walletTransaction.findMany.mockResolvedValue([]);
      await service.getConsumerTransactions(userId, {
        limit: 2,
        cursor: nextCursor,
      });

      expect(prismaMock.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            walletId,
            OR: [
              { createdAt: { lt: sameCreatedAt } },
              {
                createdAt: sameCreatedAt,
                walletTransactionId: { lt: 11n },
              },
            ],
          },
          orderBy: [{ createdAt: 'desc' }, { walletTransactionId: 'desc' }],
          take: 3,
        }),
      );
    });

    it('returns an empty bounded page without a cursor', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        walletType: 'CONSUMER',
      });
      prismaMock.walletTransaction.findMany.mockResolvedValue([]);

      await expect(
        service.getConsumerTransactions(userId, {}),
      ).resolves.toEqual({ items: [], nextCursor: null });
    });

    it('rejects invalid service-level ranges, limits, and cursors', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        walletType: 'CONSUMER',
      });

      await expect(
        service.getConsumerTransactions(userId, {
          dateFrom: '2026-10-15',
          dateTo: '2026-10-14',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getConsumerTransactions(userId, { limit: 101 }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getConsumerTransactions(userId, { dateFrom: '2026-02-30' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getConsumerTransactions(userId, { cursor: 'bm90LWpzb24' }),
      ).rejects.toThrow('WALLET_TRANSACTION_CURSOR_INVALID');
      expect(prismaMock.walletTransaction.findMany).not.toHaveBeenCalled();
    });

    it('rejects a missing or non-consumer wallet without querying another owner transactions', async () => {
      prismaMock.wallet.findUnique.mockResolvedValueOnce(null);
      await expect(service.getConsumerTransactions(userId, {})).rejects.toThrow(
        NotFoundException,
      );

      prismaMock.wallet.findUnique.mockResolvedValueOnce({
        walletId,
        walletType: 'MERCHANT',
      });
      await expect(service.getConsumerTransactions(userId, {})).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.walletTransaction.findMany).not.toHaveBeenCalled();
    });
  });

  describe('topUpPersonal', () => {
    const userId = 100n;
    const walletId = 1n;
    const activeWallet = {
      walletId,
      userId,
      walletType: 'CONSUMER',
      personalBalance: '200.00',
      subsidyBalance: '800.00',
      status: 'ACTIVE',
    };

    it.each([0, -1, 50_001, 1.5, Number.NaN])(
      'rejects invalid amount %s at the service boundary',
      async (amount) => {
        await expect(
          service.topUpPersonal(userId, {
            amount,
            idempotencyKey: 'invalid-amount-key',
          }),
        ).rejects.toThrow(BadRequestException);
        expect(prismaMock.wallet.findUnique).not.toHaveBeenCalled();
      },
    );

    it.each(['short', 'x'.repeat(129)])(
      'rejects invalid idempotency key length at the service boundary',
      async (idempotencyKey) => {
        await expect(
          service.topUpPersonal(userId, { amount: 100, idempotencyKey }),
        ).rejects.toThrow(BadRequestException);
        expect(prismaMock.wallet.findUnique).not.toHaveBeenCalled();
      },
    );

    it('rejects a missing wallet without creating one', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue(null);

      await expect(
        service.topUpPersonal(userId, {
          amount: 100,
          idempotencyKey: 'missing-wallet-key',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.wallet.create).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['inactive', { ...activeWallet, status: 'INACTIVE' }],
      ['non-consumer', { ...activeWallet, walletType: 'MERCHANT' }],
    ])('rejects an %s wallet', async (_case, wallet) => {
      prismaMock.wallet.findUnique.mockResolvedValue(wallet);

      await expect(
        service.topUpPersonal(userId, {
          amount: 100,
          idempotencyKey: 'invalid-wallet-key',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.walletTransaction.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('returns the original result for the same key and amount', async () => {
      const createdAt = new Date('2026-10-14T02:00:00.000Z');
      prismaMock.wallet.findUnique.mockResolvedValue({
        ...activeWallet,
        personalBalance: '600.00',
      });
      prismaMock.walletTransaction.findUnique.mockResolvedValue({
        walletTransactionId: 99n,
        walletId,
        userId,
        fundType: 'PERSONAL',
        transactionType: 'PERSONAL_TOPUP',
        amount: '100.00',
        balanceAfter: '300.00',
        createdAt,
      });

      const result = await service.topUpPersonal(userId, {
        amount: 100,
        idempotencyKey: 'replay-key-123',
      });

      expect(result.isIdempotentReplay).toBe(true);
      expect(result.transactionId).toBe('99');
      expect(result.amount).toBe(100);
      expect(result.personalBalance).toBe(300);
      expect(result.createdAt).toBe(createdAt);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('replays a matching legacy TOPUP ledger without writing a new transaction', async () => {
      const createdAt = new Date('2026-10-14T02:00:00.000Z');
      prismaMock.wallet.findUnique.mockResolvedValue(activeWallet);
      prismaMock.walletTransaction.findUnique.mockResolvedValue({
        walletTransactionId: 98n,
        walletId,
        userId,
        fundType: 'PERSONAL',
        transactionType: 'TOPUP',
        amount: '100.00',
        balanceAfter: '300.00',
        createdAt,
      });

      const result = await service.topUpPersonal(userId, {
        amount: 100,
        idempotencyKey: 'legacy-key-123',
      });

      expect(result).toEqual({
        success: true,
        isIdempotentReplay: true,
        transactionId: '98',
        amount: 100,
        personalBalance: 300,
        createdAt,
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    });

    it.each([
      ['walletId', { walletId: 2n }],
      ['userId', { userId: 101n }],
      ['fundType', { fundType: 'SUBSIDY' }],
      ['amount', { amount: '101.00' }],
    ])(
      'rejects a legacy TOPUP replay when %s does not match',
      async (_field, mismatch) => {
        prismaMock.wallet.findUnique.mockResolvedValue(activeWallet);
        prismaMock.walletTransaction.findUnique.mockResolvedValue({
          walletTransactionId: 98n,
          walletId,
          userId,
          fundType: 'PERSONAL',
          transactionType: 'TOPUP',
          amount: '100.00',
          balanceAfter: '300.00',
          createdAt: new Date(),
          ...mismatch,
        });

        await expect(
          service.topUpPersonal(userId, {
            amount: 100,
            idempotencyKey: 'legacy-mismatch',
          }),
        ).rejects.toThrow('TOPUP_IDEMPOTENCY_KEY_CONFLICT');
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.wallet.update).not.toHaveBeenCalled();
        expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
      },
    );

    it('rejects reuse of an idempotency key with a different amount', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue(activeWallet);
      prismaMock.walletTransaction.findUnique.mockResolvedValue({
        walletTransactionId: 99n,
        walletId,
        userId,
        fundType: 'PERSONAL',
        transactionType: 'PERSONAL_TOPUP',
        amount: '100.00',
        balanceAfter: '300.00',
        createdAt: new Date(),
      });

      await expect(
        service.topUpPersonal(userId, {
          amount: 200,
          idempotencyKey: 'reused-key-123',
        }),
      ).rejects.toThrow('TOPUP_IDEMPOTENCY_KEY_CONFLICT');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('returns a replay when a concurrent request creates the ledger after lock wait', async () => {
      const createdAt = new Date('2026-10-14T02:00:00.000Z');
      prismaMock.wallet.findUnique.mockResolvedValue(activeWallet);
      prismaMock.walletTransaction.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          walletTransactionId: 99n,
          walletId,
          userId,
          fundType: 'PERSONAL',
          transactionType: 'PERSONAL_TOPUP',
          amount: '100.00',
          balanceAfter: '300.00',
          createdAt,
        });

      const result = await service.topUpPersonal(userId, {
        amount: 100,
        idempotencyKey: 'concurrent-key-123',
      });

      expect(result).toEqual({
        success: true,
        isIdempotentReplay: true,
        transactionId: '99',
        amount: 100,
        personalBalance: 300,
        createdAt,
      });
      expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('replays a matching legacy TOPUP ledger discovered after the row lock', async () => {
      const createdAt = new Date('2026-10-14T02:00:00.000Z');
      prismaMock.wallet.findUnique.mockResolvedValue(activeWallet);
      prismaMock.walletTransaction.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          walletTransactionId: 98n,
          walletId,
          userId,
          fundType: 'PERSONAL',
          transactionType: 'TOPUP',
          amount: '100.00',
          balanceAfter: '300.00',
          createdAt,
        });

      const result = await service.topUpPersonal(userId, {
        amount: 100,
        idempotencyKey: 'legacy-after-lock',
      });

      expect(result.isIdempotentReplay).toBe(true);
      expect(result.transactionId).toBe('98');
      expect(result.personalBalance).toBe(300);
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    });

    it.each([1, 50_000])(
      'credits only personal balance and writes an atomic PERSONAL_TOPUP ledger at boundary %s',
      async (amount) => {
        prismaMock.wallet.findUnique.mockResolvedValue(activeWallet);
        prismaMock.walletTransaction.findUnique.mockResolvedValue(null);
        prismaMock.wallet.update.mockResolvedValue({
          ...activeWallet,
          personalBalance: new Prisma.Decimal(200).plus(amount),
        });
        const createdAt = new Date('2026-10-14T02:00:00.000Z');
        prismaMock.walletTransaction.create.mockResolvedValue({
          walletTransactionId: 101n,
          amount,
          createdAt,
        });

        const result = await service.topUpPersonal(userId, {
          amount,
          idempotencyKey: `new-key-${amount}`,
        });

        expect(result.isIdempotentReplay).toBe(false);
        expect(result.transactionId).toBe('101');
        expect(result.personalBalance).toBe(200 + amount);
        expect(prismaMock.$transaction).toHaveBeenCalledOnce();
        expect(prismaMock.wallet.update).toHaveBeenCalledOnce();
        const walletUpdate = prismaMock.wallet.update.mock.calls[0]?.[0] as {
          data: Record<string, unknown>;
        };
        expect(walletUpdate).toEqual({
          where: { walletId },
          data: {
            personalBalance: expect.any(Prisma.Decimal),
            version: { increment: 1 },
          },
        });
        expect(walletUpdate.data).not.toHaveProperty('subsidyBalance');
        expect(
          (walletUpdate.data.personalBalance as Prisma.Decimal).toString(),
        ).toBe(String(200 + amount));

        expect(prismaMock.walletTransaction.create).toHaveBeenCalledOnce();
        const ledgerCreate = prismaMock.walletTransaction.create.mock
          .calls[0]?.[0] as {
          data: Record<string, unknown>;
        };
        expect(ledgerCreate.data).toEqual(
          expect.objectContaining({
            walletId,
            userId,
            fundType: 'PERSONAL',
            transactionType: 'PERSONAL_TOPUP',
            amount,
            walletTypeSnapshot: 'CONSUMER',
            businessRef: `topup_${walletId}_new-key-${amount}`,
            metadata: {
              source: 'VIRTUAL_TOPUP',
              idempotencyKey: `new-key-${amount}`,
            },
          }),
        );
        expect(
          (ledgerCreate.data.balanceBefore as Prisma.Decimal).toString(),
        ).toBe('200');
        expect(
          (ledgerCreate.data.balanceAfter as Prisma.Decimal).toString(),
        ).toBe(String(200 + amount));
        expect(activeWallet.subsidyBalance).toBe('800.00');
      },
    );

    it('rejects a wallet that becomes inactive while waiting for the row lock', async () => {
      prismaMock.wallet.findUnique
        .mockResolvedValueOnce(activeWallet)
        .mockResolvedValueOnce({
          ...activeWallet,
          status: 'INACTIVE',
        });
      prismaMock.walletTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.topUpPersonal(userId, {
          amount: 300,
          idempotencyKey: 'inactive-after-lock',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects a mismatched concurrent payload after acquiring the row lock', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue(activeWallet);
      prismaMock.walletTransaction.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          walletTransactionId: 99n,
          walletId,
          userId,
          fundType: 'PERSONAL',
          transactionType: 'PERSONAL_TOPUP',
          amount: '100.00',
          balanceAfter: '300.00',
          createdAt: new Date(),
        });

      await expect(
        service.topUpPersonal(userId, {
          amount: 300,
          idempotencyKey: 'concurrent-conflict',
        }),
      ).rejects.toThrow('TOPUP_IDEMPOTENCY_KEY_CONFLICT');
      expect(prismaMock.wallet.update).not.toHaveBeenCalled();
      expect(prismaMock.walletTransaction.create).not.toHaveBeenCalled();
    });
  });
});
