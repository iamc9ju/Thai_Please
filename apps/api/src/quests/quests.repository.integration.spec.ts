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
      expect(await db.userQuest.count()).toBe(1);
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
        (c) => c.type === 'PRODUCT_PURCHASE',
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
        (await repository.catalog()).products.has(String(product.productId)),
      ).toBe(false);
      expect(
        (await repository.finalize(key, productCandidate, {}, policy, now))
          .reason,
      ).toBe('CATALOG_CHANGED');
    });
  },
);
