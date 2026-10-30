import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { th } from '../i18n/th';
import * as consumerApi from '../features/consumer/api/consumer.api';
import * as merchantApi from '../features/merchant/api/merchant.api';
import * as adminApi from '../features/admin/api/admin.api';
import { OrdersView } from '../features/consumer/views/OrdersView';
import { MerchantDashboardView } from '../features/merchant/views/MerchantDashboardView';
import { MerchantWalletView } from '../features/merchant/views/MerchantWalletView';
import { AdminDashboard } from '../features/admin/pages/AdminDashboard';

vi.mock('../features/consumer/api/consumer.api');
vi.mock('../features/merchant/api/merchant.api');
vi.mock('../features/admin/api/admin.api');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(merchantApi.getMerchantWalletTransactions).mockResolvedValue({
    items: [],
    nextCursor: null,
  });
});
afterEach(cleanup);

const cases = [
  {
    name: 'consumer orders',
    view: <OrdersView />,
    mock: vi.mocked(consumerApi.getConsumerOrders),
    loading: th.consumerPortal.orders.loading,
  },
  {
    name: 'merchant dashboard',
    view: <MerchantDashboardView />,
    mock: vi.mocked(merchantApi.getMerchantDashboard),
    loading: th.merchantPortal.dashboard.loading,
  },
  {
    name: 'merchant wallet',
    view: <MerchantWalletView />,
    mock: vi.mocked(merchantApi.getMerchantWalletOverview),
    loading: th.merchantPortal.wallet.loading,
  },
  {
    name: 'admin tabs',
    view: <AdminDashboard adminName="Test admin" onLogout={() => {}} />,
    mock: vi.mocked(adminApi.getPlatformOverview),
    loading: th.adminPortal.loading,
  },
];

describe('page request lifecycle (NFR-UI-01)', () => {
  it.each(cases)(
    '$name ignores an old failure and keeps the current skeleton until its own failure',
    async ({ view, mock, loading }) => {
      let rejectOld: ((reason: Error) => void) | undefined;
      let rejectCurrent: ((reason: Error) => void) | undefined;
      mock.mockImplementationOnce(
        () =>
          new Promise<never>((_, reject) => {
            rejectOld = reject;
          }),
      );
      mock.mockImplementationOnce(
        () =>
          new Promise<never>((_, reject) => {
            rejectCurrent = reject;
          }),
      );

      render(<StrictMode>{view}</StrictMode>);
      await act(async () => {
        rejectOld?.(new Error('Old failure'));
      });
      expect(screen.getByText(loading)).toBeInTheDocument();
      expect(screen.getByText(loading)).toBeVisible();
      expect(
        screen
          .getByRole('status')
          .querySelector('[class*="motion-safe:animate-pulse"]'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Old failure')).not.toBeInTheDocument();

      await act(async () => {
        rejectCurrent?.(new Error('Current failure'));
      });
      expect(screen.getByText('Current failure')).toBeInTheDocument();
      expect(screen.queryByText(loading)).not.toBeInTheDocument();
    },
  );
});
