import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import {
  getConsumerQuests,
  getConsumerSubsidyStatus,
  getWalletTransactions,
} from './consumer.api';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

const validSubsidyResponse = {
  currency: 'THB',
  timeZone: 'Asia/Bangkok',
  asOf: '2026-10-15T03:00:00.000Z',
  subsidyBalance: 600,
  dailySubsidyLimit: 300,
  dailySubsidyUsed: 80,
  dailySubsidyRemaining: 220,
  program: {
    programId: 'program-1',
    programName: 'โครงการทดสอบ',
    subsidyPercentage: 60.5,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
  },
};

beforeEach(() => {
  mockedGet.mockReset();
  mockedGet.mockResolvedValue({ items: [], nextCursor: null });
});

describe('consumer wallet API', () => {
  it('requests the dedicated daily subsidy status endpoint', async () => {
    mockedGet.mockResolvedValue(validSubsidyResponse);

    await expect(getConsumerSubsidyStatus()).resolves.toEqual(
      validSubsidyResponse,
    );

    expect(mockedGet).toHaveBeenCalledWith('/api/v1/wallet/subsidy');
  });

  it('accepts a valid response without an active program', async () => {
    const response = { ...validSubsidyResponse, program: null };
    mockedGet.mockResolvedValue(response);

    await expect(getConsumerSubsidyStatus()).resolves.toEqual(response);
  });

  it('accepts zero remaining when daily use exceeds the limit', async () => {
    const response = {
      ...validSubsidyResponse,
      dailySubsidyUsed: 450,
      dailySubsidyRemaining: 0,
    };
    mockedGet.mockResolvedValue(response);

    await expect(getConsumerSubsidyStatus()).resolves.toEqual(response);
  });

  it('accepts subsidy money values with up to two decimal places', async () => {
    const response = {
      ...validSubsidyResponse,
      subsidyBalance: 600.25,
      dailySubsidyLimit: 200.5,
      dailySubsidyUsed: 60.25,
      dailySubsidyRemaining: 140.25,
    };
    mockedGet.mockResolvedValue(response);

    await expect(getConsumerSubsidyStatus()).resolves.toEqual(response);
  });

  it.each([0, 60.5, 100])(
    'accepts a finite program percentage within range: %s',
    async (subsidyPercentage) => {
      const response = {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, subsidyPercentage },
      };
      mockedGet.mockResolvedValue(response);

      await expect(getConsumerSubsidyStatus()).resolves.toEqual(response);
    },
  );

  it.each([
    ['non-object response', null],
    ['wrong currency', { ...validSubsidyResponse, currency: 'USD' }],
    ['wrong timezone', { ...validSubsidyResponse, timeZone: 'UTC' }],
    ['invalid as-of time', { ...validSubsidyResponse, asOf: 'not-a-date' }],
    ['date-only as-of time', { ...validSubsidyResponse, asOf: '2026-10-15' }],
    ['negative balance', { ...validSubsidyResponse, subsidyBalance: -1 }],
    [
      'daily amount with more than two decimal places',
      { ...validSubsidyResponse, dailySubsidyUsed: 80.001 },
    ],
    [
      'NaN subsidy balance',
      { ...validSubsidyResponse, subsidyBalance: Number.NaN },
    ],
    [
      'infinite daily limit',
      {
        ...validSubsidyResponse,
        dailySubsidyLimit: Number.POSITIVE_INFINITY,
      },
    ],
    [
      'unsafe daily amount',
      {
        ...validSubsidyResponse,
        dailySubsidyLimit: Number.MAX_SAFE_INTEGER + 1,
      },
    ],
    [
      'incorrect remaining amount',
      { ...validSubsidyResponse, dailySubsidyRemaining: 219 },
    ],
    [
      'empty program id',
      {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, programId: ' ' },
      },
    ],
    [
      'empty program name',
      {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, programName: '' },
      },
    ],
    ['non-object program', { ...validSubsidyResponse, program: [] }],
    [
      'negative program percentage',
      {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, subsidyPercentage: -0.1 },
      },
    ],
    [
      'NaN program percentage',
      {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, subsidyPercentage: NaN },
      },
    ],
    [
      'infinite program percentage',
      {
        ...validSubsidyResponse,
        program: {
          ...validSubsidyResponse.program,
          subsidyPercentage: Number.POSITIVE_INFINITY,
        },
      },
    ],
    [
      'non-number program percentage',
      {
        ...validSubsidyResponse,
        program: {
          ...validSubsidyResponse.program,
          subsidyPercentage: '60.5',
        },
      },
    ],
    [
      'invalid program percentage',
      {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, subsidyPercentage: 101 },
      },
    ],
    [
      'invalid program date',
      {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, startDate: 'invalid' },
      },
    ],
    [
      'impossible program date',
      {
        ...validSubsidyResponse,
        program: { ...validSubsidyResponse.program, startDate: '2026-02-31' },
      },
    ],
    [
      'reversed program period',
      {
        ...validSubsidyResponse,
        program: {
          ...validSubsidyResponse.program,
          startDate: '2027-01-01',
          endDate: '2026-12-31',
        },
      },
    ],
  ])('rejects a malformed subsidy response: %s', async (_name, response) => {
    mockedGet.mockResolvedValue(response);

    await expect(getConsumerSubsidyStatus()).rejects.toThrow(
      'Invalid subsidy status response',
    );
  });

  it('serializes inclusive date filters, cursor, and limit for history', async () => {
    const controller = new AbortController();

    await getWalletTransactions(
      {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        cursor: 'opaque+/cursor',
        limit: 50,
      },
      controller.signal,
    );

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/v1/wallet/transactions?dateFrom=2026-10-01&dateTo=2026-10-31&cursor=opaque%2B%2Fcursor&limit=50',
      { signal: controller.signal },
    );
  });

  it('omits optional history filters when they are not selected', async () => {
    await getWalletTransactions({ limit: 20 });

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/v1/wallet/transactions?limit=20',
      {},
    );
  });

  it('fetches consumer quests with optional cursor and abort signal', async () => {
    const controller = new AbortController();
    await getConsumerQuests('10', controller.signal);

    expect(mockedGet).toHaveBeenCalledWith('/api/v1/quests?cursor=10', {
      signal: controller.signal,
    });
  });

  it('fetches consumer quests without cursor when not provided', async () => {
    await getConsumerQuests();

    expect(mockedGet).toHaveBeenCalledWith('/api/v1/quests', {});
  });
});
