import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../api/admin.api';
import { AdminDashboard } from './AdminDashboard';
import { th } from '../../../i18n/th';
import { merchantActionsCopy as merchantCopy } from '../merchant-actions.copy';
import { ApiError } from '../../../lib/api-client';

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
  updateSubsidyProgram: vi.fn(),
  getAdminUsersAndRoles: vi.fn(),
  grantAdminRole: vi.fn(),
  updateAdminRoleStatus: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('AdminDashboard (FR-A01 through FR-A07)', () => {
  it('shows bounded validation audit without admin generation controls', async () => {
    const copy = th.adminPortal;
    vi.mocked(adminApi.getQuestGenerationLogs).mockResolvedValue({
      eligibleConsumers: [
        {
          userId: '1',
          fullName: 'ผู้ใช้ทดสอบ',
          citizenIdMasked: 'X',
          pointBalance: 0,
          paidOrdersCount: 25,
          activeQuestsCount: 0,
        },
      ],
      logs: [
        {
          generationId: '1',
          requestKey: null,
          status: 'READY',
          provider: 'GEMINI',
          modelVersion: 'fixture',
          promptVersion: 'v3',
          policyVersion: 'quest-policy-v3',
          selectionReason: null,
          reservedPoints: 0,
          generatedAt: '2026-10-28T01:00:00Z',
          finishedAt: '2026-10-28T01:00:01Z',
          user: { userId: '1', fullName: 'ผู้ใช้ทดสอบ', citizenIdMasked: 'X' },
          actor: null,
          quest: null,
          assignment: null,
          proposals: [
            {
              id: 'MIN_SPEND:ALL:6000',
              type: 'MIN_SPEND',
              targetId: null,
              minimumSpendMinor: '6000',
            },
          ],
          validation: {
            attempts: [
              {
                call: 1,
                acceptedCount: 1,
                rejections: ['PROPOSAL_AMOUNT_INVALID'],
              },
            ],
            rejections: [],
          },
        },
      ],
    });
    vi.mocked(adminApi.triggerQuestGeneration).mockResolvedValue({
      status: 'PENDING',
      requestKey: '00000000-0000-4000-8000-000000000001',
      expiresAt: null,
      nextEligibleAt: null,
      reason: null,
      items: [],
    });
    render(<AdminDashboard adminName="แอดมินทดสอบ" onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: copy.nav.quests }));
    expect(
      await screen.findByText(copy.questAudit.proposals),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText(copy.questAudit.validation));
    expect(screen.getByText(/PROPOSAL_AMOUNT_INVALID/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.quests.generateBtn }),
    ).not.toBeInTheDocument();
    expect(adminApi.triggerQuestGeneration).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement native modal dialogs; keep open semantics for tests.
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };

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

    const adminNav = screen.getByRole('navigation', {
      name: th.adminPortal.shell.navigation,
    });
    fireEvent.click(
      within(adminNav).getByRole('button', { name: /อนุมัติร้านค้า/i }),
    );

    expect(
      await screen.findByText('ร้านก๋วยเตี๋ยวเรือลุงเข้ม'),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', {
        name: /อนุมัติร้านค้า$/i,
      }),
    );
    expect(
      screen.getByRole('dialog', { name: merchantCopy.confirmApprove }),
    ).toBeInTheDocument();
    expect(adminApi.updateMerchantApprovalStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: merchantCopy.approve }));

    await waitFor(() => {
      expect(adminApi.updateMerchantApprovalStatus).toHaveBeenCalledWith(
        '11',
        'approve',
        undefined,
        'PENDING',
      );
    });

    expect(
      await screen.findByText(/อัปเดตสถานะร้าน "ร้านก๋วยเตี๋ยวเรือลุงเข้ม"/i),
    ).toBeInTheDocument();
  });

  it('switches to Social Impact Dashboard (FR-A07) and displays community metrics', async () => {
    render(<AdminDashboard adminName="แอดมินทดสอบ" onLogout={vi.fn()} />);

    await screen.findByText('10 บัญชี');

    fireEvent.click(screen.getByRole('button', { name: /ผลกระทบทางสังคม/i }));

    expect(await screen.findByText('ร้านป้าศรี ข้าวแกง')).toBeInTheDocument();
    expect(screen.getByText(/อาหารและเครื่องดื่ม/i)).toBeInTheDocument();
    expect(screen.getByText(/Metric Version: 1.0.0/i)).toBeInTheDocument();
  });

  it('provides branded navigation, shortcuts, refresh and logout (FR-A01, FR-A02)', async () => {
    const onLogout = vi.fn();
    render(<AdminDashboard adminName="แอดมินทดสอบ" onLogout={onLogout} />);
    await screen.findByText('10 บัญชี');
    expect(screen.getByRole('img', { name: th.brand })).toHaveAttribute(
      'src',
      '/images/brand-logo.png',
    );
    expect(
      screen.getByRole('navigation', { name: th.adminPortal.shell.navigation }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.adminPortal.nav.overview }),
    ).toHaveAttribute('aria-current', 'page');

    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.refresh }),
    );
    await waitFor(() =>
      expect(adminApi.getPlatformOverview).toHaveBeenCalledTimes(2),
    );
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      screen.getByRole('button', { name: /ตรวจสอบร้านค้าที่รออนุมัติ/ }),
    );
    await screen.findByText('ร้านก๋วยเตี๋ยวเรือลุงเข้ม');
    expect(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    ).toHaveAttribute('aria-current', 'page');
    fireEvent.click(
      screen.getByRole('button', {
        name: th.adminPortal.logout,
      }),
    );
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('recovers from loading errors through retry (FR-A01)', async () => {
    vi.mocked(adminApi.getPlatformOverview).mockRejectedValueOnce(
      new Error('connection unavailable'),
    );
    render(<AdminDashboard onLogout={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      th.adminPortal.loading,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      th.adminPortal.errorTitle,
    );
    fireEvent.click(screen.getByRole('button', { name: th.adminPortal.retry }));
    expect(await screen.findByText('10 บัญชี')).toBeInTheDocument();
  });

  it('explains permission denial without displaying internal errors (FR-A03)', async () => {
    vi.mocked(adminApi.getPlatformOverview).mockRejectedValueOnce(
      new ApiError(403, 'internal permission details'),
    );
    render(<AdminDashboard onLogout={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      th.adminPortal.shell.forbiddenTitle,
    );
    expect(
      screen.queryByText('internal permission details'),
    ).not.toBeInTheDocument();
  });

  it('shows an empty merchant result for the selected status (FR-A02)', async () => {
    vi.mocked(adminApi.getAdminMerchants).mockResolvedValue([]);
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    );
    expect(
      await screen.findByText(th.adminPortal.merchants.empty),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: th.adminPortal.merchants.filterPending,
      }),
    );
    await waitFor(() =>
      expect(adminApi.getAdminMerchants).toHaveBeenLastCalledWith('PENDING'),
    );
  });

  it('shows when no subsidy program is active (FR-A01, FR-A04)', async () => {
    const overview = await adminApi.getPlatformOverview();
    vi.mocked(adminApi.getPlatformOverview).mockResolvedValue({
      ...overview,
      activeProgram: null,
    });
    render(<AdminDashboard onLogout={vi.fn()} />);
    expect(
      await screen.findByText(th.adminPortal.shell.noProgram),
    ).toBeInTheDocument();
  });
  it('keeps the current tab loaded when an older request finishes late (FR-A01/FR-A02)', async () => {
    let rejectOld: (reason: Error) => void = () => undefined;
    vi.mocked(adminApi.getPlatformOverview).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectOld = reject;
      }),
    );
    render(<AdminDashboard onLogout={vi.fn()} />);
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    );
    await screen.findByText('ร้านก๋วยเตี๋ยวเรือลุงเข้ม');
    rejectOld(new Error('stale error from overview'));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('ร้านก๋วยเตี๋ยวเรือลุงเข้ม')).toBeInTheDocument();
  });

  it('shows quest details without admin generation controls (FR-A05)', async () => {
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.nav.quests }),
    );
    expect(
      await screen.findByRole('heading', { name: th.adminPortal.quests.title }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(th.adminPortal.quests.selectConsumerLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: th.adminPortal.quests.generateBtn }),
    ).not.toBeInTheDocument();
    expect(adminApi.triggerQuestGeneration).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: th.adminPortal.quests.logsTitle }),
    ).toBeInTheDocument();
  });

  it('opens the API-backed program editor (FR-A04)', async () => {
    vi.mocked(adminApi.getSubsidyPrograms).mockResolvedValue([
      {
        programId: '21',
        programName: 'โครงการทดสอบ',
        initialGrant: 1000,
        subsidyPercentage: 60,
        userPercentage: 40,
        dailySubsidyLimit: 200,
        currency: 'THB',
        timezone: 'Asia/Bangkok',
        status: 'ACTIVE',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    ]);
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.nav.programs }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'แก้ไขโครงการ' }),
    );
    expect(
      screen.getByRole('form', { name: /แก้ไขรายละเอียดโครงการ/ }),
    ).toBeInTheDocument();
  });
  it('shows reward histories, expiry and explicit empty states (FR-A06)', async () => {
    vi.mocked(adminApi.getRewardMonitoring).mockResolvedValue({
      summary: {
        questsAssigned: 1,
        questsActive: 1,
        questsCompleted: 0,
        questsExpired: 0,
        questCompletionRate: 0,
        pointsIssued: 10,
        pointsRedeemed: 0,
        pointsExpired: 0,
        currentPointLiability: 10,
        couponsCatalogueCount: 0,
        couponsIssued: 0,
        couponsAvailable: 0,
        couponsUsed: 0,
        couponsExpired: 0,
        couponUsageRate: 0,
      },
      recentQuestAssignments: [],
      recentPointTransactions: [
        {
          pointTransactionId: '1',
          userId: '51',
          userFullName: 'ผู้ใช้ทดสอบ',
          transactionType: 'QUEST_REWARD',
          points: 10,
          sourceName: 'ภารกิจชุมชนทดสอบ',
          createdAt: '2026-10-28T00:00:00.000Z',
          expiresAt: '2026-11-28T00:00:00.000Z',
        },
      ],
      recentCouponRedemptions: [],
      asOf: '2026-10-28T00:00:00.000Z',
    });
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.nav.rewards }),
    );
    expect(
      await screen.findByText('ยังไม่มีรายการในหมวดนี้'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/รายการล่าสุดไม่เกิน 40 รายการต่อหมวด/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/ช่วงวันที่เลือกมีผลต่อแนวโน้ม/),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.rewards.pointsTab }),
    );
    expect(await screen.findByText(/ภารกิจชุมชนทดสอบ/)).toBeInTheDocument();
    expect(screen.getByText(/หมดอายุ:.*28/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.rewards.couponsTab }),
    );
    expect(screen.getByText('ยังไม่มีรายการในหมวดนี้')).toBeInTheDocument();
  });

  it('labels cumulative metrics and requests the selected trend period (FR-A07)', async () => {
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.nav.socialImpact }),
    );
    await screen.findByText('ร้านป้าศรี ข้าวแกง');
    expect(
      screen.getByText(/ตัวชี้วัดสรุปเป็นยอดสะสมทั้งหมด/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.socialImpact.days30 }),
    );
    await waitFor(() =>
      expect(adminApi.getSocialImpactDashboard).toHaveBeenLastCalledWith(30),
    );
    expect(
      screen.getByRole('button', { name: th.adminPortal.socialImpact.days30 }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('requires confirmation for rejection and cancellation sends no request (FR-A02)', async () => {
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    );
    await screen.findByText('ร้านก๋วยเตี๋ยวเรือลุงเข้ม');
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.merchants.rejectBtn }),
    );
    expect(
      screen.getByRole('dialog', { name: merchantCopy.confirmReject }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: merchantCopy.cancel }));
    expect(adminApi.updateMerchantApprovalStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: th.adminPortal.merchants.rejectBtn }),
    );
    fireEvent.click(screen.getByRole('button', { name: merchantCopy.reject }));
    await waitFor(() =>
      expect(adminApi.updateMerchantApprovalStatus).toHaveBeenCalledWith(
        '11',
        'reject',
        undefined,
        'PENDING',
      ),
    );
  });

  it('confirms only pending merchants and reports partial bulk failure (FR-A02)', async () => {
    const [base] = await adminApi.getAdminMerchants();
    if (!base) throw new Error('Missing merchant fixture');
    vi.mocked(adminApi.getAdminMerchants).mockResolvedValue([
      base,
      { ...base, merchantId: '12', merchantName: 'ร้านทดสอบที่สอง' },
      {
        ...base,
        merchantId: '13',
        merchantName: 'ร้านที่เปิดอยู่',
        status: 'ACTIVE',
      },
    ]);
    const approvedResult = await adminApi.updateMerchantApprovalStatus(
      '11',
      'approve',
    );
    vi.mocked(adminApi.updateMerchantApprovalStatus)
      .mockRejectedValueOnce(new ApiError(409, 'status changed'))
      .mockResolvedValueOnce(approvedResult);
    vi.mocked(adminApi.updateMerchantApprovalStatus).mockClear();
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    );
    await screen.findByText(base.merchantName);
    expect(
      screen.queryByRole('button', { name: merchantCopy.approveAll }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: th.adminPortal.merchants.filterPending,
      }),
    );
    const bulk = await screen.findByRole('button', {
      name: merchantCopy.approveAll,
    });
    await waitFor(() => expect(bulk).toBeEnabled());
    fireEvent.click(bulk);
    expect(
      screen.getByRole('dialog', { name: merchantCopy.confirmBulk }),
    ).toHaveTextContent('ร้านค้าที่รออนุมัติ 2 ร้าน');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('ร้านที่เปิดอยู่');
    expect(adminApi.updateMerchantApprovalStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: merchantCopy.approve }));
    await waitFor(() =>
      expect(adminApi.updateMerchantApprovalStatus).toHaveBeenCalledTimes(2),
    );
    expect(adminApi.updateMerchantApprovalStatus).toHaveBeenNthCalledWith(
      1,
      '11',
      'approve',
      undefined,
      'PENDING',
    );
    expect(adminApi.updateMerchantApprovalStatus).toHaveBeenNthCalledWith(
      2,
      '12',
      'approve',
      undefined,
      'PENDING',
    );
    expect(
      await screen.findByText(/อนุมัติสำเร็จ 1 ร้าน.*ไม่สำเร็จ 1 ร้าน/),
    ).toBeInTheDocument();
  });

  it('disables approve all when no merchant is pending (FR-A02)', async () => {
    vi.mocked(adminApi.getAdminMerchants).mockResolvedValue([]);
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    );
    await screen.findByText(th.adminPortal.merchants.empty);
    fireEvent.click(
      screen.getByRole('button', {
        name: th.adminPortal.merchants.filterPending,
      }),
    );
    expect(
      await screen.findByRole('button', { name: merchantCopy.approveAll }),
    ).toBeDisabled();
  });

  it('submits a confirmation only once while the request is pending (FR-A02)', async () => {
    const result = await adminApi.updateMerchantApprovalStatus('11', 'approve');
    let complete: (value: typeof result) => void = () => undefined;
    vi.mocked(adminApi.updateMerchantApprovalStatus)
      .mockClear()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          complete = resolve;
        }),
      );
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    );
    await screen.findByText('ร้านก๋วยเตี๋ยวเรือลุงเข้ม');
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', {
        name: th.adminPortal.merchants.approveBtn,
      }),
    );
    const confirm = screen.getByRole('button', { name: merchantCopy.approve });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(adminApi.updateMerchantApprovalStatus).toHaveBeenCalledOnce();
    expect(confirm).toBeDisabled();
    expect(
      screen.getByRole('button', { name: merchantCopy.cancel }),
    ).toBeDisabled();
    complete(result);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
  it('searches merchants and combines type filtering with the confirmed bulk snapshot (FR-A02)', async () => {
    const [base] = await adminApi.getAdminMerchants();
    if (!base) throw new Error('Missing merchant fixture');
    vi.mocked(adminApi.getAdminMerchants).mockResolvedValue([
      {
        ...base,
        merchantType: 'อาหารและเครื่องดื่ม',
        merchantTypes: ['FOOD_BEVERAGE'],
      },
      {
        ...base,
        merchantId: '12',
        merchantName: 'ร้านของชำทดสอบ',
        merchantType: 'ร้านขายของชำ',
        merchantTypes: ['OTOP', 'GENERAL_GOODS'],
      },
      {
        ...base,
        merchantId: '13',
        merchantName: 'ร้านเก่าที่ไม่ระบุประเภท',
        merchantType: null,
        merchantTypes: [],
      },
      {
        ...base,
        merchantId: '14',
        merchantName: 'ร้านข้อมูลเก่า',
        merchantType: 'ประเภทเดิม',
        merchantTypes: [],
      },
    ]);
    render(<AdminDashboard onLogout={vi.fn()} />);
    await screen.findByText('10 บัญชี');
    fireEvent.click(
      within(
        screen.getByRole('navigation', {
          name: th.adminPortal.shell.navigation,
        }),
      ).getByRole('button', { name: th.adminPortal.nav.merchants }),
    );
    await screen.findByText('ร้านของชำทดสอบ');
    fireEvent.change(screen.getByLabelText(merchantCopy.searchLabel), {
      target: { value: '  ของชำ  ' },
    });
    expect(screen.getByText('ร้านของชำทดสอบ')).toBeInTheDocument();
    expect(screen.queryByText(base.merchantName)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(merchantCopy.typeLabel), {
      target: { value: 'business:FOOD_BEVERAGE' },
    });
    expect(screen.getByText(merchantCopy.noMatches)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: merchantCopy.clearFilters }),
    );
    expect(screen.getByText(base.merchantName)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(merchantCopy.typeLabel), {
      target: { value: 'business:GENERAL_GOODS' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: th.adminPortal.merchants.filterPending,
      }),
    );
    const bulk = await screen.findByRole('button', {
      name: merchantCopy.approveAll,
    });
    fireEvent.click(bulk);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('ร้านของชำทดสอบ');
    expect(dialog).not.toHaveTextContent(base.merchantName);
    expect(dialog).toHaveTextContent('ร้านค้าที่รออนุมัติ 1 ร้าน');
    fireEvent.click(screen.getByRole('button', { name: merchantCopy.cancel }));
    fireEvent.change(screen.getByLabelText(merchantCopy.typeLabel), {
      target: { value: '__UNSPECIFIED__' },
    });
    expect(screen.getByText('ร้านเก่าที่ไม่ระบุประเภท')).toBeInTheDocument();
    expect(screen.queryByText('ร้านของชำทดสอบ')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(merchantCopy.typeLabel), {
      target: { value: 'legacy:ประเภทเดิม' },
    });
    expect(screen.getByText('ร้านข้อมูลเก่า')).toBeInTheDocument();
  });
});
