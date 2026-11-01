import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiQuestProvider } from './gemini.provider.js';
import type { ProposalRules } from './quest-proposals.js';
const rules: ProposalRules = {
  policyVersion: 'quest-policy-v3',
  amountBasis: 'PERSONAL_AFTER_DISCOUNT',
  allowedTypes: ['MIN_SPEND', 'CATEGORY_SPEND'],
  allowedCategories: [{ id: '1', name: 'Food' }],
  spendStepMinor: '1000',
  technicalMaximumSpendMinor: '999999999999',
  blockedProposals: [],
};
function provider(values: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    GEMINI_API_KEY: 'fixture-only-key',
    GEMINI_MODEL: 'fixture-model',
    GEMINI_TIMEOUT_MS: '15000',
  };
  return new GeminiQuestProvider({
    get: <T>(key: string): T | undefined =>
      (Object.hasOwn(values, key) ? values[key] : defaults[key]) as
        T | undefined,
  } as never);
}
function response(proposals: unknown) {
  return new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: JSON.stringify({ proposals }) }] } },
      ],
    }),
    { status: 200 },
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('FR-S02 / FR-S03 Gemini proposals', () => {
  it('requests structured proposals with same policy, partial refill and accepted IDs only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response([
          { type: 'MIN_SPEND', targetId: null, minimumSpendMinor: '7000' },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      provider().propose(
        { purchaseCount: 4 },
        rules,
        1,
        [{ type: 'MIN_SPEND', targetId: null, minimumSpendMinor: '6000' }],
        ['PROPOSAL_DUPLICATE'],
      ),
    ).resolves.toEqual([
      { type: 'MIN_SPEND', targetId: null, minimumSpendMinor: '7000' },
    ]);
    const call = fetchMock.mock.calls[0];
    const request = call?.[1] as RequestInit;
    expect(request.headers).toMatchObject({
      'x-goog-api-key': 'fixture-only-key',
    });
    if (typeof request.body !== 'string') throw new Error('Expected JSON body');
    const body = JSON.parse(request.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    const data = JSON.parse(body.contents[0].parts[0].text);
    expect(data.rules).toEqual(rules);
    expect(data.missingCount).toBe(1);
    expect(data.accepted).toHaveLength(1);
  });
  it('preserves individual invalid entries for independent domain validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response([
            { type: 'MIN_SPEND', targetId: null, minimumSpendMinor: '6000' },
            { sql: 'DROP TABLE' },
          ]),
        ),
    );
    expect(await provider().propose({}, rules, 3)).toHaveLength(2);
  });
  it('rejects excess refill entries and malformed envelope', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(response([{}, {}]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [] })));
    vi.stubGlobal('fetch', mock);
    await expect(provider().propose({}, rules, 1)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    await expect(provider().propose({}, rules, 3)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
  it('does not call network with invalid environment or counts', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    await expect(
      provider({ GEMINI_API_KEY: '' }).propose({}, rules, 3),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(provider().propose({}, rules, 4)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mock).not.toHaveBeenCalled();
  });
  it.each([
    [429, 'QUEST_AI_QUOTA_EXCEEDED'],
    [401, 'QUEST_AI_ACCESS_DENIED'],
    [403, 'QUEST_AI_ACCESS_DENIED'],
    [404, 'QUEST_AI_MODEL_NOT_FOUND'],
    [400, 'QUEST_AI_REQUEST_REJECTED'],
    [503, 'QUEST_AI_UNAVAILABLE'],
  ])('maps status %s without exposing provider body', async (status, code) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('sensitive vendor response', { status: Number(status) }),
        ),
    );
    try {
      await provider().propose({}, rules, 3);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({ response: { code } });
      expect(String(error)).not.toContain('sensitive');
    }
  });
  it('maps network errors without leaking source details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('private source')),
    );
    await expect(provider().propose({}, rules, 3)).rejects.toMatchObject({
      response: { code: 'QUEST_AI_UNAVAILABLE' },
    });
  });
  it('aborts timed out calls without hidden provider retries', async () => {
    vi.useFakeTimers();
    const mock = vi.fn(
      (_url: unknown, request: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          request.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        ),
    );
    vi.stubGlobal('fetch', mock);
    const promise = provider({ GEMINI_TIMEOUT_MS: '1000' }).propose(
      {},
      rules,
      3,
    );
    const assertion = expect(promise).rejects.toMatchObject({
      response: { code: 'QUEST_AI_TIMEOUT' },
    });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
