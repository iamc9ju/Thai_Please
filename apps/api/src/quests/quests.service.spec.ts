import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { GeminiQuestProvider } from './gemini.provider.js';
import { QuestsRepository, type GenerationRun } from './quests.repository.js';
import { QuestsService } from './quests.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('quest generation orchestration', () => {
  function fixture() {
    const repository = new QuestsRepository(new PrismaService());
    const provider = new GeminiQuestProvider(new ConfigService());
    const run: GenerationRun = {
      request_key: '00000000-0000-4000-8000-000000000001',
      user_id: 1n,
      requested_by: 2n,
      status: 'PENDING',
      reason: null,
      assignment_id: null,
    };
    const now = Date.now();
    const history = vi.spyOn(repository, 'history').mockResolvedValue({
      facts: [1, 2, 3].map((id) => ({
        id: String(id),
        merchantId: '1',
        paidAt: new Date(now - id * 86400000),
        finalMinor: 9000n,
        items: [
          { id: String(id), productId: '1', categoryId: '1', lineMinor: 9000n },
        ],
      })),
      catalog: {
        merchants: new Set(['1']),
        products: new Set(['1']),
        categories: new Set(['1']),
      },
      prior: [],
    });
    const claim = vi
      .spyOn(repository, 'claim')
      .mockResolvedValue({ run, claimed: true });
    const fail = vi.spyOn(repository, 'fail').mockResolvedValue();
    const finalize = vi
      .spyOn(repository, 'finalize')
      .mockResolvedValue({ ...run, status: 'ASSIGNED', assignment_id: 9n });
    const service = new QuestsService(
      repository,
      provider,
      new ConfigService({ GEMINI_MODEL: 'test' }),
    );
    const replay = vi.spyOn(repository, 'replay').mockResolvedValue(undefined);
    return {
      service,
      repository,
      provider,
      run,
      claim,
      fail,
      finalize,
      replay,
      history,
    };
  }
  it('does not call Gemini or finalize on an idempotent replay', async () => {
    const f = fixture();
    f.claim.mockResolvedValue({
      run: { ...f.run, status: 'ASSIGNED', assignment_id: 9n },
      claimed: false,
    });
    const rank = vi.spyOn(f.provider, 'rank');
    expect(
      (await f.service.generate(1n, 2n, f.run.request_key)).assignmentId,
    ).toBe('9');
    expect(rank).not.toHaveBeenCalled();
    expect(f.finalize).not.toHaveBeenCalled();
  });
  it('returns a stored outcome before reading changed history', async () => {
    const f = fixture();
    f.replay.mockResolvedValue({
      ...f.run,
      status: 'ASSIGNED',
      assignment_id: 9n,
    });
    f.history.mockRejectedValue(new Error('History changed'));
    expect(
      (await f.service.generate(1n, 2n, f.run.request_key)).assignmentId,
    ).toBe('9');
    expect(f.history).not.toHaveBeenCalled();
    expect(f.claim).not.toHaveBeenCalled();
  });
  it('retries a transient failure and uses deterministic lower-spend tie break', async () => {
    const f = fixture();
    const rank = vi
      .spyOn(f.provider, 'rank')
      .mockRejectedValueOnce(
        new ServiceUnavailableException({ code: 'QUEST_AI_UNAVAILABLE' }),
      )
      .mockImplementation(async (_summary, candidates) =>
        candidates.map((c) => ({ candidateId: c.id, suitabilityScore: 50 })),
      );
    await f.service.generate(1n, 2n, f.run.request_key);
    expect(rank).toHaveBeenCalledTimes(2);
    expect(f.finalize.mock.calls[0]?.[1].type).toBe('PRODUCT_PURCHASE');
    expect(f.fail).not.toHaveBeenCalled();
  });
  it('does not retry invalid output or mint an assignment on failure', async () => {
    const f = fixture();
    const rank = vi
      .spyOn(f.provider, 'rank')
      .mockRejectedValue(
        new BadGatewayException({ code: 'QUEST_AI_INVALID_RESPONSE' }),
      );
    expect((await f.service.generate(1n, 2n, f.run.request_key)).status).toBe(
      'FAILED',
    );
    expect(rank).toHaveBeenCalledTimes(1);
    expect(f.fail).toHaveBeenCalled();
    expect(f.fail.mock.calls[0]?.[1]).toBe('QUEST_AI_INVALID_RESPONSE');
    expect(f.finalize).not.toHaveBeenCalled();
  });
});
