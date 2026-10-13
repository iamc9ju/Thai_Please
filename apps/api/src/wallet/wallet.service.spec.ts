import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
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
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
  };
  userQuest: { findMany: Mock; create: Mock };
  userCoupon: { findMany: Mock };
  quest: { findFirst: Mock };
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
      $queryRaw: vi.fn().mockResolvedValue([{ wallet_id: 1n }]),
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(prismaMock),
      ),
    };

    service = new WalletService(prismaMock as unknown as PrismaService);
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

      prismaMock.walletTransaction.findMany.mockImplementation(
        (args: unknown) => {
          const params = args as { select?: { amount?: boolean } } | undefined;
          if (params?.select?.amount) {
            return Promise.resolve([{ amount: '50.00' }]);
          }
          return Promise.resolve([
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
        },
      );

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
    });
  });

  describe('topUpPersonal', () => {
    it('rejects non-positive amount', async () => {
      await expect(
        service.topUpPersonal(100n, {
          amount: 0,
          idempotencyKey: 'idem-12345678',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns existing transaction on idempotency replay', async () => {
      const userId = 100n;
      const walletId = 1n;

      prismaMock.wallet.findFirst.mockResolvedValue({
        walletId,
        userId,
        personalBalance: '600.00',
        status: 'ACTIVE',
      });

      prismaMock.walletTransaction.findUnique.mockResolvedValue({
        walletTransactionId: 99n,
        amount: '100.00',
        createdAt: new Date(),
      });

      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        personalBalance: '600.00',
      });

      const result = await service.topUpPersonal(userId, {
        amount: 100,
        idempotencyKey: 'replay-key-123',
      });

      expect(result.isIdempotentReplay).toBe(true);
      expect(result.transactionId).toBe('99');
      expect(result.amount).toBe(100);
    });

    it('credits balance and creates ledger entry for new top-up', async () => {
      const userId = 100n;
      const walletId = 1n;

      prismaMock.wallet.findFirst.mockResolvedValue({
        walletId,
        userId,
        personalBalance: '200.00',
        status: 'ACTIVE',
      });

      prismaMock.walletTransaction.findUnique.mockResolvedValue(null);

      prismaMock.wallet.findUnique.mockResolvedValue({
        walletId,
        personalBalance: '200.00',
        status: 'ACTIVE',
      });

      prismaMock.wallet.update.mockResolvedValue({
        walletId,
        personalBalance: '500.00',
      });

      prismaMock.walletTransaction.create.mockResolvedValue({
        walletTransactionId: 101n,
        amount: '300.00',
        createdAt: new Date(),
      });

      const result = await service.topUpPersonal(userId, {
        amount: 300,
        idempotencyKey: 'new-key-12345678',
      });

      expect(result.isIdempotentReplay).toBe(false);
      expect(result.transactionId).toBe('101');
      expect(result.personalBalance).toBe(500);
      expect(prismaMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ personalBalance: 500 }),
        }),
      );
    });
  });
});
