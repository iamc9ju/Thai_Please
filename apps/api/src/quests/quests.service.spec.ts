import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiQuestProvider } from './gemini.provider.js';
import { QuestsRepository, type GenerationRun } from './quests.repository.js';
import { QuestsService } from './quests.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const KEY = '00000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-10-28T03:00:00Z');
const raw = (amount: string) => ({
  type: 'MIN_SPEND',
  targetId: null,
  minimumSpendMinor: amount,
});
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const repository = new QuestsRepository(new PrismaService());
  const provider = new GeminiQuestProvider(new ConfigService());
  const run: GenerationRun = {
    request_key: KEY,
    user_id: 1n,
    requested_by: 1n,
    status: 'PENDING',
    reason: null,
    assignment_id: null,
  };
  const historyData = {
    facts: [1, 2, 3].map((id) => ({
      id: String(id),
      merchantId: '1',
      paidAt: new Date(NOW.getTime() - id * 86400000),
      finalMinor: 12000n,
      personalMinor: 6000n,
      items: [
        { id: String(id), productId: '1', categoryId: '1', lineMinor: 12000n },
      ],
    })),
    catalog: {
      categories: new Set(['1']),
      categoryNames: new Map([['1', 'อาหาร']]),
    },
    prior: [],
  };
  const history = vi
    .spyOn(repository, 'history')
    .mockResolvedValue(historyData);
  const replay = vi.spyOn(repository, 'replay').mockResolvedValue(undefined);
  const claim = vi
    .spyOn(repository, 'claim')
    .mockResolvedValue({ run, claimed: true });
  const state = {
    status: 'ELIGIBLE' as const,
    requestKey: null,
    expiresAt: null,
    nextEligibleAt: null,
    reason: null,
    items: [],
  };
  const proposalState = vi
    .spyOn(repository, 'proposalState')
    .mockResolvedValue(state);
  const takeJob = vi.spyOn(repository, 'takeGenerationJob').mockResolvedValue({
    key: KEY,
    userId: 1n,
    asOf: NOW,
    summary: { safe: true },
  });
  const save = vi
    .spyOn(repository, 'saveProposals')
    .mockResolvedValue({ ...run, status: 'READY' });
  const fail = vi.spyOn(repository, 'fail').mockResolvedValue();
  const propose = vi.spyOn(provider, 'propose');
  const service = new QuestsService(
    repository,
    provider,
    new ConfigService({ GEMINI_MODEL: 'fixture-model' }),
  );
  return {
    repository,
    provider,
    service,
    history,
    historyData,
    replay,
    claim,
    proposalState,
    takeJob,
    save,
    fail,
    propose,
    run,
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('FR-C07 constrained proposal workflow', () => {
  it('queues minimized personal summary without calling the provider in the request', async () => {
    const f = fixture();
    await f.service.generate(1n, 1n, KEY);
    expect(f.propose).not.toHaveBeenCalled();
    expect(f.claim.mock.calls[0]?.[0].summary).toMatchObject({
      amountBasis: 'PERSONAL_AFTER_DISCOUNT',
      purchases: { receiptCount: 3, averagePersonalMinor: '6000' },
    });
  });
  it('does not queue a second set while a set or entitlement already exists', async () => {
    const f = fixture();
    f.proposalState.mockResolvedValue({
      status: 'COOLDOWN',
      requestKey: null,
      expiresAt: null,
      nextEligibleAt: NOW.toISOString(),
      reason: 'CYCLE_LIMIT',
      items: [],
    });
    await f.service.generate(1n, 1n, KEY);
    expect(f.history).not.toHaveBeenCalled();
    expect(f.claim).not.toHaveBeenCalled();
  });
  it('replays before reading changed history', async () => {
    const f = fixture();
    f.replay.mockResolvedValue(f.run);
    await f.service.generate(1n, 1n, KEY);
    expect(f.history).not.toHaveBeenCalled();
    expect(f.claim).not.toHaveBeenCalled();
  });
  it('keeps valid proposals and requests only the missing count, never exceeding two calls', async () => {
    const f = fixture();
    f.propose
      .mockResolvedValueOnce([raw('6000'), raw('9313')])
      .mockResolvedValueOnce([raw('6000'), raw('7000'), raw('8000')]);
    await f.service.processNextGeneration();
    expect(f.propose).toHaveBeenCalledTimes(2);
    expect(f.propose.mock.calls[1]?.[2]).toBe(2);
    expect(f.propose.mock.calls[1]?.[3]).toEqual([raw('6000')]);
    expect(f.save.mock.calls[0]?.[1].map((p) => p.minimumSpendMinor)).toEqual([
      '6000',
      '7000',
      '8000',
    ]);
    expect(f.fail).not.toHaveBeenCalled();
  });
  it('persists a partial set when the fill request times out', async () => {
    const f = fixture();
    f.propose
      .mockResolvedValueOnce([raw('6000')])
      .mockRejectedValueOnce(
        new ServiceUnavailableException({ code: 'QUEST_AI_TIMEOUT' }),
      );
    await f.service.processNextGeneration();
    expect(f.propose).toHaveBeenCalledTimes(2);
    expect(f.save.mock.calls[0]?.[1]).toHaveLength(1);
    expect(f.fail).not.toHaveBeenCalled();
  });
  it('fails with zero valid proposals and never assigns or starts an entitlement', async () => {
    const f = fixture();
    f.propose.mockResolvedValue([raw('9313')]);
    await f.service.processNextGeneration();
    expect(f.propose).toHaveBeenCalledTimes(2);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.fail).toHaveBeenCalledWith(
      KEY,
      'QUEST_AI_INVALID_RESPONSE',
      expect.any(Date),
      expect.objectContaining({
        output: { attempts: expect.any(Array) },
        rejections: [],
      }),
    );
  });
  it('does not retry quota/access failures or leak provider errors', async () => {
    const f = fixture();
    f.propose.mockRejectedValue(
      new BadGatewayException({
        code: 'QUEST_AI_ACCESS_DENIED',
        private: 'never log this',
      }),
    );
    await f.service.processNextGeneration();
    expect(f.propose).toHaveBeenCalledTimes(1);
    expect(f.fail).toHaveBeenCalledWith(
      KEY,
      'QUEST_AI_ACCESS_DENIED',
      expect.any(Date),
      expect.objectContaining({
        output: { attempts: expect.any(Array) },
        rejections: [],
      }),
    );
  });
  it('does not invoke provider without durable job ownership', async () => {
    const f = fixture();
    f.takeJob.mockResolvedValue(null);
    await f.service.processNextGeneration();
    expect(f.propose).not.toHaveBeenCalled();
  });
  it('defers insufficient personal-spend history without fabricating a quest', async () => {
    const f = fixture();
    const history = f.historyData;
    f.history.mockResolvedValue({
      ...history,
      facts: history.facts.map((fact) => ({ ...fact, personalMinor: 0n })),
    });
    await f.service.processNextGeneration();
    expect(f.propose).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
    expect(f.fail).toHaveBeenCalledWith(
      KEY,
      'INSUFFICIENT_HISTORY',
      expect.any(Date),
    );
  });
  it('delegates exactly-once completion to repository', async () => {
    const f = fixture();
    const complete = vi
      .spyOn(f.repository, 'evaluateAndCompleteOrder')
      .mockResolvedValue(null);
    expect(await f.service.evaluateOrder(99n)).toBeNull();
    expect(complete).toHaveBeenCalledWith(99n, expect.any(Object));
  });
});
