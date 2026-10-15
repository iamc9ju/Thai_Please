import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import { getConsumerQuests, getWalletTransactions } from './consumer.api';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

beforeEach(() => {
  mockedGet.mockReset();
  mockedGet.mockResolvedValue({ items: [], nextCursor: null });
});

describe('consumer wallet API', () => {
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

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/v1/quests?cursor=10',
      { signal: controller.signal },
    );
  });

  it('fetches consumer quests without cursor when not provided', async () => {
    await getConsumerQuests();

    expect(mockedGet).toHaveBeenCalledWith('/api/v1/quests', {});
  });
});

