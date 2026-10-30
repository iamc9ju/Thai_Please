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
import {
  cancelQuest,
  getQuestCancellation,
} from '../api/quest-cancellation.api';
import { QuestsView } from './QuestsView';

vi.mock('../api/consumer.api', () => ({
  getConsumerQuests: vi.fn(),
  getOrderReceipt: vi.fn(),
}));

vi.mock('../api/quest-cancellation.api', () => ({
  cancelQuest: vi.fn(),
  getQuestCancellation: vi.fn(),
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

  it('moves a voluntarily cancelled quest into history and refreshes its list', async () => {
    const copy = th.consumerPortal.quests;
    const first = mockQuestData.items[0];
    if (!first) throw new Error('Missing fixture');
    mockedGetConsumerQuests
      .mockResolvedValueOnce(mockQuestData)
      .mockResolvedValueOnce({
        items: [
          {
            ...first,
            status: 'CANCELLED',
            cancelledAt: '2026-10-20T00:00:00Z',
            cancellationReason: 'USER_CANCELLED',
          },
        ],
        nextCursor: null,
      });
    vi.mocked(getQuestCancellation).mockResolvedValue({
      assignmentId: first.id,
      nextEligibleAt: first.expiresAt,
    });
    vi.mocked(cancelQuest).mockResolvedValue({
      assignmentId: first.id,
      nextEligibleAt: first.expiresAt,
      status: 'CANCELLED',
    });
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        },
      },
      close: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.removeAttribute('open');
        },
      },
    });
    render(<QuestsView />);
    fireEvent.click(
      await screen.findByRole('button', { name: copy.cancellation.action }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: copy.cancellation.confirm }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: copy.cancellation.confirm }),
    );
    expect(
      await screen.findByText(copy.cancellationReasons.USER_CANCELLED),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancelQuest).toHaveBeenCalledWith(first.id);
    expect(mockedGetConsumerQuests).toHaveBeenCalledTimes(2);
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
      screen.getByText(
        /ซื้อสินค้าในหมวด อาหารและเครื่องดื่ม ครบ 90.00 บาท จากร้านค้าที่ร่วมรายการร้านใดก็ได้ ในหนึ่งบิลหลังหักส่วนลด/,
      ),
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

  it('shows a cancelled legacy quest in history with a safe policy explanation', async () => {
    mockedGetConsumerQuests.mockResolvedValueOnce({
      items: [
        {
          id: 'legacy-cancelled',
          questName: 'ซื้อร้านที่กำหนดครบยอดในหนึ่งบิล',
          status: 'CANCELLED',
          assignedAt: '2026-10-01T10:00:00.000Z',
          expiresAt: '2026-10-08T10:00:00.000Z',
          completedAt: null,
          cancelledAt: '2026-10-02T10:00:00.000Z',
          cancellationReason: 'QUEST_TYPE_RETIRED_POLICY_V2',
          type: 'MERCHANT_SPEND',
          targetCategoryId: null,
          targetProductId: null,
          targetMerchantId: 'merchant-1',
          targetMerchantName: 'ร้านเดิม',
          minimumSpendMinor: '10000',
          rewardPoints: 50,
        },
      ],
      nextCursor: null,
    });

    render(<QuestsView />);

    await waitFor(() => {
      expect(
        screen.getByText(th.consumerPortal.quests.emptyActive),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('tab', {
        name: new RegExp(th.consumerPortal.quests.historyTab),
      }),
    );

    expect(
      screen.getByText(th.consumerPortal.quests.cancelled),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        th.consumerPortal.quests.cancellationReasons
          .QUEST_TYPE_RETIRED_POLICY_V2,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.quests.cancelledReward),
    ).toBeInTheDocument();
  });

  it('does not present an active legacy quest as actionable', async () => {
    mockedGetConsumerQuests.mockResolvedValueOnce({
      items: [
        {
          id: 'legacy-active',
          questName: 'ซื้อสินค้าที่กำหนดในหนึ่งบิล',
          status: 'ACTIVE',
          assignedAt: '2026-10-01T10:00:00.000Z',
          expiresAt: '2026-10-08T10:00:00.000Z',
          completedAt: null,
          type: 'PRODUCT_PURCHASE',
          targetCategoryId: null,
          targetProductId: 'product-1',
          targetProductName: 'สินค้าเดิม',
          targetMerchantId: 'merchant-1',
          minimumSpendMinor: null,
          rewardPoints: 50,
        },
      ],
      nextCursor: null,
    });

    render(<QuestsView />);

    await waitFor(() => {
      expect(
        screen.getByText(th.consumerPortal.quests.legacyActiveExplanation),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(th.consumerPortal.quests.legacyInactive),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('ซื้อสินค้า สินค้าเดิม ในหนึ่งบิล'),
    ).not.toBeInTheDocument();
  });
});
