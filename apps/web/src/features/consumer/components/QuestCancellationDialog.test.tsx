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
import {
  cancelQuest,
  getQuestCancellation,
} from '../api/quest-cancellation.api';
import { QuestCancellationDialog } from './QuestCancellationDialog';

vi.mock('../api/quest-cancellation.api', () => ({
  cancelQuest: vi.fn(),
  getQuestCancellation: vi.fn(),
}));
const copy = th.consumerPortal.quests.cancellation;
const preview = {
  assignmentId: '41',
  nextEligibleAt: '2026-11-06T07:30:00.000Z',
};
const onClose = vi.fn();
const onCancelled = vi.fn().mockResolvedValue(undefined);
function show() {
  return render(
    <QuestCancellationDialog
      assignmentId={preview.assignmentId}
      questName="เควสทดสอบ"
      onClose={onClose}
      onCancelled={onCancelled}
    />,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQuestCancellation).mockResolvedValue(preview);
  vi.mocked(cancelQuest).mockResolvedValue({ ...preview, status: 'CANCELLED' });
  // jsdom lacks native modal activation; browser owns focus containment.
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
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FR-C07 cancellation confirmation', () => {
  it('shows server eligibility in Bangkok time before any mutation, and lets user keep quest', async () => {
    show();
    expect(screen.getByRole('button', { name: copy.confirm })).toBeDisabled();
    expect(await screen.findByText(/14:30/)).toHaveTextContent('2569');
    expect(cancelQuest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.keep }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(cancelQuest).not.toHaveBeenCalled();
  });
  it('requires preview to succeed and supports preview retry', async () => {
    vi.mocked(getQuestCancellation).mockRejectedValueOnce(new Error('offline'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      copy.previewError,
    );
    expect(screen.getByRole('button', { name: copy.confirm })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    expect(await screen.findByText(/14:30/)).toBeInTheDocument();
  });
  it('prevents duplicate submissions and dismissal while pending, then refreshes with original eligibility', async () => {
    let finish: (() => void) | undefined;
    vi.mocked(cancelQuest).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ...preview, status: 'CANCELLED' });
        }),
    );
    show();
    await screen.findByText(/14:30/);
    fireEvent.click(screen.getByRole('button', { name: copy.confirm }));
    fireEvent.click(screen.getByRole('button', { name: copy.pending }));
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(cancelQuest).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: copy.keep })).toBeDisabled();
    finish?.();
    await waitFor(() =>
      expect(onCancelled).toHaveBeenCalledWith(preview.nextEligibleAt),
    );
  });
  it('keeps confirmation available after uncertain network result for idempotent retry', async () => {
    vi.mocked(cancelQuest).mockRejectedValueOnce(new Error('offline'));
    show();
    await screen.findByText(/14:30/);
    fireEvent.click(screen.getByRole('button', { name: copy.confirm }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      copy.submitError,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.confirm }));
    await waitFor(() => expect(onCancelled).toHaveBeenCalledOnce());
  });
  it.each([404, 409, 403])(
    'blocks confirmation after state/access conflict %s',
    async (status) => {
      vi.mocked(cancelQuest).mockRejectedValueOnce(
        new ApiError(status, 'rejected'),
      );
      show();
      await screen.findByText(/14:30/);
      fireEvent.click(screen.getByRole('button', { name: copy.confirm }));
      await screen.findByRole('alert');
      expect(screen.getByRole('button', { name: copy.confirm })).toBeDisabled();
      expect(onCancelled).not.toHaveBeenCalled();
    },
  );
});
