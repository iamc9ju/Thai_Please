import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { GeminiQuestProvider } from './gemini.provider.js';
import type { Candidate } from './quest-candidates.js';

const candidates: readonly Candidate[] = [
  {
    id: 'quest-a',
    type: 'MIN_SPEND',
    targetId: null,
    minimumSpendMinor: '9000',
    rewardPoints: 20,
    durationDays: 7,
  },
  {
    id: 'quest-b',
    type: 'CATEGORY_SPEND',
    targetId: '1',
    minimumSpendMinor: '12000',
    rewardPoints: 20,
    durationDays: 7,
  },
];

function provider(values: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_TIMEOUT_MS: '15000',
  };
  return new GeminiQuestProvider({
    get: <T>(key: string): T | undefined =>
      (Object.hasOwn(values, key) ? values[key] : defaults[key]) as
        T | undefined,
  } as never);
}

function geminiResponse(rankings: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: JSON.stringify({ rankings }) }] } },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('GeminiQuestProvider', () => {
  it('uses Gemini structured JSON and returns rankings with exact candidate coverage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      geminiResponse([
        { candidateId: 'quest-b', suitabilityScore: 90 },
        { candidateId: 'quest-a', suitabilityScore: 72 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(provider().rank({ orders: 10 }, candidates)).resolves.toEqual([
      { candidateId: 'quest-b', suitabilityScore: 90 },
      { candidateId: 'quest-a', suitabilityScore: 72 },
    ]);

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(request.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    if (typeof request.body !== 'string') {
      throw new Error('Expected a JSON request body');
    }
    const payload = JSON.parse(request.body) as {
      contents: [{ parts: [{ text: string }] }];
      systemInstruction: { parts: [{ text: string }] };
      generationConfig: { responseMimeType: string; responseSchema: unknown };
    };
    expect(payload.generationConfig.responseMimeType).toBe('application/json');
    expect(payload.generationConfig.responseSchema).toBeTruthy();
    expect(payload.systemInstruction.parts[0].text).toContain(
      'minimumSpendMinor',
    );
    expect(payload.contents[0].parts[0].text).toContain('CATEGORY_SPEND');
    expect(payload.contents[0].parts[0].text).toContain('12000');
  });

  it.each([
    [[{ candidateId: 'quest-a', suitabilityScore: 10 }]],
    [
      [
        { candidateId: 'quest-a', suitabilityScore: 10 },
        { candidateId: 'quest-a', suitabilityScore: 20 },
      ],
    ],
    [
      [
        { candidateId: 'quest-a', suitabilityScore: 10 },
        { candidateId: 'unknown', suitabilityScore: 20 },
      ],
    ],
  ])(
    'rejects incomplete, duplicate, or unknown Gemini candidate IDs',
    async (rankings) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(geminiResponse(rankings)),
      );
      await expect(provider().rank({}, candidates)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    },
  );

  it('rejects duplicate caller candidate IDs before network access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      provider().rank({}, [
        { ...candidates[0], id: 'same' },
        { ...candidates[1], id: 'same' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock.mock.calls).toHaveLength(0);
  });

  it('uses a safe machine error when configuration is absent', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      provider({ GEMINI_API_KEY: undefined }).rank({}, candidates),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not expose non-success provider responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('key leaked', { status: 429 })),
    );
    await expect(provider().rank({}, candidates)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it.each([
    [429, 'QUEST_AI_QUOTA_EXCEEDED'],
    [403, 'QUEST_AI_ACCESS_DENIED'],
    [404, 'QUEST_AI_MODEL_NOT_FOUND'],
    [400, 'QUEST_AI_REQUEST_REJECTED'],
  ])('reports a safe reason for HTTP %s', async (status, code) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('sensitive provider detail', { status }),
        ),
    );
    try {
      await provider().rank({}, candidates);
      throw new Error('Expected provider failure');
    } catch (error: unknown) {
      if (!(
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ))
        throw error;
      expect(error.getResponse()).toEqual({ code });
      expect(JSON.stringify(error.getResponse())).not.toContain('sensitive');
    }
  });
});
