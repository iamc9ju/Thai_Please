import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { WalletService } from '../src/wallet/wallet.service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const allowsTestMutation = process.env.ALLOW_TEST_DATABASE_MUTATION === 'true';

function isExplicitDisposableTestDatabase(url: string | undefined): boolean {
  if (!url || !allowsTestMutation) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const databaseName = parsed.pathname.replace(/^\//, '');
    return (
      (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:') &&
      /(?:^|[_-])test$/i.test(databaseName)
    );
  } catch {
    return false;
  }
}

const hasSafeTestDatabase = isExplicitDisposableTestDatabase(testDatabaseUrl);
const describeWithPostgres = hasSafeTestDatabase ? describe : describe.skip;

describeWithPostgres('FR-C03 PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let service: WalletService;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL_REQUIRED');
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });
    await prisma.$connect();
    service = new WalletService(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('includes only the half-open Bangkok day and performs no writes', async () => {
    const fixtureKey = randomUUID();
    const citizenId = `${Date.now().toString().slice(-9)}${Math.floor(
      Math.random() * 10_000,
    )
      .toString()
      .padStart(4, '0')}`;
    let userId: bigint | undefined;
    let walletId: bigint | undefined;
    let programId: bigint | undefined;

    try {
      const program = await prisma.subsidyProgram.create({
        data: {
          programName: `FR-C03 integration ${fixtureKey}`,
          initialGrant: 800,
          subsidyPercentage: 50,
          userPercentage: 50,
          dailySubsidyLimit: 200,
          startDate: new Date('2026-10-14T00:00:00.000Z'),
          endDate: new Date('2026-10-14T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      programId = program.programId;

      const user = await prisma.user.create({
        data: {
          citizenId,
          fullName: `FR-C03 integration ${fixtureKey}`,
          role: 'CONSUMER',
          status: 'ACTIVE',
          passwordHash: 'integration-test-not-a-real-password-hash',
        },
      });
      userId = user.userId;

      const wallet = await prisma.wallet.create({
        data: {
          userId,
          walletType: 'CONSUMER',
          personalBalance: 0,
          subsidyBalance: 800,
          status: 'ACTIVE',
          subsidyProgramId: programId,
        },
      });
      walletId = wallet.walletId;

      const boundaryRows = [
        ['before', '2026-10-13T16:59:59.999Z', 11],
        ['start', '2026-10-13T17:00:00.000Z', 30],
        ['inside', '2026-10-14T16:59:59.999Z', 20],
        ['next-day', '2026-10-14T17:00:00.000Z', 70],
      ] as const;
      for (const [label, createdAt, amount] of boundaryRows) {
        await prisma.walletTransaction.create({
          data: {
            walletId,
            userId,
            programId,
            fundType: 'SUBSIDY',
            transactionType: 'PAYMENT_SUBSIDY',
            amount,
            balanceBefore: 800,
            balanceAfter: 800 - amount,
            createdAt: new Date(createdAt),
            businessRef: `fr-c03-${fixtureKey}-${label}`,
            correlationId: fixtureKey,
            walletTypeSnapshot: 'CONSUMER',
          },
        });
      }

      const before = await prisma.wallet.findUniqueOrThrow({
        where: { walletId },
      });
      const transactionCountBefore = await prisma.walletTransaction.count({
        where: { walletId },
      });

      const result = await service.getConsumerSubsidyStatus(
        userId,
        new Date('2026-10-14T10:30:00.000Z'),
      );

      expect(result.dailySubsidyUsed).toBe(50);
      expect(result.dailySubsidyRemaining).toBe(150);
      const after = await prisma.wallet.findUniqueOrThrow({
        where: { walletId },
      });
      const transactionCountAfter = await prisma.walletTransaction.count({
        where: { walletId },
      });
      expect(after).toEqual(before);
      expect(transactionCountAfter).toBe(transactionCountBefore);
    } finally {
      if (walletId) {
        await prisma.walletTransaction.deleteMany({ where: { walletId } });
        await prisma.wallet.deleteMany({ where: { walletId } });
      }
      if (userId) {
        await prisma.user.deleteMany({ where: { userId } });
      }
      if (programId) {
        await prisma.subsidyProgram.deleteMany({ where: { programId } });
      }
    }
  });
});
