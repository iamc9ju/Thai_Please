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
import * as api from '../api/consumer.api';
import type { ConsumerQuestProposalsResponse } from '../consumer.types';
import { QuestProposalsPanel } from './QuestProposalsPanel';

vi.mock('../api/consumer.api', () => ({
  getConsumerQuestProposals: vi.fn(),
  createConsumerQuestProposals: vi.fn(),
  selectConsumerQuestProposal: vi.fn(),
}));

const get = vi.mocked(api.getConsumerQuestProposals);
const create = vi.mocked(api.createConsumerQuestProposals);
const select = vi.mocked(api.selectConsumerQuestProposal);
const copy = th.consumerPortal.quests.proposals;
const ready: ConsumerQuestProposalsResponse = {
  status: 'READY',
  requestKey: 'test-request',
  expiresAt: '2099-01-01T00:00:00Z',
  nextEligibleAt: null,
  reason: null,
  items: [
    {
      id: 'p1',
      type: 'MIN_SPEND',
      targetCategoryId: null,
      targetCategoryName: null,
      minimumSpend: '60.00',
      rewardPoints: 20,
      durationDays: 7,
    },
    {
      id: 'p2',
      type: 'CATEGORY_SPEND',
      targetCategoryId: '1',
      targetCategoryName: 'อาหาร',
      minimumSpend: '80.00',
      rewardPoints: 20,
      durationDays: 7,
    },
  ],
};

describe('quest proposals consumer selection (FR-C07)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('uses the existing valid set and disables every choice during selection', async () => {
    get.mockResolvedValue(ready);
    let resolveSelection:
      | ((value: { assignmentId: string; nextEligibleAt: string }) => void)
      | undefined;
    select.mockReturnValue(
      new Promise((resolve) => {
        resolveSelection = resolve;
      }),
    );
    const selected = vi.fn().mockResolvedValue(undefined);
    render(<QuestProposalsPanel onSelected={selected} />);
    await screen.findAllByRole('button', { name: copy.select });
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: copy.select })[0]!);
    expect(screen.getByRole('button', { name: copy.selecting })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.select })).toBeDisabled();
    expect(select).toHaveBeenCalledTimes(1);
    resolveSelection?.({
      assignmentId: 'assignment',
      nextEligibleAt: '2099-01-08T00:00:00Z',
    });
    await screen.findByText(copy.selected);
    expect(selected).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: copy.select }),
    ).not.toBeInTheDocument();
  });

  it('creates only after the server reports eligibility', async () => {
    get.mockResolvedValue({
      ...ready,
      status: 'ELIGIBLE',
      requestKey: null,
      expiresAt: null,
      items: [],
    });
    create.mockResolvedValue(ready);
    render(<QuestProposalsPanel onSelected={vi.fn()} />);
    await screen.findAllByRole('button', { name: copy.select });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses the selection idempotency key after a failed response', async () => {
    get.mockResolvedValue(ready);
    select
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({
        assignmentId: '1',
        nextEligibleAt: '2099-01-08T00:00:00Z',
      });
    render(
      <QuestProposalsPanel onSelected={vi.fn().mockResolvedValue(undefined)} />,
    );
    await screen.findAllByRole('button', { name: copy.select });
    fireEvent.click(screen.getAllByRole('button', { name: copy.select })[0]!);
    await screen.findByText(copy.selectError);
    fireEvent.click(screen.getAllByRole('button', { name: copy.select })[0]!);
    await screen.findByText(copy.selected);
    expect(select.mock.calls[0]?.[2]).toBe(select.mock.calls[1]?.[2]);
  });

  it('shows the next eligible time without creating while in cooldown', async () => {
    get.mockResolvedValue({
      ...ready,
      status: 'COOLDOWN',
      requestKey: null,
      expiresAt: null,
      nextEligibleAt: '2099-01-08T00:00:00Z',
      items: [],
    });
    render(<QuestProposalsPanel onSelected={vi.fn()} />);
    await screen.findByText(/รับภารกิจรอบใหม่ได้วันที่/);
    expect(create).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('does not permit selection of an expired set', async () => {
    get.mockResolvedValue({ ...ready, expiresAt: '2000-01-01T00:00:00Z' });
    render(<QuestProposalsPanel onSelected={vi.fn()} />);
    await screen.findByText(copy.expired);
    expect(
      screen.queryByRole('button', { name: copy.select }),
    ).not.toBeInTheDocument();
  });

  it('does not automatically regenerate a failed set', async () => {
    get.mockResolvedValue({ ...ready, status: 'FAILED', items: [] });
    create.mockResolvedValue(ready);
    render(<QuestProposalsPanel onSelected={vi.fn()} />);
    await screen.findByText(copy.error);
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it('stops pending polling on unmount', async () => {
    get.mockResolvedValue({ ...ready, status: 'PENDING', items: [] });
    const view = render(<QuestProposalsPanel onSelected={vi.fn()} />);
    await screen.findByText(copy.generating);
    const signal = get.mock.calls[0]?.[0];
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('shows permission denial without generation', async () => {
    get.mockRejectedValue(new ApiError(403, 'Forbidden'));
    render(<QuestProposalsPanel onSelected={vi.fn()} />);
    await screen.findByText(copy.permissionDenied);
    expect(create).not.toHaveBeenCalled();
  });
});
