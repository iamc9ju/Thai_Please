import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantDashboardView } from './MerchantDashboardView';

const mockGetMerchantDashboard = vi.fn();

vi.mock('../api/merchant.api', () => ({
  getMerchantDashboard: (...args: unknown[]) =>
    mockGetMerchantDashboard(...args),
}));

describe('MerchantDashboardView (FR-M07)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetMerchantDashboard.mockResolvedValue({
      merchant: {
        merchantId: '301',
        merchantName: 'ร้านป้าศรี ข้าวแกงไทย',
        status: 'ACTIVE',
        merchantBalance: 450,
      },
      summary: {
        totalSales: 1200,
        totalSubtotal: 1300,
        totalDiscountAmount: 100,
        orderCount: {
          paid: 8,
          pending: 1,
          total: 9,
          averageOrderValue: 150,
        },
        subsidyReceived: 600,
        personalPaymentReceived: 600,
        subsidySharePercent: 50,
        personalSharePercent: 50,
        couponOrders: {
          count: 3,
          totalDiscount: 100,
          usageRatePercent: 38,
        },
      },
      topProducts: [
        {
          productId: '11',
          productName: 'ข้าวกะเพราไก่ไข่ดาว',
          categoryName: 'อาหารและเครื่องดื่ม',
          totalQuantity: 12,
          totalRevenue: 720,
          orderCount: 6,
        },
      ],
      salesTrend: [
        {
          date: '2026-10-17',
          totalSales: 450,
          subsidyAmount: 225,
          personalAmount: 225,
          discountAmount: 20,
          orderCount: 3,
        },
      ],
      dataFreshness: {
        asOf: '2026-10-17T04:00:00.000Z',
        timezone: 'Asia/Bangkok',
        trendDays: 7,
      },
    });
  });

  it('displays total sales, order count, subsidy/personal split, coupon metrics, top products, and freshness', async () => {
    render(<MerchantDashboardView />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-total-sales')).toHaveTextContent(
        '1,200',
      );
    });

    expect(screen.getByTestId('dashboard-paid-order-count')).toHaveTextContent(
      '8',
    );
    expect(screen.getByTestId('dashboard-subsidy-received')).toHaveTextContent(
      '600',
    );
    expect(screen.getByTestId('dashboard-personal-received')).toHaveTextContent(
      '600',
    );
    expect(screen.getByTestId('dashboard-coupon-orders')).toHaveTextContent(
      '3',
    );
    expect(screen.getByText('ข้าวกะเพราไก่ไข่ดาว')).toBeInTheDocument();
    expect(screen.getByText('2026-10-17')).toBeInTheDocument();
  });

  it('reloads dashboard when trend period is switched to 14 days', async () => {
    render(<MerchantDashboardView />);

    await waitFor(() => {
      expect(mockGetMerchantDashboard).toHaveBeenCalledWith(7);
    });

    fireEvent.click(screen.getByRole('button', { name: '14 วันล่าสุด' }));

    await waitFor(() => {
      expect(mockGetMerchantDashboard).toHaveBeenCalledWith(14);
    });
  });
});
