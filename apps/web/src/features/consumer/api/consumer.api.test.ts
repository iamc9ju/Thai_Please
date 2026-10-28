import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import {
  getConsumerCoupons,
  getConsumerPoints,
  getConsumerQuests,
  getConsumerQuestProposals,
  createConsumerQuestProposals,
  selectConsumerQuestProposal,
  getWalletTransactions,
  redeemConsumerCoupon,
} from './consumer.api';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

beforeEach(() => {
  mockedGet.mockReset();
  mockedGet.mockResolvedValue({ items: [], nextCursor: null });
  mockedPost.mockReset();
  mockedPost.mockResolvedValue({ success: true });
});

describe('consumer wallet & rewards API', () => {
  const proposalState = {
    status: 'ELIGIBLE',
    requestKey: null,
    expiresAt: null,
    nextEligibleAt: null,
    reason: null,
    items: [],
  };

  it('uses proposal lifecycle endpoints and forwards idempotency and abort signal', async () => {
    const controller = new AbortController();
    mockedGet.mockResolvedValueOnce(proposalState);
    await getConsumerQuestProposals(controller.signal);
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/v1/consumer/quests/proposals',
      { signal: controller.signal },
    );
    mockedPost.mockResolvedValueOnce({ ...proposalState, status: 'PENDING' });
    await createConsumerQuestProposals('create-key', controller.signal);
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/consumer/quests/proposals',
      { idempotencyKey: 'create-key' },
      { signal: controller.signal },
    );
    mockedPost.mockResolvedValueOnce({
      assignmentId: '1',
      nextEligibleAt: '2099-01-08T00:00:00Z',
    });
    await selectConsumerQuestProposal(
      'request/key',
      'proposal',
      'select-key',
      controller.signal,
    );
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/consumer/quests/proposals/request%2Fkey/select',
      { proposalId: 'proposal', idempotencyKey: 'select-key' },
      { signal: controller.signal },
    );
  });

  it('rejects malformed proposals rather than displaying selectable server content', async () => {
    mockedGet.mockResolvedValueOnce({
      ...proposalState,
      status: 'READY',
      items: [{ id: 'bad' }],
    });
    await expect(getConsumerQuestProposals()).rejects.toThrow(
      'QUEST_PROPOSALS_RESPONSE_INVALID',
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

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/v1/consumer/quests?cursor=10',
      {
        signal: controller.signal,
      },
    );
  });

  it('fetches consumer quests without cursor when not provided', async () => {
    await getConsumerQuests();

    expect(mockedGet).toHaveBeenCalledWith('/api/v1/consumer/quests', {});
  });

  it('fetches consumer points and coupons and posts coupon redemption', async () => {
    await getConsumerPoints();
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/consumer/points', {});

    await getConsumerCoupons();
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/consumer/coupons', {});

    await redeemConsumerCoupon('7');
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/consumer/coupons/7/redeem',
      {},
    );
  });
});
