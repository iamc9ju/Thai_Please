import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import * as consumerApi from '../api/consumer.api';
import type { ConsumerQuestListResponse } from '../consumer.types';
import { QuestsView } from './QuestsView';

vi.mock('../api/consumer.api', () => ({
  getConsumerQuests: vi.fn(),
  getOrderReceipt: vi.fn(),
}));

const mockedGetConsumerQuests = vi.mocked(consumerApi.getConsumerQuests);

const mockQuestData: ConsumerQuestListResponse = {
  items: [
    {
      id: '1',
      questName: 'ซื้อหมวดที่กำหนดครบยอดในหนึ่งบิล',
      status: 'ACTIVE',
      assignedAt: '2026-10-15T11:57:56.278Z',
      expiresAt: '2026-10-22T11:57:56.278Z',
      completedAt: null,
      type: 'CATEGORY_SPEND',
      targetCategoryId: '1',
      targetCategoryName: 'อาหารและเครื่องดื่ม',
      targetProductId: null,
      targetMerchantId: null,
      minimumSpendMinor: '9000',
      rewardPoints: 20,
    },
    {
      id: '2',
      questName: 'ซื้อครบยอดในหนึ่งบิล',
      status: 'COMPLETED',
      assignedAt: '2026-10-01T10:00:00.000Z',
      expiresAt: '2026-10-08T10:00:00.000Z',
      completedAt: '2026-10-05T14:30:00.000Z',
      type: 'MIN_SPEND',
      targetCategoryId: null,
      targetProductId: null,
      targetMerchantId: null,
      minimumSpendMinor: '10000',
      rewardPoints: 50,
    },
  ],
  nextCursor: null,
};

describe('QuestsView (FR-C07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state and then displays active quests', async () => {
    mockedGetConsumerQuests.mockResolvedValueOnce(mockQuestData);

    render(<QuestsView />);

    expect(
      screen.getByText(th.consumerPortal.quests.loading),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('ซื้อหมวดที่กำหนดครบยอดในหนึ่งบิล'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/ซื้อหมวด อาหารและเครื่องดื่ม ครบ 90.00 บาทในหนึ่งบิล/),
    ).toBeInTheDocument();
    expect(screen.getByText('+20 พอยต์')).toBeInTheDocument();
    expect(
      screen.getAllByText(th.consumerPortal.quests.active).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('switches between active and history tabs', async () => {
    mockedGetConsumerQuests.mockResolvedValueOnce(mockQuestData);

    render(<QuestsView />);

    await waitFor(() => {
      expect(screen.getByText('+20 พอยต์')).toBeInTheDocument();
    });

    const historyTab = screen.getByRole('tab', {
      name: new RegExp(th.consumerPortal.quests.historyTab),
    });
    fireEvent.click(historyTab);

    expect(
      screen.getByText(th.consumerPortal.quests.historyDescription),
    ).toBeInTheDocument();
    expect(screen.getAllByText('+50 พอยต์').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(th.consumerPortal.quests.completed),
    ).toBeInTheDocument();
  });

  it('renders empty active state when there are no active quests', async () => {
    mockedGetConsumerQuests.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    render(<QuestsView />);

    await waitFor(() => {
      expect(
        screen.getByText(th.consumerPortal.quests.emptyActive),
      ).toBeInTheDocument();
    });
  });

  it('renders error state and retries on button click', async () => {
    mockedGetConsumerQuests
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockQuestData);

    render(<QuestsView />);

    await waitFor(() => {
      expect(
        screen.getByText(th.consumerPortal.quests.loadError),
      ).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', {
      name: th.consumerPortal.quests.retry,
    });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(
        screen.getByText('ซื้อหมวดที่กำหนดครบยอดในหนึ่งบิล'),
      ).toBeInTheDocument();
    });
  });

  it('renders permission denied message on 401 or 403 ApiError', async () => {
    mockedGetConsumerQuests.mockRejectedValueOnce(
      new ApiError(403, 'Forbidden'),
    );

    render(<QuestsView />);

    await waitFor(() => {
      expect(
        screen.getByText(th.consumerPortal.quests.permissionDenied),
      ).toBeInTheDocument();
    });
  });
});
