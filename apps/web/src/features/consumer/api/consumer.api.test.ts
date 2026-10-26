import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import { invalidateSessionScope } from '../../auth/session-scope';
import type { ConsumerOverviewResponse } from '../consumer.types';
import {
  getConsumerOverview,
  getWalletTransactions,
  invalidateConsumerOverviewRequest,
  invalidateWalletTransactionRequests,
  topUpPersonalWallet,
} from './consumer.api';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

const overviewFixture = {
  wallet: { walletId: 'wallet-1' },
} as ConsumerOverviewResponse;

beforeEach(() => {
  invalidateSessionScope();
  invalidateConsumerOverviewRequest();
  invalidateWalletTransactionRequests();
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedGet.mockResolvedValue({ items: [], nextCursor: null });
});

describe('consumer overview request lifecycle', () => {
  it('deduplicates only the same in-flight overview request', async () => {
    let resolveOverview!: (value: ConsumerOverviewResponse) => void;
    mockedGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOverview = resolve;
      }),
    );

    const first = getConsumerOverview();
    const second = getConsumerOverview();

    expect(second).toBe(first);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    resolveOverview(overviewFixture);
    await Promise.all([first, second]);

    mockedGet.mockResolvedValueOnce(overviewFixture);
    await getConsumerOverview();
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('does not reuse an in-flight overview across session generations', async () => {
    mockedGet.mockReturnValueOnce(new Promise(() => undefined));
    void getConsumerOverview();

    invalidateSessionScope();
    mockedGet.mockResolvedValueOnce(overviewFixture);
    await getConsumerOverview();

    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('invalidates an old overview after top-up and forces a real refresh', async () => {
    mockedGet.mockReturnValueOnce(new Promise(() => undefined));
    void getConsumerOverview();
    mockedPost.mockResolvedValueOnce({ success: true });

    await topUpPersonalWallet(500, 'topup-attempt-1');
    mockedGet.mockResolvedValueOnce(overviewFixture);
    await getConsumerOverview({ forceRefresh: true });

    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
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
    );
  });

  it('omits optional history filters when they are not selected', async () => {
    await getWalletTransactions({ limit: 20 });

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/v1/wallet/transactions?limit=20',
    );
  });

  it('shares an exact-query request while allowing one subscriber to abort', async () => {
    let resolveHistory!: (value: { items: []; nextCursor: null }) => void;
    mockedGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveHistory = resolve;
      }),
    );
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = getWalletTransactions(
      { dateFrom: '2026-10-01', limit: 20 },
      firstController.signal,
    );
    firstController.abort();
    const second = getWalletTransactions(
      { dateFrom: '2026-10-01', limit: 20 },
      secondController.signal,
    );

    expect(mockedGet).toHaveBeenCalledTimes(1);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    resolveHistory({ items: [], nextCursor: null });
    await expect(second).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('does not share history requests across session generations', async () => {
    mockedGet.mockReturnValueOnce(new Promise(() => undefined));
    void getWalletTransactions({ limit: 20 });

    invalidateSessionScope();
    mockedGet.mockResolvedValueOnce({ items: [], nextCursor: null });
    await getWalletTransactions({ limit: 20 });

    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});
