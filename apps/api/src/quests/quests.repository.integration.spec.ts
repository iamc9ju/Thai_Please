import 'dotenv/config';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseQuestPolicy } from './domain/quest-policy.js';
import { QuestsRepository } from './quests.repository.js';
import type { Candidate } from './quest-candidates.js';
import { buildQuestInput } from './quest-candidates.js';

// Explicit opt-in: uses only a unique disposable schema, never existing app tables.
const enabled = process.env.QUEST_RUN_DATABASE_TESTS === '1';
describe.skipIf(!enabled)(
  'quest generation PostgreSQL migration/concurrency',
  () => {
    const schema = `quest_test_${randomUUID().replaceAll('-', '')}`;
    const policy = parseQuestPolicy(
      JSON.parse(
        readFileSync(
          new URL('./config/quest-policy.json', import.meta.url),
          'utf8',
        ),
      ) as unknown,
    );
    const now = new Date('2026-10-16T01:00:00Z');
    let admin: Client;
    let db: PrismaService;
    let repository: QuestsRepository;
    let previousUrl: string | undefined;
    let userId: bigint;
    let actorId: bigint;
    const candidate: Candidate = {
      id: 'MIN_SPEND:none:9000',
      type: 'MIN_SPEND',
      targetId: null,
      minimumSpendMinor: '9000',
      rewardPoints: 20,
      durationDays: 7,
    };

    beforeAll(async () => {
      config({ path: '../../.env', quiet: true });
      const connectionString =
        process.env.QUEST_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!connectionString)
        throw new Error('QUEST_TEST_DATABASE_URL required');
      previousUrl = process.env.DATABASE_URL;
      admin = new Client({ connectionString, connectionTimeoutMillis: 10000 });
      await admin.connect();
      if (!/^quest_test_[a-f0-9]+$/.test(schema))
        throw new Error('Invalid test schema');
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`SET search_path TO "${schema}"`);
      const baseline = readFileSync(
        new URL(
          '../../prisma/migrations/0_init/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ).replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
      await admin.query(baseline);
      // Representative legacy audit row must survive the additive upgrade intact.
      await admin.query(`WITH u AS (
          INSERT INTO users(citizen_id,full_name,password_hash) VALUES ('0000000000099','Legacy fixture','not-a-login-hash') RETURNING user_id
        ), q AS (
          INSERT INTO quests(quest_name,quest_type,reward_point,duration_days) VALUES ('Legacy quest','MIN_SPEND',20,7) RETURNING quest_id
        ) INSERT INTO quest_generation_logs(user_id,input_summary,generated_quest_id,candidate_scores,selection_reason)
          SELECT u.user_id,'{"legacy":true}'::jsonb,q.quest_id,'{"score":42}'::jsonb,'legacy-reason' FROM u,q`);
      const migration = readFileSync(
        new URL(
          '../../prisma/migrations/20261016090000_extend_quest_generation_logs/migration.sql',
          import.meta.url,
        ),
        'utf8',
      );
      await admin.query(migration);
      // Populate pre-v2 assignments before upgrading. Historical definitions stay intact.
      await admin.query(`WITH q AS (
        INSERT INTO quests(quest_name,quest_type,reward_point,duration_days,min_spend)
        VALUES ('retire-product-active','PRODUCT_PURCHASE',20,7,NULL),
          ('retire-merchant-active','MERCHANT_SPEND',20,7,90),
          ('keep-product-completed','PRODUCT_PURCHASE',20,7,NULL),
          ('keep-merchant-expired','MERCHANT_SPEND',20,7,90),
          ('keep-product-stale-active','PRODUCT_PURCHASE',20,7,NULL),
          ('keep-min-active','MIN_SPEND',20,7,90)
        RETURNING quest_id,quest_name
      ) INSERT INTO user_quests(user_id,quest_id,status,assigned_at,expires_at,completed_at)
        SELECT (SELECT user_id FROM users WHERE citizen_id='0000000000099'),quest_id,
          CASE WHEN quest_name='keep-product-completed' THEN 'COMPLETED'
            WHEN quest_name='keep-merchant-expired' THEN 'EXPIRED' ELSE 'ACTIVE' END,
          TIMESTAMP '2000-01-01',
          CASE WHEN quest_name LIKE 'retire-%' THEN TIMESTAMP '2099-01-01' ELSE TIMESTAMP '2000-01-08' END,
          CASE WHEN quest_name='keep-product-completed' THEN TIMESTAMP '2000-01-02' ELSE NULL END
        FROM q`);
      await admin.query(`INSERT INTO point_transactions(user_id,user_quest_id,transaction_type,points,expires_at,created_at)
        SELECT uq.user_id,uq.user_quest_id,'QUEST_REWARD',20,TIMESTAMP '2099-01-01',TIMESTAMP '2000-01-02'
        FROM user_quests uq JOIN quests q USING(quest_id) WHERE q.quest_name='keep-product-completed';
        UPDATE users SET point_balance=20 WHERE citizen_id='0000000000099'`);
      await admin.query(
        readFileSync(
          new URL(
            '../../prisma/migrations/20261027090000_retire_product_merchant_quests/migration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const isolated = new URL(connectionString);
      isolated.searchParams.set('schema', schema);
      isolated.searchParams.set(
        'options',
        `-c search_path=${schema} -c timezone=Asia/Bangkok`,
      );
      process.env.DATABASE_URL = isolated.toString();
      db = new PrismaService();
      await db.$connect();
      repository = new QuestsRepository(db);
      const consumer = await db.user.create({
        data: {
          citizenId: '0000000000001',
          fullName: 'Test Consumer',
          passwordHash: 'not-a-login-hash',
          role: 'CONSUMER',
        },
      });
      const actor = await db.user.create({
        data: {
          citizenId: '0000000000002',
          fullName: 'Test Admin',
          passwordHash: 'not-a-login-hash',
          role: 'ADMIN',
        },
      });
      userId = consumer.userId;
      actorId = actor.userId;
    }, 60000);

    afterAll(async () => {
      if (db) await db.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
      if (admin) {
        // Only the exact random schema created by this test is removed.
        if (/^quest_test_[a-f0-9]+$/.test(schema))
          await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.end();
      }
    });

    function claim(key: string, targetUser = userId, selectedPolicy = policy) {
      return repository.claim({
        key,
        userId: targetUser,
        actorId,
        now,
        policy: selectedPolicy,
        model: 'test-model',
        summary: { purchases30d: 10 },
        candidates: [candidate],
      });
    }

    it('cancels only active retired quests and preserves completed history and points', async () => {
      const rows = await db.$queryRaw<
        {
          quest_name: string;
          status: string;
          cancellation_reason: string | null;
          cancelled_at: Date | null;
          completed_at: Date | null;
        }[]
      >`
        SELECT q.quest_name,uq.status,uq.cancellation_reason,uq.cancelled_at,uq.completed_at
        FROM user_quests uq JOIN quests q USING(quest_id) ORDER BY q.quest_name`;
      const cancelled = rows.filter((r) => r.status === 'CANCELLED');
      expect(cancelled).toHaveLength(2);
      expect(
        cancelled.every(
          (r) =>
            r.cancellation_reason === 'QUEST_TYPE_RETIRED_POLICY_V2' &&
            r.cancelled_at !== null,
        ),
      ).toBe(true);
      expect(
        rows.find((r) => r.quest_name === 'keep-product-completed')?.status,
      ).toBe('COMPLETED');
      expect(
        rows.find((r) => r.quest_name === 'keep-product-completed')
          ?.completed_at,
      ).not.toBeNull();
      expect(
        rows.find((r) => r.quest_name === 'keep-merchant-expired')?.status,
      ).toBe('EXPIRED');
      expect(
        rows.find((r) => r.quest_name === 'keep-product-stale-active')?.status,
      ).toBe('ACTIVE');
      expect(
        rows.find((r) => r.quest_name === 'keep-product-stale-active')
          ?.cancelled_at,
      ).toBeNull();
      expect(rows.find((r) => r.quest_name === 'keep-min-active')?.status).toBe(
        'ACTIVE',
      );
      const legacy = await db.user.findUnique({
        where: { citizenId: '0000000000099' },
        select: { pointBalance: true },
      });
      expect(legacy?.pointBalance).toBe(20);
      expect(await db.pointTransaction.count()).toBe(1);
      await expect(
        db.userQuest.updateMany({
          where: { status: 'CANCELLED' },
          data: { cancelledAt: null, cancellationReason: null },
        }),
      ).rejects.toThrow();
      await expect(
        db.quest.create({
          data: {
            questName: 'Rejected',
            questType: 'PRODUCT_PURCHASE',
            rewardPoint: 20,
            durationDays: 7,
          },
        }),
      ).rejects.toThrow();
      await expect(
        db.quest.create({
          data: {
            questName: 'Rejected merchant',
            questType: 'MERCHANT_SPEND',
            minSpend: 90,
            rewardPoint: 20,
            durationDays: 7,
          },
        }),
      ).rejects.toThrow();
    });
    it('completes a category quest at another shop and rewards concurrent retries once', async () => {
      const consumer = await db.user.create({
        data: {
          citizenId: '0000000000007',
          fullName: 'Cross-store fixture',
          passwordHash: 'not-a-login-hash',
        },
      });
      const category = await db.productCategory.create({
        data: { categoryName: 'Shared category fixture' },
      });
      const shopA = await db.merchant.create({
        data: {
          ownerUserId: actorId,
          merchantName: 'Cross-store A',
          status: 'ACTIVE',
        },
      });
      const shopB = await db.merchant.create({
        data: {
          ownerUserId: actorId,
          merchantName: 'Cross-store B',
          status: 'ACTIVE',
        },
      });
      const productA = await db.product.create({
        data: {
          merchantId: shopA.merchantId,
          categoryId: category.categoryId,
          productName: 'A item',
          price: '100',
        },
      });
      const productB = await db.product.create({
        data: {
          merchantId: shopB.merchantId,
          categoryId: category.categoryId,
          productName: 'B item',
          price: '100',
        },
      });
      expect(productA.productId).not.toBe(productB.productId);
      const quest = await db.quest.create({
        data: {
          questName: 'Cross-store category',
          questType: 'CATEGORY_SPEND',
          targetCategoryId: category.categoryId,
          minSpend: '90',
          rewardPoint: 20,
          durationDays: 7,
        },
      });
      const assignment = await db.userQuest.create({
        data: {
          userId: consumer.userId,
          questId: quest.questId,
          assignedAt: new Date(now.getTime() - 86400000),
          expiresAt: new Date(now.getTime() + 86400000),
        },
      });
      // Paid receipt facts are seeded here; this verifies completion transactions, not payment.
      const receipt = await db.order.create({
        data: {
          userId: consumer.userId,
          merchantId: shopB.merchantId,
          status: 'PAID',
          paidAt: now,
          subtotal: '100',
          discountAmount: '10',
          finalAmount: '90',
          userPaidAmount: '90',
        },
      });
      await db.orderItem.create({
        data: {
          orderId: receipt.orderId,
          productId: productB.productId,
          categoryId: category.categoryId,
          productNameSnapshot: 'B item snapshot',
          unitPrice: '100',
          quantity: 1,
          lineTotal: '100',
        },
      });
      const results = await Promise.all([
        repository.evaluateAndCompleteOrder(receipt.orderId, policy),
        repository.evaluateAndCompleteOrder(receipt.orderId, policy),
      ]);
      expect(results.filter((r) => r !== null)).toHaveLength(1);
      expect(
        await db.pointTransaction.count({
          where: { userQuestId: assignment.userQuestId },
        }),
      ).toBe(1);
      expect(
        (await db.user.findUnique({ where: { userId: consumer.userId } }))
          ?.pointBalance,
      ).toBe(20);
      expect(
        (
          await db.userQuest.findUnique({
            where: { userQuestId: assignment.userQuestId },
          })
        )?.completedOrderId,
      ).toBe(receipt.orderId);
    });
    it('preserves legacy audit facts and uses only the existing log table', async () => {
      const rows = await db.$queryRaw<
        {
          status: string;
          request_key: string | null;
          selection_reason: string;
          generated_quest_id: bigint;
          candidate_scores: unknown;
        }[]
      >`
        SELECT status,request_key,selection_reason,generated_quest_id,candidate_scores FROM quest_generation_logs WHERE status='LEGACY'`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.request_key).toBeNull();
      expect(rows[0]?.selection_reason).toBe('legacy-reason');
      expect(rows[0]?.candidate_scores).toEqual({ score: 42 });
      expect(rows[0]?.generated_quest_id).toBeDefined();
      const [absent] = await db.$queryRaw<
        { absent: boolean }[]
      >`SELECT to_regclass('quest_generation_runs') IS NULL AS absent`;
      expect(absent?.absent).toBe(true);
    });
    it('serializes duplicate and distinct claims, assigns once, and preserves snapshot', async () => {
      const key = randomUUID();
      const results = await Promise.all([claim(key), claim(key)]);
      expect(results.filter((r) => r.claimed)).toHaveLength(1);
      const other = await claim(randomUUID());
      expect(other.run.reason).toBe('ACTIVE_LIMIT');
      await expect(
        repository.claim({
          key,
          userId: actorId,
          actorId,
          now,
          policy,
          model: 'test',
          summary: {},
          candidates: [candidate],
        }),
      ).rejects.toThrow('QUEST_IDEMPOTENCY_CONFLICT');
      const assigned = await repository.finalize(
        key,
        candidate,
        { scores: [] },
        policy,
        now,
      );
      expect(assigned.status).toBe('ASSIGNED');
      expect((await claim(key)).claimed).toBe(false);
      await expect(
        repository.finalize(key, candidate, {}, policy, now),
      ).rejects.toThrow('QUEST_GENERATION_NOT_PENDING');
      expect(await db.userQuest.count({ where: { userId } })).toBe(1);
      expect(await repository.list(actorId, now)).toEqual([]);
      const listed = await repository.list(userId, now);
      expect(listed[0]?.minimumSpendMinor).toBe('9000');
      const [snapshot] = await db.$queryRaw<
        { version: string }[]
      >`SELECT policy_version AS version FROM quest_generation_logs WHERE request_key=${key}::uuid`;
      expect(snapshot?.version).toBe(policy.version);
    });

    it('reserves the global budget across users and releases failed claims', async () => {
      const second = await db.user.create({
        data: {
          citizenId: '0000000000003',
          fullName: 'Other',
          passwordHash: 'not-a-login-hash',
        },
      });
      const limited = structuredClone(policy);
      limited.rewards.globalDailyReservationBudgetPoints = 40;
      limited.rewards.globalOutstandingReservationBudgetPoints = 40;
      const key = randomUUID();
      expect((await claim(key, second.userId, limited)).claimed).toBe(true);
      const third = await db.user.create({
        data: {
          citizenId: '0000000000004',
          fullName: 'Third',
          passwordHash: 'not-a-login-hash',
        },
      });
      expect(
        (await claim(randomUUID(), third.userId, limited)).run.reason,
      ).toBe('BUDGET_LIMIT');
      await repository.fail(key, 'PROVIDER_UNAVAILABLE_OR_INVALID', now);
      const expiredKey = randomUUID();
      expect((await claim(expiredKey, third.userId, limited)).claimed).toBe(
        true,
      );
      const expired = await repository.finalize(
        expiredKey,
        candidate,
        {},
        limited,
        new Date(now.getTime() + 120001),
      );
      expect(expired.reason).toBe('LEASE_EXPIRED');
    });

    it('enforces positive reservation and status/assignment constraints in PostgreSQL', async () => {
      await expect(
        db.$executeRaw`UPDATE quest_generation_logs SET reserved_points=0`,
      ).rejects.toThrow();
      await expect(
        db.$executeRaw`UPDATE quest_generation_logs SET status='ASSIGNED' WHERE assignment_id IS NULL`,
      ).rejects.toThrow();
    });
    it('terminalizes crashed claims and rejects changed policy/candidate snapshots', async () => {
      const fourth = await db.user.create({
        data: {
          citizenId: '0000000000005',
          fullName: 'Fourth',
          passwordHash: 'not-a-login-hash',
        },
      });
      const staleKey = randomUUID();
      expect((await claim(staleKey, fourth.userId)).claimed).toBe(true);
      const replay = await repository.claim({
        key: staleKey,
        userId: fourth.userId,
        actorId,
        now: new Date(now.getTime() + 120001),
        policy,
        model: 'test',
        summary: {},
        candidates: [candidate],
      });
      expect(replay.run.reason).toBe('LEASE_EXPIRED');
      expect(replay.run.status).toBe('FAILED');
      const next = randomUUID();
      expect((await claim(next, fourth.userId)).claimed).toBe(true);
      expect(
        (
          await repository.finalize(
            next,
            { ...candidate, rewardPoints: 999 },
            {},
            policy,
            now,
          )
        ).reason,
      ).toBe('SNAPSHOT_MISMATCH');
    });
    it('reads owned paid receipts only, including the exact 30-day boundary', async () => {
      const consumer = await db.user.create({
        data: {
          citizenId: '0000000000006',
          fullName: 'History',
          passwordHash: 'not-a-login-hash',
        },
      });
      const merchant = await db.merchant.create({
        data: {
          ownerUserId: actorId,
          merchantName: 'Test shop',
          status: 'ACTIVE',
        },
      });
      const category = await db.productCategory.create({
        data: { categoryName: 'Test category' },
      });
      const product = await db.product.create({
        data: {
          merchantId: merchant.merchantId,
          categoryId: category.categoryId,
          productName: 'Test item',
          price: '100',
        },
      });
      for (const [daysAgo, owner, status] of [
        [30, consumer.userId, 'PAID'],
        [7, consumer.userId, 'PAID'],
        [1, consumer.userId, 'PAID'],
        [0, consumer.userId, 'PAID'],
        [31, consumer.userId, 'PAID'],
        [2, actorId, 'PAID'],
        [2, consumer.userId, 'PENDING'],
      ] as const) {
        const order = await db.order.create({
          data: {
            userId: owner,
            merchantId: merchant.merchantId,
            status,
            paidAt: new Date(now.getTime() - daysAgo * 86400000),
            subtotal: '100',
            discountAmount: '10',
            finalAmount: '90',
            userPaidAmount: '90',
          },
        });
        await db.orderItem.create({
          data: {
            orderId: order.orderId,
            productId: product.productId,
            categoryId: category.categoryId,
            productNameSnapshot: 'Snapshot item',
            unitPrice: '100',
            quantity: 1,
            lineTotal: '100',
          },
        });
      }
      const history = await repository.history(consumer.userId, now, policy);
      const input = buildQuestInput(
        history.facts,
        history.catalog,
        history.prior,
        policy,
        now,
      );
      expect(input.summary.purchases30d).toBe(3);
      expect(input.summary.purchases7d).toBe(2);
      expect(input.summary.totalSpendMinor).toBe('27000');
      expect(input.summary.categories[0]?.totalSpendMinor).toBe('27000');
      expect(input.candidates.some((c) => c.type === 'CATEGORY_SPEND')).toBe(
        true,
      );
      const productCandidate = input.candidates.find(
        (c) => c.type === 'CATEGORY_SPEND',
      );
      if (!productCandidate) throw new Error('Missing fixture candidate');
      const key = randomUUID();
      expect(
        (
          await repository.claim({
            key,
            userId: consumer.userId,
            actorId,
            now,
            policy,
            model: 'test',
            summary: input.summary,
            candidates: [productCandidate],
          })
        ).claimed,
      ).toBe(true);
      await db.product.update({
        where: { productId: product.productId },
        data: { status: 'INACTIVE' },
      });
      expect(
        (await repository.catalog()).categories.has(
          String(category.categoryId),
        ),
      ).toBe(false);
      expect(
        (await repository.finalize(key, productCandidate, {}, policy, now))
          .reason,
      ).toBe('CATALOG_CHANGED');
    });
  },
);
