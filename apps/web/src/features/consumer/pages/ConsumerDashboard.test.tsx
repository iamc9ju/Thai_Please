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
  getConsumerQuests,
  getConsumerSubsidyStatus,
  getWalletTransactions,
} from '../api/consumer.api';
import type { ConsumerOverviewResponse } from '../consumer.types';
import type { ConsumerSubsidyStatusResponse } from '../consumer.types';
import { ConsumerDashboard } from './ConsumerDashboard';

vi.mock('../api/consumer.api', () => ({
  getConsumerOverview: vi.fn(),
  getConsumerQuests: vi.fn(),
  getConsumerSubsidyStatus: vi.fn(),
  getWalletTransactions: vi.fn(),
  topUpPersonalWallet: vi.fn(),
  previewOrder: vi.fn(),
  payByQr: vi.fn(),
}));

const overviewFixture: ConsumerOverviewResponse = {
  wallet: {
    walletId: 'wallet-api',
    personalBalance: 1234,
    subsidyBalance: 567,
    totalBalance: 99_999,
    dailySubsidyLimit: 300,
    dailySubsidyUsed: 75,
    dailySubsidyRemaining: 225,
    pointBalance: 987,
  },
  program: {
    programId: 'program-api',
    programName: 'โครงการจากระบบจริง',
    subsidyPercentage: 60,
    userPercentage: 40,
    dailySubsidyLimit: 300,
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
  },
  quests: [
    {
      userQuestId: 'user-quest-api',
      questId: 'quest-api',
      questName: 'ภารกิจจากระบบจริง',
      description: 'ซื้อสินค้าชุมชนในรายการเดียว',
      rewardPoint: 88,
      minSpend: 150,
      expiresAt: '2026-10-20T23:59:59.000Z',
      status: 'ACTIVE',
    },
  ],
  coupons: [
    {
      userCouponId: 'user-coupon-api',
      couponId: 'coupon-api',
      couponName: 'คูปองจากระบบจริง',
      description: 'ลด 25 บาทจากระบบจริง',
      discountType: 'FIXED',
      discountValue: 25,
      minPurchase: 100,
      expiresAt: '2026-10-31T23:59:59.000Z',
      status: 'AVAILABLE',
    },
  ],
  recentTransactions: [
    {
      transactionId: 'wallet-october',
      fundType: 'PERSONAL',
      transactionType: 'PERSONAL_TOPUP',
      amount: 300,
      balanceBefore: 934,
      balanceAfter: 1234,
      createdAt: '2026-10-14T03:00:00.000Z',
    },
    {
      transactionId: 'wallet-september',
      fundType: 'PERSONAL',
      transactionType: 'PAYMENT',
      amount: 50,
      balanceBefore: 984,
      balanceAfter: 934,
      createdAt: '2026-09-20T03:00:00.000Z',
    },
  ],
  recentOrders: [
    {
      orderId: 'order-api',
      merchantName: 'ร้านค้าจากระบบจริง',
      finalAmount: 321,
      paidAt: '2026-10-14T03:42:00.000Z',
    },
  ],
};

const subsidyFixture: ConsumerSubsidyStatusResponse = {
  currency: 'THB',
  timeZone: 'Asia/Bangkok',
  asOf: '2026-10-15T03:00:00.000Z',
  subsidyBalance: 567,
  dailySubsidyLimit: 300,
  dailySubsidyUsed: 75,
  dailySubsidyRemaining: 225,
  program: {
    programId: 'program-api',
    programName: 'โครงการจากระบบจริง',
    subsidyPercentage: 60,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
  },
};

const mockedGetConsumerOverview = vi.mocked(getConsumerOverview);
const mockedGetConsumerSubsidyStatus = vi.mocked(getConsumerSubsidyStatus);
const mockedGetWalletTransactions = vi.mocked(getWalletTransactions);
const mockedGetConsumerQuests = vi.mocked(getConsumerQuests);

beforeEach(() => {
  mockedGetConsumerOverview.mockReset();
  mockedGetConsumerOverview.mockResolvedValue(overviewFixture);
  mockedGetConsumerSubsidyStatus.mockReset();
  mockedGetConsumerSubsidyStatus.mockResolvedValue(subsidyFixture);
  mockedGetConsumerQuests.mockReset();
  mockedGetConsumerQuests.mockResolvedValue({ items: [], nextCursor: null });
  mockedGetWalletTransactions.mockReset();
  mockedGetWalletTransactions.mockImplementation(async (query) => ({
    items: overviewFixture.recentTransactions.filter((item) => {
      const date = item.createdAt.slice(0, 10);
      return (
        (!query.dateFrom || date >= query.dateFrom) &&
        (!query.dateTo || date <= query.dateTo)
      );
    }),
    nextCursor: null,
  }));
});

afterEach(cleanup);

function renderDashboard() {
  render(
    <ConsumerDashboard
      citizenId="1100000000001"
      fullName="ทดสอบ ระบบ"
      onLogout={vi.fn()}
    />,
  );
}

function clickFirstNavigation(label: string) {
  fireEvent.click(screen.getAllByRole('button', { name: label })[0]!);
}

describe('ConsumerDashboard', () => {
  it('shows an accessible loading state without mock overview content', () => {
    mockedGetConsumerOverview.mockReturnValue(new Promise(() => undefined));

    renderDashboard();

    expect(screen.getByRole('status')).toHaveTextContent(
      th.consumerDashboard.states.loading,
    );
    expect(
      screen.queryByText(th.consumerPortal.draftLabel),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('ร้านครัวบ้านเรา')).not.toBeInTheDocument();
  });

  it('renders the authenticated identity and API overview using integer baht', async () => {
    renderDashboard();

    expect(await screen.findByText('ร้านค้าจากระบบจริง')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'ทดสอบ ระบบ' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/X-XXXX-0001/)).toHaveLength(2);
    expect(
      screen.queryByText('ยอดเงินที่ใช้ได้ทั้งหมด'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('1,801.00')).not.toBeInTheDocument();
    expect(screen.queryByText('99,999.00')).not.toBeInTheDocument();
    expect(screen.getByText('฿1,234.00')).toBeInTheDocument();
    expect(screen.getByText('฿567.00')).toBeInTheDocument();
    expect(screen.getByText('โครงการจากระบบจริง')).toBeInTheDocument();
    expect(screen.getByText('ภารกิจจากระบบจริง')).toBeInTheDocument();
    expect(screen.getByText('ลด 25 บาทจากระบบจริง')).toBeInTheDocument();
    expect(screen.queryByText('ร้านครัวบ้านเรา')).not.toBeInTheDocument();
    expect(mockedGetConsumerOverview).toHaveBeenCalledOnce();
  });

  it('shows explicit empty states for overview collections', async () => {
    mockedGetConsumerOverview.mockResolvedValue({
      ...overviewFixture,
      quests: [],
      coupons: [],
      recentOrders: [],
    });
    mockedGetConsumerSubsidyStatus.mockResolvedValue({
      ...subsidyFixture,
      program: null,
      dailySubsidyLimit: 0,
      dailySubsidyUsed: 0,
      dailySubsidyRemaining: 0,
    });

    renderDashboard();

    expect(
      await screen.findByText(th.consumerDashboard.states.noQuests),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerDashboard.states.noCoupons),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerDashboard.states.noOrders),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerDashboard.wallet.noActiveProgram),
    ).toBeInTheDocument();
  });

  it('shows a localized error and retries the overview request', async () => {
    mockedGetConsumerOverview
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(overviewFixture);

    renderDashboard();

    expect(
      await screen.findByRole('heading', {
        name: th.consumerDashboard.states.errorTitle,
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerDashboard.states.retry,
      }),
    );

    await waitFor(() =>
      expect(mockedGetConsumerOverview).toHaveBeenCalledTimes(2),
    );
    expect(await screen.findByText('ร้านค้าจากระบบจริง')).toBeInTheDocument();
  });

  it('shows a permission-denied state for a forbidden overview request', async () => {
    mockedGetConsumerSubsidyStatus.mockRejectedValue(
      new ApiError(403, 'Forbidden resource'),
    );

    renderDashboard();

    expect(
      await screen.findByRole('heading', {
        name: th.consumerDashboard.states.permissionDeniedTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerDashboard.states.permissionDeniedDescription),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: th.consumerDashboard.states.retry,
      }),
    ).not.toBeInTheDocument();
  });

  it('clamps the daily subsidy progress to the accessible range', async () => {
    mockedGetConsumerSubsidyStatus.mockResolvedValue({
      ...subsidyFixture,
      dailySubsidyUsed: 450,
      dailySubsidyRemaining: 0,
    });

    renderDashboard();

    expect(await screen.findByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  it('navigates through the customer wallet and validates top-up input', async () => {
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.wallet);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.consumerPortal.wallet.title,
      }),
    ).toBeInTheDocument();
    fireEvent.change(
      await screen.findByLabelText(th.consumerPortal.wallet.topUpAmount),
      { target: { value: '0' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.wallet.topUpAction,
      }),
    );
    expect(
      screen.getByText(th.consumerPortal.wallet.invalidTopUp),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        th.consumerPortal.wallet.transactionTypes.payment,
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(th.consumerPortal.wallet.dateFrom), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText(th.consumerPortal.wallet.dateTo), {
      target: { value: '2026-10-31' },
    });
    expect(
      screen.queryByText(th.consumerPortal.wallet.transactionTypes.payment),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('พบ 1 รายการ')).toBeInTheDocument();
  });

  it('completes the mock payment review and opens its receipt', () => {
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.payment);

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.demoAction,
      }),
    );
    expect(
      screen.getByText(th.consumerPortal.payment.merchant),
    ).toBeInTheDocument();
    expect(screen.getByText('฿165.00')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: th.consumerPortal.payment.confirm }),
    );
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: th.consumerPortal.payment.successTitle,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.receiptAction,
      }),
    );
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.consumerPortal.orders.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.orders.immutableNote),
    ).toBeInTheDocument();
  });

  it('filters purchase history by a selected date range', () => {
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.orders);

    expect(screen.getByText('ตลาดสดบางรัก')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(th.consumerPortal.orders.dateFrom), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText(th.consumerPortal.orders.dateTo), {
      target: { value: '2026-10-31' },
    });

    expect(screen.queryByText('ตลาดสดบางรัก')).not.toBeInTheDocument();
    expect(screen.getByText('พบ 3 รายการ')).toBeInTheDocument();
  });

  it('shows completed quest history with its receipt reference', async () => {
    mockedGetConsumerQuests.mockResolvedValueOnce({
      items: [
        {
          id: '1',
          questName: 'อุดหนุนร้านอาหารชุมชน',
          status: 'ACTIVE',
          assignedAt: '2026-10-15T11:57:56.278Z',
          expiresAt: '2026-10-22T11:57:56.278Z',
          completedAt: null,
          type: 'CATEGORY_SPEND',
          targetCategoryId: '1',
          targetCategoryName: 'อาหารและเครื่องดื่ม',
          targetProductId: null,
          targetMerchantId: null,
          minimumSpendMinor: '10000',
          rewardPoints: 50,
        },
        {
          id: '2',
          questName: 'ช้อปของใช้ในชุมชน',
          status: 'COMPLETED',
          assignedAt: '2026-10-01T10:00:00.000Z',
          expiresAt: '2026-10-08T10:00:00.000Z',
          completedAt: '2026-10-05T14:30:00.000Z',
          type: 'MIN_SPEND',
          targetCategoryId: null,
          targetProductId: null,
          targetMerchantId: null,
          minimumSpendMinor: '15000',
          rewardPoints: 60,
        },
      ],
      nextCursor: null,
    });
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.quests);

    await waitFor(() => {
      expect(screen.getByText('อุดหนุนร้านอาหารชุมชน')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: /ประวัติภารกิจ/ }));

    expect(screen.getByText('ช้อปของใช้ในชุมชน')).toBeInTheDocument();
  });
});
