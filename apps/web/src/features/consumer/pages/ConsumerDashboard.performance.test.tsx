import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { apiClient } from '../../../lib/api-client';
import { invalidateSessionScope } from '../../auth/session-scope';
import {
  invalidateConsumerOverviewRequest,
  invalidateWalletTransactionRequests,
} from '../api/consumer.api';
import { CONSUMER_OVERVIEW_NAVIGATION_REUSE_POLICY } from '../consumer.types';
import type { ConsumerOverviewResponse } from '../consumer.types';
import { WalletView } from '../views/WalletView';
import { ConsumerDashboard } from './ConsumerDashboard';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

const overviewFixture: ConsumerOverviewResponse = {
  wallet: {
    walletId: 'wallet-performance',
    personalBalance: 1_200,
    subsidyBalance: 300,
    totalBalance: 1_500,
    dailySubsidyLimit: 300,
    dailySubsidyUsed: 0,
    dailySubsidyRemaining: 300,
    pointBalance: 0,
  },
  program: null,
  quests: [],
  coupons: [],
  recentTransactions: [],
  recentOrders: [],
};

beforeEach(() => {
  invalidateSessionScope();
  invalidateConsumerOverviewRequest();
  invalidateWalletTransactionRequests();
  mockedGet.mockReset();
});

afterEach(cleanup);

describe('ConsumerDashboard request lifecycle', () => {
  it('loads overview once in StrictMode and reuses it when opening Wallet', async () => {
    let resolveOverview!: (value: ConsumerOverviewResponse) => void;
    mockedGet
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOverview = resolve;
        }),
      )
      .mockResolvedValue({ items: [], nextCursor: null });

    render(
      <StrictMode>
        <ConsumerDashboard
          citizenId="1100000000001"
          fullName="ผู้ใช้ทดสอบ"
          onLogout={vi.fn()}
        />
      </StrictMode>,
    );

    expect(mockedGet).toHaveBeenCalledTimes(1);
    await act(async () => resolveOverview(overviewFixture));
    expect(await screen.findByText('1,500.00')).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', {
        name: th.consumerPortal.navigation.wallet,
      })[0]!,
    );
    expect(await screen.findByText('฿1,200.00')).toBeInTheDocument();

    const overviewRequests = mockedGet.mock.calls.filter(
      ([path]) => path === '/api/v1/wallet/overview',
    );
    expect(overviewRequests).toHaveLength(1);
    await waitFor(() => {
      const historyRequests = mockedGet.mock.calls.filter(([path]) =>
        path.startsWith('/api/v1/wallet/transactions'),
      );
      expect(historyRequests).toHaveLength(1);
    });
  });

  it('starts one stale overview revalidation under StrictMode', async () => {
    const refreshedOverview: ConsumerOverviewResponse = {
      ...overviewFixture,
      wallet: {
        ...overviewFixture.wallet,
        personalBalance: 1_800,
        totalBalance: 2_100,
      },
    };
    let resolveOverview!: (value: ConsumerOverviewResponse) => void;
    mockedGet
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOverview = resolve;
        }),
      )
      .mockResolvedValue({ items: [], nextCursor: null });

    render(
      <StrictMode>
        <WalletView
          initialOverview={overviewFixture}
          initialOverviewFetchedAt={
            Date.now() - CONSUMER_OVERVIEW_NAVIGATION_REUSE_POLICY.maxAgeMs - 1
          }
        />
      </StrictMode>,
    );

    expect(screen.getByText('฿1,200.00')).toBeInTheDocument();
    expect(
      mockedGet.mock.calls.filter(
        ([path]) => path === '/api/v1/wallet/overview',
      ),
    ).toHaveLength(1);

    await act(async () => resolveOverview(refreshedOverview));
    expect(await screen.findByText('฿1,800.00')).toBeInTheDocument();
    expect(
      mockedGet.mock.calls.filter(
        ([path]) => path === '/api/v1/wallet/overview',
      ),
    ).toHaveLength(1);
  });
});
