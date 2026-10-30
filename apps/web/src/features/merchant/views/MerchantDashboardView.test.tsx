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
      salesTrendPagination: {
        page: 1,
        pageSize: 5,
        totalItems: 1,
        totalPages: 1,
      },
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
      expect(mockGetMerchantDashboard).toHaveBeenCalledWith(7, 1, 5);
    });

    fireEvent.click(screen.getByRole('button', { name: '14 วันล่าสุด' }));

    await waitFor(() => {
      expect(mockGetMerchantDashboard).toHaveBeenCalledWith(14, 1, 5);
    });
  });

  it('renders the backend page and requests the next sales-trend page', async () => {
    const dashboard = await mockGetMerchantDashboard();
    mockGetMerchantDashboard.mockClear();
    mockGetMerchantDashboard.mockImplementation(
      (_days: number, page: number) => {
        const dates =
          page === 2
            ? ['2026-10-12']
            : [
                '2026-10-17',
                '2026-10-16',
                '2026-10-15',
                '2026-10-14',
                '2026-10-13',
              ];
        return Promise.resolve({
          ...dashboard,
          salesTrend: dates.map((date, index) => ({
            date,
            totalSales: 100 + index,
            subsidyAmount: 50,
            personalAmount: 50 + index,
            discountAmount: 0,
            orderCount: 1,
          })),
          salesTrendPagination: {
            page,
            pageSize: 5,
            totalItems: 6,
            totalPages: 2,
          },
        });
      },
    );

    render(<MerchantDashboardView />);

    const firstPageItems = await screen.findAllByTestId('sales-trend-item');
    expect(firstPageItems).toHaveLength(5);
    expect(firstPageItems[0]).toHaveTextContent('2026-10-17');
    expect(firstPageItems[4]).toHaveTextContent('2026-10-13');
    expect(screen.queryByText('2026-10-12')).not.toBeInTheDocument();
    expect(screen.getByText('หน้า 1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));

    await waitFor(() => {
      expect(mockGetMerchantDashboard).toHaveBeenCalledWith(7, 2, 5);
    });
    expect(await screen.findByText('2026-10-12')).toBeInTheDocument();
    expect(screen.queryByText('2026-10-17')).not.toBeInTheDocument();
    expect(screen.getByText('หน้า 2 / 2')).toBeInTheDocument();
  });
});
