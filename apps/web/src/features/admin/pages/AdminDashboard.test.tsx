import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../api/admin.api';
import { AdminDashboard } from './AdminDashboard';

vi.mock('../api/admin.api', () => ({
  getPlatformOverview: vi.fn(),
  getAdminMerchants: vi.fn(),
  updateMerchantApprovalStatus: vi.fn(),
  getSubsidyPrograms: vi.fn(),
  createSubsidyProgram: vi.fn(),
  updateSubsidyProgramStatus: vi.fn(),
  getQuestGenerationLogs: vi.fn(),
  triggerQuestGeneration: vi.fn(),
  getRewardMonitoring: vi.fn(),
  getSocialImpactDashboard: vi.fn(),
  getAdminUsersAndRoles: vi.fn(),
  grantAdminRole: vi.fn(),
  updateAdminRoleStatus: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('AdminDashboard (FR-A01 through FR-A07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(adminApi.getPlatformOverview).mockResolvedValue({
      users: { total: 10, consumers: 7, merchants: 2, admins: 1 },
      merchants: {
        total: 3,
        active: 2,
        pending: 1,
        rejected: 0,
        suspended: 0,
      },
      orders: {
        totalOrders: 15,
        paidOrders: 12,
        pendingOrders: 3,
        totalFinalSpend: 2400,
        totalSubsidyUsed: 1200,
        totalPersonalPaid: 1200,
        totalDiscount: 150,
      },
      points: {
        totalCurrentBalance: 350,
        totalIssued: 500,
        totalRedeemed: 150,
        totalExpired: 0,
      },
      coupons: {
        catalogueCount: 5,
        totalIssued: 6,
        availableCount: 4,
        usedCount: 2,
        expiredCount: 0,
      },
      quests: {
        templatesCount: 3,
        totalAssigned: 20,
        activeCount: 14,
        completedCount: 6,
        expiredCount: 0,
      },
      activeProgram: {
        programId: '1',
        programName: 'โครงการไทยช่วยไทยพลีส (ระยะที่ 1)',
        initialGrant: 1000,
        subsidyPercentage: 50,
        dailySubsidyLimit: 200,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        status: 'ACTIVE',
      },
      asOf: '2026-10-17T05:00:00.000Z',
    });

    vi.mocked(adminApi.getAdminMerchants).mockResolvedValue([
      {
        merchantId: '11',
        merchantName: 'ร้านก๋วยเตี๋ยวเรือลุงเข้ม',
        merchantTypes: ['FOOD_BEVERAGE'],
        description: 'ก๋วยเตี๋ยวเรือรสเด็ด',
        address: '99 ถ.พหลโยธิน',
        phone: '0891234567',
        status: 'PENDING',
        owner: {
          userId: '4',
          fullName: 'ลุงเข้ม ขยันขาย',
          citizenIdMasked: '1-XXXX-XXXXX-04-4',
          phone: '0891234567',
        },
        walletBalance: 0,
        walletStatus: 'ACTIVE',
        productCount: 3,
        paidOrderCount: 0,
        totalSales: 0,
        createdAt: '2026-10-16T04:00:00.000Z',
        updatedAt: '2026-10-16T04:00:00.000Z',
      },
    ]);

    vi.mocked(adminApi.updateMerchantApprovalStatus).mockResolvedValue({
      merchantId: '11',
      merchantName: 'ร้านก๋วยเตี๋ยวเรือลุงเข้ม',
      previousStatus: 'PENDING',
      status: 'ACTIVE',
      updatedAt: '2026-10-17T05:10:00.000Z',
      audit: {
        event: 'ADMIN_MERCHANT_STATUS_CHANGED',
        actorAdminId: '1',
        merchantId: '11',
        merchantName: 'ร้านก๋วยเตี๋ยวเรือลุงเข้ม',
        previousStatus: 'PENDING',
        newStatus: 'ACTIVE',
        reason: 'อนุมัติเรียบร้อย',
        occurredAt: '2026-10-17T05:10:00.000Z',
      },
    });

    vi.mocked(adminApi.getSocialImpactDashboard).mockResolvedValue({
      activeConsumers: 8,
      participatingMerchants: 2,
      successfulOrders: 12,
      totalFinalSpend: 2400,
      totalSubsidyUsed: 1200,
      totalPersonalPaid: 1200,
      totalDiscountGiven: 150,
      averageSalesPerMerchant: 1200,
      questsAssigned: 20,
      questsCompleted: 6,
      questCompletionRate: 30,
      pointsIssued: 500,
      pointsRedeemed: 150,
      couponsIssued: 6,
      couponsUsed: 2,
      couponUsageRate: 33,
      salesByMerchant: [
        {
          merchantId: '1',
          merchantName: 'ร้านป้าศรี ข้าวแกง',
          orderCount: 8,
          totalSales: 1600,
          subsidyUsed: 800,
          personalPaid: 800,
        },
      ],
      salesByCategory: [
        {
          categoryId: '1',
          categoryName: 'อาหารและเครื่องดื่ม',
          itemCount: 18,
          totalSales: 1800,
          sharePercentage: 75,
        },
      ],
      dailyTrend: [
        {
          date: '2026-10-17',
          orderCount: 4,
          totalSales: 800,
          subsidyUsed: 400,
          personalPaid: 400,
        },
      ],
      metricVersion: '1.0.0',
      reportingTimezone: 'Asia/Bangkok',
      asOf: '2026-10-17T05:15:00.000Z',
    });
  });

  it('renders Platform Overview (FR-A01) metrics and active subsidy program', async () => {
    render(<AdminDashboard adminName="แอดมินทดสอบ" onLogout={vi.fn()} />);

    expect(
      await screen.findByText('โครงการไทยช่วยไทยพลีส (ระยะที่ 1)'),
    ).toBeInTheDocument();
    expect(screen.getByText('10 บัญชี')).toBeInTheDocument();
    expect(screen.getByText('฿2,400')).toBeInTheDocument();
    expect(screen.getByText('500 พอยต์')).toBeInTheDocument();
  });

  it('allows approving a PENDING merchant (FR-A02 & FR-M01) with audit feedback', async () => {
    render(<AdminDashboard adminName="แอดมินทดสอบ" onLogout={vi.fn()} />);

    await screen.findByText('10 บัญชี');

    fireEvent.click(
      screen.getByRole('button', { name: /อนุมัติร้านค้า \(FR-A02\)/i }),
    );

    expect(
      await screen.findByText('ร้านก๋วยเตี๋ยวเรือลุงเข้ม'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /อนุมัติร้านค้า$/i }));

    await waitFor(() => {
      expect(adminApi.updateMerchantApprovalStatus).toHaveBeenCalledWith(
        '11',
        'approve',
        undefined,
      );
    });

    expect(
      await screen.findByText(/อัปเดตสถานะร้าน "ร้านก๋วยเตี๋ยวเรือลุงเข้ม"/i),
    ).toBeInTheDocument();
  });

  it('switches to Social Impact Dashboard (FR-A07) and displays community metrics', async () => {
    render(<AdminDashboard adminName="แอดมินทดสอบ" onLogout={vi.fn()} />);

    await screen.findByText('10 บัญชี');

    fireEvent.click(
      screen.getByRole('button', { name: /ผลกระทบทางสังคม \(FR-A07\)/i }),
    );

    expect(await screen.findByText('ร้านป้าศรี ข้าวแกง')).toBeInTheDocument();
    expect(screen.getByText(/อาหารและเครื่องดื่ม/i)).toBeInTheDocument();
    expect(screen.getByText(/Metric Version: 1.0.0/i)).toBeInTheDocument();
  });
});
