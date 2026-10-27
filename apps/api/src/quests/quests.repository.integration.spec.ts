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
import { buildProposalSummary } from './quest-proposals.js';

// Explicit opt-in; only the random schema created below is mutated/deleted.
const enabled = process.env.QUEST_RUN_DATABASE_TESTS === '1';
describe.skipIf(!enabled)('personal-spend proposal PostgreSQL workflow', () => {
  const schema = `quest_test_${randomUUID().replaceAll('-', '')}`;
  const policy = parseQuestPolicy(
    JSON.parse(
      readFileSync(
        new URL('./config/quest-policy.json', import.meta.url),
        'utf8',
      ),
    ) as unknown,
  );
  const now = new Date('2026-10-28T01:00:00Z');
  const day = 86_400_000;
  let admin: Client;
  let db: PrismaService;
  let repo: QuestsRepository;
  let previousUrl: string | undefined;
  let actorId: bigint;
  let sequence = 0;
  const candidate: Candidate = {
    id: 'MIN_SPEND:ALL:6000',
    type: 'MIN_SPEND',
    targetId: null,
    minimumSpendMinor: '6000',
    rewardPoints: 20,
    durationDays: 7,
  };
  beforeAll(async () => {
    config({ path: '../../.env', quiet: true });
    const url = process.env.QUEST_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error('QUEST_TEST_DATABASE_URL required');
    previousUrl = process.env.DATABASE_URL;
    admin = new Client({
      connectionString: url,
      connectionTimeoutMillis: 10000,
    });
    await admin.connect();
    if (!/^quest_test_[a-f0-9]+$/.test(schema))
      throw new Error('Invalid test schema');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(
      readFileSync(
        new URL(
          '../../prisma/migrations/0_init/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ).replace('CREATE SCHEMA IF NOT EXISTS "public";', ''),
    );
    await admin.query(
      readFileSync(
        new URL(
          '../../prisma/migrations/20261016090000_extend_quest_generation_logs/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await admin.query(
      readFileSync(
        new URL(
          '../../prisma/migrations/20261027090000_retire_product_merchant_quests/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    // Representative legacy assignments before the personal-spend upgrade.
    await admin.query(`WITH u AS (INSERT INTO users(citizen_id,full_name,password_hash) VALUES('0000000000099','Migration fixture','not-a-login-hash') RETURNING user_id),
      q AS (INSERT INTO quests(quest_name,quest_type,min_spend,reward_point,duration_days) VALUES('old-active','MIN_SPEND',60,20,7),('old-completed','MIN_SPEND',60,20,7) RETURNING quest_id,quest_name)
      INSERT INTO user_quests(user_id,quest_id,status,assigned_at,expires_at,completed_at)
      SELECT u.user_id,q.quest_id,CASE WHEN q.quest_name='old-active' THEN 'ACTIVE' ELSE 'COMPLETED' END,
      TIMESTAMP '2026-10-01',TIMESTAMP '2099-01-01',CASE WHEN q.quest_name='old-completed' THEN TIMESTAMP '2026-10-02' ELSE NULL END FROM u,q`);
    await admin.query(`INSERT INTO point_transactions(user_id,user_quest_id,transaction_type,points,expires_at,created_at)
      SELECT uq.user_id,uq.user_quest_id,'QUEST_REWARD',20,TIMESTAMP '2099-01-01',TIMESTAMP '2026-10-02' FROM user_quests uq JOIN quests q USING(quest_id) WHERE q.quest_name='old-completed';
      UPDATE users SET point_balance=20 WHERE citizen_id='0000000000099'`);
    await admin.query(
      readFileSync(
        new URL(
          '../../prisma/migrations/20261028090000_quest_proposals_personal_spend/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const isolated = new URL(url);
    isolated.searchParams.set('schema', schema);
    isolated.searchParams.set(
      'options',
      `-c search_path=${schema} -c timezone=Asia/Bangkok`,
    );
    process.env.DATABASE_URL = isolated.toString();
    db = new PrismaService();
    await db.$connect();
    repo = new QuestsRepository(db);
    actorId = (await user('ADMIN')).userId;
  }, 60000);
  afterAll(async () => {
    if (db) await db.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (admin) {
      if (/^quest_test_[a-f0-9]+$/.test(schema))
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
  async function user(role = 'CONSUMER') {
    sequence++;
    return db.user.create({
      data: {
        citizenId: String(sequence).padStart(13, '0'),
        fullName: 'Isolated fixture',
        passwordHash: 'not-a-login-hash',
        role,
      },
    });
  }
  function claim(
    userId: bigint,
    key = randomUUID(),
    time = now,
    selectedPolicy = policy,
  ) {
    return repo.claim({
      key,
      userId,
      actorId: userId,
      now: time,
      policy: selectedPolicy,
      model: 'fixture',
      summary: { summaryVersion: 'fixture' },
    });
  }
  async function ready(userId: bigint, time = now, selectedPolicy = policy) {
    const key = randomUUID();
    await claim(userId, key, time, selectedPolicy);
    await repo.saveProposals(key, [candidate], selectedPolicy, time);
    return key;
  }
  it('migrates active legacy quests without rewriting completed history or points', async () => {
    const rows = await db.userQuest.findMany({
      include: { quest: true },
      where: { user: { citizenId: '0000000000099' } },
    });
    expect(rows.find((r) => r.quest.questName === 'old-active')).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'PERSONAL_SPEND_POLICY_V3',
      nextEligibleAt: null,
    });
    expect(
      rows.find((r) => r.quest.questName === 'old-completed')?.status,
    ).toBe('COMPLETED');
    expect(await db.pointTransaction.count()).toBe(1);
    expect(
      (await db.user.findUnique({ where: { citizenId: '0000000000099' } }))
        ?.pointBalance,
    ).toBe(20);
    const [absent] = await db.$queryRaw<
      { absent: boolean }[]
    >`SELECT to_regclass('quest_generation_runs') IS NULL AS absent`;
    expect(absent?.absent).toBe(true);
  });
  it('serializes concurrent generation claims, queues once and expires interrupted workers', async () => {
    const u = await user();
    const key = randomUUID();
    const claims = await Promise.all([
      claim(u.userId, key),
      claim(u.userId, key),
    ]);
    expect(claims.filter((r) => r.claimed)).toHaveLength(1);
    expect((await claim(u.userId)).claimed).toBe(false);
    const [jobA, jobB] = await Promise.all([
      repo.takeGenerationJob(now, policy),
      repo.takeGenerationJob(now, policy),
    ]);
    expect([jobA, jobB].filter((j) => j?.key === key)).toHaveLength(1);
    expect(await repo.takeGenerationJob(now, policy)).toBeNull();
    await expect(repo.replay(key, u.userId + 1n, actorId, now)).rejects.toThrow(
      'QUEST_IDEMPOTENCY_CONFLICT',
    );
    expect(
      (
        await repo.replay(
          key,
          u.userId,
          u.userId,
          new Date(now.getTime() + 120001),
        )
      )?.status,
    ).toBe('FAILED');
    expect(
      (
        await repo.proposalState(
          u.userId,
          new Date(now.getTime() + 120001),
          policy,
        )
      ).status,
    ).toBe('FAILED');
    await expect(
      claim(u.userId, randomUUID(), new Date(now.getTime() + 120002)),
    ).rejects.toThrow('QUEST_GENERATION_COOLDOWN');
  });
  it('terminalizes queued work after policy changes before a provider call can start', async () => {
    const u = await user();
    const key = randomUUID();
    const old = structuredClone(policy);
    old.version = 'quest-policy-v999';
    await claim(u.userId, key, now, old);
    expect(await repo.takeGenerationJob(now, policy)).toBeNull();
    expect(
      (await db.questGenerationLog.findUnique({ where: { requestKey: key } }))
        ?.selectionReason,
    ).toBe('POLICY_CHANGED');
  });
  it('persists a partial set without reserving rewards and selects one atomically', async () => {
    const u = await user();
    const key = await ready(u.userId);
    const state = await repo.proposalState(u.userId, now, policy);
    expect(state.status).toBe('READY');
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.minimumSpend).toBe('60.00');
    const log = await db.questGenerationLog.findUnique({
      where: { requestKey: key },
    });
    expect(log?.reservedPoints).toBe(0);
    expect(await db.userQuest.count({ where: { userId: u.userId } })).toBe(0);
    const selectionKey = randomUUID();
    const results = await Promise.all([
      repo.select(u.userId, key, candidate.id, selectionKey, policy, now),
      repo.select(u.userId, key, candidate.id, selectionKey, policy, now),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await db.userQuest.count({ where: { userId: u.userId } })).toBe(1);
    await expect(
      repo.select(u.userId, key, candidate.id, randomUUID(), policy, now),
    ).rejects.toThrow('QUEST_ALREADY_SELECTED');
    await expect(
      repo.select(actorId, key, candidate.id, selectionKey, policy, now),
    ).rejects.toThrow();
    const assigned = await db.userQuest.findFirst({
      where: { userId: u.userId },
      include: { quest: true },
    });
    expect(assigned?.quest.amountBasis).toBe('PERSONAL_AFTER_DISCOUNT');
    expect(assigned?.quest.ruleVersion).toBe(policy.version);
    expect((await repo.proposalState(u.userId, now, policy)).status).toBe(
      'COOLDOWN',
    );
    if (!assigned) throw new Error('Missing assignment');
    await db.userQuest.update({
      where: { userQuestId: assigned.userQuestId },
      data: { status: 'COMPLETED', completedAt: new Date(now.getTime() + day) },
    });
    expect(
      (
        await repo.proposalState(
          u.userId,
          new Date(now.getTime() + 6 * day),
          policy,
        )
      ).status,
    ).toBe('COOLDOWN');
    expect(
      (
        await repo.proposalState(
          u.userId,
          new Date(now.getTime() + 7 * day),
          policy,
        )
      ).status,
    ).toBe('ELIGIBLE');
    expect((await repo.list(u.userId, now))[0]?.amountBasis).toBe(
      'PERSONAL_AFTER_DISCOUNT',
    );
  });
  it('allows only one of two distinct simultaneous choices and binds idempotency to the payload', async () => {
    const u = await user();
    const key = randomUUID();
    await claim(u.userId, key);
    const other: Candidate = {
      ...candidate,
      id: 'MIN_SPEND:ALL:8000',
      minimumSpendMinor: '8000',
    };
    await repo.saveProposals(key, [candidate, other], policy, now);
    const firstKey = randomUUID();
    const secondKey = randomUUID();
    const result = await Promise.allSettled([
      repo.select(u.userId, key, candidate.id, firstKey, policy, now),
      repo.select(u.userId, key, other.id, secondKey, policy, now),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.userQuest.count({ where: { userId: u.userId } })).toBe(1);
    const log = await db.questGenerationLog.findUnique({
      where: { requestKey: key },
    });
    if (!log?.selectionKey) throw new Error('Missing selection key');
    const wrongId =
      log.selectedProposalId === candidate.id ? other.id : candidate.id;
    await expect(
      repo.select(u.userId, key, wrongId, log.selectionKey, policy, now),
    ).rejects.toThrow('QUEST_IDEMPOTENCY_CONFLICT');
  });
  it('rejects expired sets, invalid results and changed policy snapshots', async () => {
    const u = await user();
    const key = await ready(u.userId);
    await expect(
      repo.select(
        u.userId,
        key,
        candidate.id,
        randomUUID(),
        policy,
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
      ),
    ).rejects.toThrow('QUEST_PROPOSALS_EXPIRED');
    const changed = structuredClone(policy);
    changed.rewards.pointsByType.MIN_SPEND = 30;
    changed.rewards.pointsByType.CATEGORY_SPEND = 30;
    await expect(
      repo.select(u.userId, key, candidate.id, randomUUID(), changed, now),
    ).rejects.toThrow('QUEST_POLICY_CHANGED');
    const empty = await user();
    const emptyKey = randomUUID();
    await claim(empty.userId, emptyKey);
    expect(
      (
        await repo.saveProposals(
          emptyKey,
          [{ ...candidate, minimumSpendMinor: '9300' }],
          policy,
          now,
        )
      ).status,
    ).toBe('FAILED');
    expect((await repo.proposalState(empty.userId, now, policy)).items).toEqual(
      [],
    );
  });
  it('rechecks global budget at selection, not generation', async () => {
    const a = await user();
    const b = await user();
    const budget = structuredClone(policy);
    budget.rewards.globalDailyReservationBudgetPoints = 20;
    budget.rewards.globalOutstandingReservationBudgetPoints = 20;
    // Earlier tests issue rewards on now; use a distinct next-day budget window.
    const time = new Date(now.getTime() + 20 * day);
    const ka = await ready(a.userId, time, budget);
    const kb = await ready(b.userId, time, budget);
    const result = await Promise.allSettled([
      repo.select(a.userId, ka, candidate.id, randomUUID(), budget, time),
      repo.select(b.userId, kb, candidate.id, randomUUID(), budget, time),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(result.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('enforces log lifecycle constraints while permitting zero reservation on READY', async () => {
    const u = await user();
    const key = await ready(u.userId);
    await expect(
      db.$executeRaw`UPDATE quest_generation_logs SET status='ASSIGNED' WHERE request_key=${key}::uuid`,
    ).rejects.toThrow();
    await expect(
      db.$executeRaw`UPDATE quest_generation_logs SET generated_proposals='[]'::jsonb WHERE request_key=${key}::uuid`,
    ).rejects.toThrow();
    await expect(
      db.$executeRaw`UPDATE quest_generation_logs SET reserved_points=-1 WHERE request_key=${key}::uuid`,
    ).rejects.toThrow();
  });
  it('uses personal contribution, snapshot categories and rewards concurrent receipt retries once', async () => {
    const u = await user();
    const cat = await db.productCategory.create({
      data: { categoryName: 'Personal category' },
    });
    const shop = await db.merchant.create({
      data: {
        ownerUserId: actorId,
        merchantName: 'Personal shop',
        status: 'ACTIVE',
      },
    });
    const product = await db.product.create({
      data: {
        merchantId: shop.merchantId,
        categoryId: cat.categoryId,
        productName: 'Fixture item',
        price: '120',
      },
    });
    const categoryCandidate: Candidate = {
      ...candidate,
      id: `CATEGORY_SPEND:${cat.categoryId}:6000`,
      type: 'CATEGORY_SPEND',
      targetId: String(cat.categoryId),
    };
    const key = randomUUID();
    await claim(u.userId, key);
    await repo.saveProposals(key, [categoryCandidate], policy, now);
    await repo.select(
      u.userId,
      key,
      categoryCandidate.id,
      randomUUID(),
      policy,
      now,
    );
    async function receipt(personal: string) {
      const paid = await db.order.create({
        data: {
          userId: u.userId,
          merchantId: shop.merchantId,
          status: 'PAID',
          paidAt: new Date(now.getTime() + 1000),
          subtotal: '120',
          discountAmount: '20',
          finalAmount: '100',
          userPaidAmount: personal,
          subsidyAmount: String(100 - Number(personal)),
        },
      });
      await db.orderItem.create({
        data: {
          orderId: paid.orderId,
          productId: product.productId,
          categoryId: cat.categoryId,
          productNameSnapshot: 'Immutable fixture',
          unitPrice: '120',
          quantity: 1,
          lineTotal: '120',
        },
      });
      return paid;
    }
    const insufficient = await receipt('50');
    expect(
      await repo.evaluateAndCompleteOrder(insufficient.orderId, policy),
    ).toBeNull();
    const enough = await receipt('60');
    const results = await Promise.all([
      repo.evaluateAndCompleteOrder(enough.orderId, policy),
      repo.evaluateAndCompleteOrder(enough.orderId, policy),
    ]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(
      await db.pointTransaction.count({ where: { userId: u.userId } }),
    ).toBe(1);
    expect(
      (await db.user.findUnique({ where: { userId: u.userId } }))?.pointBalance,
    ).toBe(20);
    const completed = await db.userQuest.findFirst({
      where: { userId: u.userId, status: 'COMPLETED' },
    });
    if (!completed) throw new Error('Missing completed assignment');
    await expect(
      db.pointTransaction.create({
        data: {
          userId: u.userId,
          userQuestId: completed.userQuestId,
          transactionType: 'QUEST_REWARD',
          points: 20,
          expiresAt: new Date(now.getTime() + day),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.userQuest.create({
        data: {
          userId: u.userId,
          questId: completed.questId,
          status: 'COMPLETED',
          assignedAt: now,
          expiresAt: new Date(now.getTime() + day),
          completedAt: now,
          completedOrderId: enough.orderId,
        },
      }),
    ).rejects.toThrow();
  });
  it('reads owned PAID history at the 30-day boundary with personal money and category names', async () => {
    const u = await user();
    const cat = await db.productCategory.create({
      data: { categoryName: 'History category' },
    });
    const shop = await db.merchant.create({
      data: {
        ownerUserId: actorId,
        merchantName: 'History shop',
        status: 'ACTIVE',
      },
    });
    const product = await db.product.create({
      data: {
        merchantId: shop.merchantId,
        categoryId: cat.categoryId,
        productName: 'History item',
        price: '100',
      },
    });
    for (const [days, owner, status] of [
      [30, u.userId, 'PAID'],
      [7, u.userId, 'PAID'],
      [1, u.userId, 'PAID'],
      [0, u.userId, 'PAID'],
      [31, u.userId, 'PAID'],
      [2, actorId, 'PAID'],
      [2, u.userId, 'PENDING'],
    ] as const) {
      const order = await db.order.create({
        data: {
          userId: owner,
          merchantId: shop.merchantId,
          status,
          paidAt: new Date(now.getTime() - days * day),
          subtotal: '100',
          discountAmount: '10',
          finalAmount: '90',
          userPaidAmount: '45',
          subsidyAmount: '45',
        },
      });
      await db.orderItem.create({
        data: {
          orderId: order.orderId,
          productId: product.productId,
          categoryId: cat.categoryId,
          productNameSnapshot: 'Snapshot',
          unitPrice: '100',
          quantity: 1,
          lineTotal: '100',
        },
      });
    }
    const history = await repo.history(u.userId, now, policy);
    expect(history.facts).toHaveLength(3);
    expect(history.facts.every((f) => f.personalMinor === 4500n)).toBe(true);
    expect(history.catalog.categoryNames?.get(String(cat.categoryId))).toBe(
      'History category',
    );
    const summary = buildProposalSummary(
      history.facts,
      history.catalog,
      history.prior,
      policy,
      now,
    );
    expect(summary.purchases.averagePersonalMinor).toBe('4500');
    const key = randomUUID();
    await claim(u.userId, key);
    const categoryCandidate: Candidate = {
      ...candidate,
      type: 'CATEGORY_SPEND',
      targetId: String(cat.categoryId),
    };
    await repo.saveProposals(key, [categoryCandidate], policy, now);
    await db.product.update({
      where: { productId: product.productId },
      data: { status: 'INACTIVE' },
    });
    expect(await repo.proposalState(u.userId, now, policy)).toMatchObject({
      status: 'FAILED',
      reason: 'QUEST_PROPOSALS_NO_LONGER_ELIGIBLE',
      items: [],
    });
    await expect(
      repo.select(
        u.userId,
        key,
        `CATEGORY_SPEND:${cat.categoryId}:6000`,
        randomUUID(),
        policy,
        now,
      ),
    ).rejects.toThrow('QUEST_PROPOSALS_EXPIRED');
    const retryAt = new Date(
      now.getTime() + policy.proposals.retryCooldownMinutes * 60_000,
    );
    expect((await repo.proposalState(u.userId, retryAt, policy)).status).toBe(
      'ELIGIBLE',
    );
    expect((await claim(u.userId, randomUUID(), retryAt)).claimed).toBe(true);
  });
});
