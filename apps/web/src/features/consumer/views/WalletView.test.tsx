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
  getConsumerOverview,
  getWalletTransactions,
  topUpPersonalWallet,
} from '../api/consumer.api';
import type { ConsumerOverviewResponse } from '../consumer.types';
import { WalletView } from './WalletView';

vi.mock('../api/consumer.api', () => ({
  getConsumerOverview: vi.fn(),
  getWalletTransactions: vi.fn(),
  topUpPersonalWallet: vi.fn(),
}));

const initialOverview: ConsumerOverviewResponse = {
  wallet: {
    walletId: 'wallet-1',
    personalBalance: 1_000,
    subsidyBalance: 600,
    totalBalance: 1_600,
    dailySubsidyLimit: 300,
    dailySubsidyUsed: 80,
    dailySubsidyRemaining: 220,
    pointBalance: 20,
  },
  program: {
    programId: 'program-1',
    programName: 'โครงการทดสอบ',
    subsidyPercentage: 60,
    userPercentage: 40,
    dailySubsidyLimit: 300,
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
  },
  quests: [],
  coupons: [],
  recentOrders: [],
  recentTransactions: [
    {
      transactionId: 'transaction-october',
      fundType: 'PERSONAL',
      transactionType: 'PERSONAL_TOPUP',
      amount: 300,
      balanceBefore: 700,
      balanceAfter: 1_000,
      createdAt: '2026-10-14T03:00:00.000Z',
    },
    {
      transactionId: 'transaction-september',
      fundType: 'PERSONAL',
      transactionType: 'PAYMENT',
      amount: 50,
      balanceBefore: 750,
      balanceAfter: 700,
      createdAt: '2026-09-20T03:00:00.000Z',
    },
  ],
};

const refreshedOverview: ConsumerOverviewResponse = {
  ...initialOverview,
  wallet: {
    ...initialOverview.wallet,
    personalBalance: 1_500,
    totalBalance: 2_100,
  },
  recentTransactions: [
    {
      transactionId: 'transaction-new',
      fundType: 'PERSONAL',
      transactionType: 'PERSONAL_TOPUP',
      amount: 500,
      balanceBefore: 1_000,
      balanceAfter: 1_500,
      createdAt: '2026-10-14T05:00:00.000Z',
    },
    ...initialOverview.recentTransactions,
  ],
};

const mockedGetOverview = vi.mocked(getConsumerOverview);
const mockedGetTransactions = vi.mocked(getWalletTransactions);
const mockedTopUp = vi.mocked(topUpPersonalWallet);

async function renderLoadedWallet() {
  render(<WalletView />);
  return screen.findByLabelText(th.consumerPortal.wallet.topUpAmount);
}

beforeEach(() => {
  mockedGetOverview.mockReset();
  mockedGetTransactions.mockReset();
  mockedTopUp.mockReset();
  mockedGetOverview.mockResolvedValue(initialOverview);
  mockedGetTransactions.mockResolvedValue({
    items: initialOverview.recentTransactions,
    nextCursor: null,
  });
  mockedTopUp.mockResolvedValue({
    success: true,
    isIdempotentReplay: false,
    transactionId: 'transaction-new',
    amount: 500,
    personalBalance: 1_500,
    createdAt: '2026-10-14T05:00:00.000Z',
  });
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
    '00000000-0000-4000-8000-000000000001',
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('WalletView FR-C02 integration', () => {
  it('loads balances and real transaction history from their APIs', async () => {
    await renderLoadedWallet();

    expect(screen.getByText('฿1,000.00')).toBeInTheDocument();
    expect(screen.getByText('฿600.00')).toBeInTheDocument();
    expect(
      await screen.findAllByText(
        th.consumerPortal.wallet.transactionTypes.personalTopUp,
      ),
    ).not.toHaveLength(0);
    expect(
      screen.getByText(th.consumerPortal.wallet.transactionTypes.payment),
    ).toBeInTheDocument();
  });

  it('submits integer baht with one key and refreshes balance and history', async () => {
    mockedGetOverview
      .mockResolvedValueOnce(initialOverview)
      .mockResolvedValueOnce(refreshedOverview);
    mockedGetTransactions
      .mockResolvedValueOnce({
        items: initialOverview.recentTransactions,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: refreshedOverview.recentTransactions,
        nextCursor: null,
      });
    const input = await renderLoadedWallet();

    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.wallet.topUpAction,
      }),
    );

    await waitFor(() =>
      expect(mockedTopUp).toHaveBeenCalledWith(
        500,
        '00000000-0000-4000-8000-000000000001',
      ),
    );
    expect(await screen.findByText('฿1,500.00')).toBeInTheDocument();
    expect(await screen.findByText('+500.00')).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.wallet.topUpSuccess),
    ).toBeInTheDocument();
    expect(mockedGetOverview).toHaveBeenCalledTimes(2);
    expect(mockedGetTransactions).toHaveBeenCalledTimes(2);
  });

  it('keeps the same idempotency key when retrying the same failed attempt', async () => {
    mockedTopUp
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        success: true,
        isIdempotentReplay: true,
        transactionId: 'transaction-new',
        amount: 500,
        personalBalance: 1_500,
        createdAt: '2026-10-14T05:00:00.000Z',
      });
    mockedGetOverview
      .mockResolvedValueOnce(initialOverview)
      .mockResolvedValueOnce(refreshedOverview);
    const input = await renderLoadedWallet();
    fireEvent.change(input, { target: { value: '500' } });
    const submit = screen.getByRole('button', {
      name: th.consumerPortal.wallet.topUpAction,
    });

    fireEvent.click(submit);
    expect(
      await screen.findByText(th.consumerPortal.wallet.networkError),
    ).toBeInTheDocument();
    fireEvent.click(submit);

    await waitFor(() => expect(mockedTopUp).toHaveBeenCalledTimes(2));
    expect(mockedTopUp.mock.calls[0]?.[1]).toBe(mockedTopUp.mock.calls[1]?.[1]);
  });

  it('prevents duplicate submissions while a request is pending', async () => {
    mockedTopUp.mockReturnValue(new Promise(() => undefined));
    const input = await renderLoadedWallet();
    fireEvent.change(input, { target: { value: '500' } });
    const submit = screen.getByRole('button', {
      name: th.consumerPortal.wallet.topUpAction,
    });
    const form = submit.closest('form');

    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(mockedTopUp).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: th.consumerPortal.wallet.submitting }),
    ).toBeDisabled();
  });

  it.each(['0', '-1', '1.5', '50001'])(
    'rejects invalid amount %s without calling the API',
    async (invalidAmount) => {
      const input = await renderLoadedWallet();
      fireEvent.change(input, { target: { value: invalidAmount } });
      fireEvent.click(
        screen.getByRole('button', {
          name: th.consumerPortal.wallet.topUpAction,
        }),
      );

      expect(
        screen.getByText(th.consumerPortal.wallet.invalidTopUp),
      ).toBeInTheDocument();
      expect(mockedTopUp).not.toHaveBeenCalled();
    },
  );

  it.each([
    [new ApiError(403, 'forbidden'), th.consumerPortal.wallet.permissionDenied],
    [new ApiError(409, 'conflict'), th.consumerPortal.wallet.conflict],
    [new Error('network'), th.consumerPortal.wallet.networkError],
  ])(
    'shows the expected top-up error state',
    async (error, expectedMessage) => {
      mockedTopUp.mockRejectedValue(error);
      const input = await renderLoadedWallet();
      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.click(
        screen.getByRole('button', {
          name: th.consumerPortal.wallet.topUpAction,
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        expectedMessage,
      );
    },
  );

  it('shows initial loading, permission denied, and retryable load errors', async () => {
    mockedGetOverview.mockReturnValueOnce(new Promise(() => undefined));
    const firstRender = render(<WalletView />);
    expect(screen.getByRole('status')).toHaveTextContent(
      th.consumerPortal.wallet.loading,
    );
    firstRender.unmount();

    mockedGetOverview.mockRejectedValueOnce(new ApiError(401, 'unauthorized'));
    const secondRender = render(<WalletView />);
    expect(
      await screen.findByText(th.consumerPortal.wallet.permissionDeniedTitle),
    ).toBeInTheDocument();
    secondRender.unmount();

    mockedGetOverview
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(initialOverview);
    render(<WalletView />);
    expect(
      await screen.findByText(th.consumerPortal.wallet.loadErrorTitle),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: th.consumerPortal.wallet.retry }),
    );
    expect(
      await screen.findByLabelText(th.consumerPortal.wallet.topUpAmount),
    ).toBeInTheDocument();
  });

  it('retries a failed history request without hiding wallet balances', async () => {
    mockedGetTransactions
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        items: initialOverview.recentTransactions,
        nextCursor: null,
      });
    await renderLoadedWallet();

    expect(
      await screen.findByText(th.consumerPortal.wallet.historyError),
    ).toBeInTheDocument();
    expect(screen.getByText('฿1,000.00')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: th.consumerPortal.wallet.retry }),
    );

    expect(
      await screen.findByText(
        th.consumerPortal.wallet.transactionTypes.payment,
      ),
    ).toBeInTheDocument();
    expect(mockedGetTransactions).toHaveBeenCalledTimes(2);
  });

  it('shows history loading and empty states from the history API', async () => {
    let resolveHistory!: (value: {
      items: ConsumerOverviewResponse['recentTransactions'];
      nextCursor: null;
    }) => void;
    mockedGetTransactions.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveHistory = resolve;
      }),
    );

    await renderLoadedWallet();
    expect(
      screen.getByText(th.consumerPortal.wallet.historyLoading),
    ).toBeInTheDocument();

    resolveHistory({ items: [], nextCursor: null });
    expect(
      await screen.findByText(th.consumerPortal.wallet.noResults),
    ).toBeInTheDocument();
  });

  it('shows permission denied when history access is forbidden', async () => {
    mockedGetTransactions.mockRejectedValueOnce(new ApiError(403, 'forbidden'));

    await renderLoadedWallet();

    expect(
      await screen.findByText(th.consumerPortal.wallet.historyPermissionDenied),
    ).toBeInTheDocument();
  });

  it('loads older history using the opaque next cursor', async () => {
    mockedGetTransactions
      .mockResolvedValueOnce({
        items: [initialOverview.recentTransactions[0]!],
        nextCursor: 'opaque_cursor',
      })
      .mockResolvedValueOnce({
        items: [initialOverview.recentTransactions[1]!],
        nextCursor: null,
      });
    await renderLoadedWallet();

    fireEvent.click(
      await screen.findByRole('button', {
        name: th.consumerPortal.wallet.loadMore,
      }),
    );

    expect(
      await screen.findByText(
        th.consumerPortal.wallet.transactionTypes.payment,
      ),
    ).toBeInTheDocument();
    expect(mockedGetTransactions).toHaveBeenNthCalledWith(2, {
      cursor: 'opaque_cursor',
      limit: 20,
    });
  });

  it('keeps the next cursor available when loading an older page fails', async () => {
    mockedGetTransactions
      .mockResolvedValueOnce({
        items: [initialOverview.recentTransactions[0]!],
        nextCursor: 'retry_cursor',
      })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        items: [initialOverview.recentTransactions[1]!],
        nextCursor: null,
      });
    await renderLoadedWallet();
    const loadMore = await screen.findByRole('button', {
      name: th.consumerPortal.wallet.loadMore,
    });

    fireEvent.click(loadMore);
    expect(
      await screen.findByText(th.consumerPortal.wallet.loadMoreError),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: th.consumerPortal.wallet.loadMore }),
    );

    expect(
      await screen.findByText(
        th.consumerPortal.wallet.transactionTypes.payment,
      ),
    ).toBeInTheDocument();
    expect(mockedGetTransactions).toHaveBeenNthCalledWith(3, {
      cursor: 'retry_cursor',
      limit: 20,
    });
  });

  it('sends custom date filters to the history API', async () => {
    mockedGetTransactions.mockImplementation(async (query) => ({
      items:
        query.dateFrom === '2026-10-01' && query.dateTo === '2026-10-31'
          ? [initialOverview.recentTransactions[0]!]
          : initialOverview.recentTransactions,
      nextCursor: null,
    }));
    await renderLoadedWallet();

    fireEvent.change(screen.getByLabelText(th.consumerPortal.wallet.dateFrom), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText(th.consumerPortal.wallet.dateTo), {
      target: { value: '2026-10-31' },
    });

    await waitFor(() =>
      expect(mockedGetTransactions).toHaveBeenCalledWith(
        {
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
          limit: 20,
        },
        expect.any(AbortSignal),
      ),
    );
    expect(
      screen.queryByText(th.consumerPortal.wallet.transactionTypes.payment),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('พบ 1 รายการ')).toBeInTheDocument();
  });

  it('sends current-month and all-history filters to the server', async () => {
    await renderLoadedWallet();

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.wallet.filterMonth,
      }),
    );

    await waitFor(() =>
      expect(mockedGetTransactions).toHaveBeenCalledWith(
        {
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
          limit: 20,
        },
        expect.any(AbortSignal),
      ),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.wallet.filterAll,
      }),
    );

    await waitFor(() =>
      expect(mockedGetTransactions).toHaveBeenLastCalledWith(
        { limit: 20 },
        expect.any(AbortSignal),
      ),
    );
  });

  it('ignores a stale history response after the filter changes', async () => {
    await renderLoadedWallet();
    await screen.findByText(th.consumerPortal.wallet.transactionTypes.payment);

    let resolveStale!: (value: {
      items: ConsumerOverviewResponse['recentTransactions'];
      nextCursor: null;
    }) => void;
    const staleResponse = new Promise<{
      items: ConsumerOverviewResponse['recentTransactions'];
      nextCursor: null;
    }>((resolve) => {
      resolveStale = resolve;
    });
    const staleItem = {
      ...initialOverview.recentTransactions[0]!,
      transactionId: 'stale-transaction',
      amount: 111,
      balanceBefore: 0,
      balanceAfter: 111,
    };
    const latestItem = {
      ...initialOverview.recentTransactions[0]!,
      transactionId: 'latest-transaction',
      amount: 222,
      balanceBefore: 0,
      balanceAfter: 222,
    };
    mockedGetTransactions.mockImplementation((query) => {
      if (query.dateFrom === '2026-10-01') return staleResponse;
      if (query.dateFrom === '2026-11-01') {
        return Promise.resolve({ items: [latestItem], nextCursor: null });
      }
      return Promise.resolve({ items: [], nextCursor: null });
    });

    const dateFromInput = screen.getByLabelText(
      th.consumerPortal.wallet.dateFrom,
    );
    fireEvent.change(dateFromInput, { target: { value: '2026-10-01' } });
    fireEvent.change(dateFromInput, { target: { value: '2026-11-01' } });

    expect(await screen.findByText('+222.00')).toBeInTheDocument();
    resolveStale({ items: [staleItem], nextCursor: null });

    await waitFor(() => {
      expect(screen.getByText('+222.00')).toBeInTheDocument();
      expect(screen.queryByText('+111.00')).not.toBeInTheDocument();
    });
  });
});
