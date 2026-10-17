import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  Gift,
  Layers,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import {
  createSubsidyProgram,
  getAdminMerchants,
  getAdminUsersAndRoles,
  getPlatformOverview,
  getQuestGenerationLogs,
  getRewardMonitoring,
  getSocialImpactDashboard,
  getSubsidyPrograms,
  grantAdminRole,
  triggerQuestGeneration,
  updateAdminRoleStatus,
  updateMerchantApprovalStatus,
  updateSubsidyProgramStatus,
} from '../api/admin.api';
import type {
  AdminMerchantItem,
  AdminUsersListResponse,
  PlatformOverviewResponse,
  ProgramStatus,
  QuestGenerationLogsResponse,
  RewardMonitoringResponse,
  SocialImpactDashboardResponse,
  SubsidyProgramItem,
} from '../admin.types';

type AdminTab =
  | 'overview'
  | 'merchants'
  | 'programs'
  | 'quests'
  | 'rewards'
  | 'socialImpact'
  | 'admins';

export interface AdminDashboardProps {
  adminName?: string;
  onLogout: () => void;
}

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function createUuidV4(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const val = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return val.toString(16);
  });
}

export function AdminDashboard({
  adminName = 'ผู้ดูแลระบบกลาง',
  onLogout,
}: AdminDashboardProps) {
  const copy = th.adminPortal;
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Tab states
  const [overview, setOverview] = useState<PlatformOverviewResponse | null>(
    null,
  );
  const [merchants, setMerchants] = useState<AdminMerchantItem[]>([]);
  const [merchantFilter, setMerchantFilter] = useState<string>('ALL');
  const [merchantActionReason, setMerchantActionReason] = useState<
    Record<string, string>
  >({});
  const [processingMerchantId, setProcessingMerchantId] = useState<
    string | null
  >(null);

  const [programs, setPrograms] = useState<SubsidyProgramItem[]>([]);
  const [newProgram, setNewProgram] = useState({
    programName: '',
    initialGrant: '1000',
    subsidyPercentage: '50',
    dailySubsidyLimit: '200',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });
  const [isSavingProgram, setIsSavingProgram] = useState(false);

  const [questLogsData, setQuestLogsData] =
    useState<QuestGenerationLogsResponse | null>(null);
  const [selectedConsumerId, setSelectedConsumerId] = useState<string>('');
  const [isGeneratingQuest, setIsGeneratingQuest] = useState(false);

  const [rewardMonitoring, setRewardMonitoring] =
    useState<RewardMonitoringResponse | null>(null);
  const [rewardSubTab, setRewardSubTab] = useState<
    'quests' | 'points' | 'coupons'
  >('quests');

  const [socialImpact, setSocialImpact] =
    useState<SocialImpactDashboardResponse | null>(null);
  const [impactDays, setImpactDays] = useState<7 | 14 | 30>(7);

  const [adminUsersData, setAdminUsersData] =
    useState<AdminUsersListResponse | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const loadActiveTabData = useCallback(
    async (tab: AdminTab) => {
      setIsLoading(true);
      setError(null);
      try {
        if (tab === 'overview') {
          const res = await getPlatformOverview();
          setOverview(res);
        } else if (tab === 'merchants') {
          const items = await getAdminMerchants(merchantFilter);
          setMerchants(items);
        } else if (tab === 'programs') {
          const items = await getSubsidyPrograms();
          setPrograms(items);
        } else if (tab === 'quests') {
          const res = await getQuestGenerationLogs();
          setQuestLogsData(res);
          if (!selectedConsumerId && res.eligibleConsumers[0]) {
            setSelectedConsumerId(res.eligibleConsumers[0].userId);
          }
        } else if (tab === 'rewards') {
          const res = await getRewardMonitoring();
          setRewardMonitoring(res);
        } else if (tab === 'socialImpact') {
          const res = await getSocialImpactDashboard(impactDays);
          setSocialImpact(res);
        } else if (tab === 'admins') {
          const res = await getAdminUsersAndRoles();
          setAdminUsersData(res);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.errorTitle);
      } finally {
        setIsLoading(false);
      }
    },
    [copy.errorTitle, impactDays, merchantFilter, selectedConsumerId],
  );

  useEffect(() => {
    void loadActiveTabData(activeTab);
  }, [activeTab, loadActiveTabData]);

  const handleMerchantAction = async (
    merchantId: string,
    action: 'approve' | 'reject' | 'suspend' | 'activate',
  ) => {
    setProcessingMerchantId(merchantId);
    setActionBanner(null);
    try {
      const reason = merchantActionReason[merchantId]?.trim();
      const result = await updateMerchantApprovalStatus(
        merchantId,
        action,
        reason,
      );
      setActionBanner({
        type: 'success',
        message: `อัปเดตสถานะร้าน "${result.merchantName}" จาก ${result.previousStatus} เป็น ${result.status} สำเร็จ (บันทึก Audit เรียบร้อย)`,
      });
      const refreshed = await getAdminMerchants(merchantFilter);
      setMerchants(refreshed);
    } catch (err) {
      setActionBanner({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเปลี่ยนสถานะร้านค้าได้',
      });
    } finally {
      setProcessingMerchantId(null);
    }
  };

  const handleCreateProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newProgram.programName.trim()) return;
    setIsSavingProgram(true);
    setActionBanner(null);
    try {
      const created = await createSubsidyProgram({
        programName: newProgram.programName.trim(),
        initialGrant: Number(newProgram.initialGrant),
        subsidyPercentage: Number(newProgram.subsidyPercentage),
        dailySubsidyLimit: Number(newProgram.dailySubsidyLimit),
        startDate: newProgram.startDate,
        endDate: newProgram.endDate,
        status: 'ACTIVE',
      });
      setActionBanner({
        type: 'success',
        message: `สร้างโครงการ "${created.programName}" สำเร็จ`,
      });
      setNewProgram((prev) => ({ ...prev, programName: '' }));
      const refreshed = await getSubsidyPrograms();
      setPrograms(refreshed);
    } catch (err) {
      setActionBanner({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถสร้างโครงการเงินอุดหนุนได้',
      });
    } finally {
      setIsSavingProgram(false);
    }
  };

  const handleProgramStatusChange = async (
    programId: string,
    status: ProgramStatus,
  ) => {
    setActionBanner(null);
    try {
      const updated = await updateSubsidyProgramStatus(programId, status);
      setActionBanner({
        type: 'success',
        message: `เปลี่ยนสถานะโครงการ "${updated.programName}" เป็น ${updated.status} สำเร็จ`,
      });
      const refreshed = await getSubsidyPrograms();
      setPrograms(refreshed);
    } catch (err) {
      setActionBanner({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเปลี่ยนสถานะโครงการได้',
      });
    }
  };

  const handleTriggerQuestGeneration = async () => {
    if (!selectedConsumerId || isGeneratingQuest) return;
    setIsGeneratingQuest(true);
    setActionBanner(null);
    try {
      const result = await triggerQuestGeneration(
        selectedConsumerId,
        createUuidV4(),
      );
      const questTitle = result.title || 'ภารกิจเฉพาะบุคคล';
      const points =
        typeof result.rewardPoints === 'number' ? result.rewardPoints : 0;
      const genRef = result.generationId ?? 'สำเร็จ';
      setActionBanner({
        type: 'success',
        message: `สร้างและมอบหมายภารกิจ "${questTitle}" (+${points} พอยต์) สำเร็จ (Generation #${genRef})`,
      });
      const refreshed = await getQuestGenerationLogs();
      setQuestLogsData(refreshed);
    } catch (err) {
      setActionBanner({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถสร้างภารกิจด้วย AI ได้ในขณะนี้',
      });
    } finally {
      setIsGeneratingQuest(false);
    }
  };

  const handleGrantAdmin = async (userId: string) => {
    setProcessingUserId(userId);
    setActionBanner(null);
    try {
      const res = await grantAdminRole(userId);
      setActionBanner({
        type: 'success',
        message: `มอบสิทธิ์ผู้ดูแลระบบ (ADMIN) ให้คุณ "${res.fullName}" สำเร็จ`,
      });
      const refreshed = await getAdminUsersAndRoles();
      setAdminUsersData(refreshed);
    } catch (err) {
      setActionBanner({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถมอบสิทธิ์ผู้ดูแลระบบได้',
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleToggleAdminStatus = async (
    userId: string,
    nextStatus: 'ACTIVE' | 'SUSPENDED',
  ) => {
    setProcessingUserId(userId);
    setActionBanner(null);
    try {
      const res = await updateAdminRoleStatus(userId, nextStatus);
      setActionBanner({
        type: 'success',
        message: `อัปเดตสถานะสิทธิ์ ADMIN ของคุณ "${res.fullName}" เป็น ${res.status} สำเร็จ`,
      });
      const refreshed = await getAdminUsersAndRoles();
      setAdminUsersData(refreshed);
    } catch (err) {
      setActionBanner({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเปลี่ยนสถานะสิทธิ์ผู้ดูแลระบบได้',
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Kanit',sans-serif] text-slate-900">
      {/* Blue Theme Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  {adminName}
                </h1>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  {copy.roleBadge}
                </span>
              </div>
              <p className="text-xs text-blue-100">{copy.brandSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActionBanner(null);
                void loadActiveTabData(activeTab);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
            >
              <RefreshCw className="size-3.5" />
              {copy.refresh}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-blue-100 ring-1 ring-white/20 transition hover:bg-red-500/80 hover:text-white"
            >
              <LogOut className="size-3.5" />
              {copy.logout}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t border-white/15 bg-[#003d82]/60">
          <div className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
            {(
              [
                {
                  key: 'overview',
                  label: copy.nav.overview,
                  icon: Layers,
                },
                {
                  key: 'merchants',
                  label: copy.nav.merchants,
                  icon: Store,
                },
                {
                  key: 'programs',
                  label: copy.nav.programs,
                  icon: Coins,
                },
                {
                  key: 'quests',
                  label: copy.nav.quests,
                  icon: Sparkles,
                },
                {
                  key: 'rewards',
                  label: copy.nav.rewards,
                  icon: Award,
                },
                {
                  key: 'socialImpact',
                  label: copy.nav.socialImpact,
                  icon: BarChart3,
                },
                {
                  key: 'admins',
                  label: copy.nav.admins,
                  icon: UserCheck,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActionBanner(null);
                    setActiveTab(tab.key);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-white text-[#0056b3] shadow-sm'
                      : 'text-blue-100 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {actionBanner && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-medium ${
              actionBanner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionBanner.type === 'success' ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="size-5 shrink-0 text-red-600" />
              )}
              <span>{actionBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="text-xs font-semibold underline opacity-75 hover:opacity-100"
            >
              ปิด
            </button>
          </div>
        )}

        {isLoading ? (
          <div
            role="status"
            className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
          >
            <div className="mb-4 size-10 animate-spin rounded-full border-4 border-[#0056b3] border-r-transparent" />
            <p className="text-sm font-medium text-slate-600">{copy.loading}</p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          >
            <AlertCircle className="mx-auto mb-3 size-10 text-red-600" />
            <h2 className="text-base font-bold text-red-900">
              {copy.errorTitle}
            </h2>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadActiveTabData(activeTab)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0056b3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003d82]"
            >
              <RefreshCw className="size-4" />
              {copy.retry}
            </button>
          </div>
        ) : null}

        {/* TAB 1: FR-A01 Platform Overview */}
        {!isLoading && !error && activeTab === 'overview' && overview && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg">
              <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                {copy.overview.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {copy.overview.title}
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                {copy.overview.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.usersCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3]">
                    <Users className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">
                  {overview.users.total.toLocaleString('th-TH')} บัญชี
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ประชาชน {overview.users.consumers} · ร้านค้า{' '}
                  {overview.users.merchants} · แอดมิน {overview.users.admins}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.merchantsCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Store className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">
                  {overview.merchants.total.toLocaleString('th-TH')} ร้าน
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  เปิดใช้งาน {overview.merchants.active} · รออนุมัติ{' '}
                  {overview.merchants.pending}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.paidOrdersCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <FileText className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">
                  {overview.orders.paidOrders.toLocaleString('th-TH')} บิล
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  จากทั้งหมด {overview.orders.totalOrders} รายการ (รอชำระ{' '}
                  {overview.orders.pendingOrders})
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.totalSpendCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <TrendingUp className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-[#0056b3]">
                  {formatBaht(overview.orders.totalFinalSpend)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ลูกค้าจ่ายเอง {formatBaht(overview.orders.totalPersonalPaid)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.subsidyUsedCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <Coins className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-emerald-700">
                  {formatBaht(overview.orders.totalSubsidyUsed)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ส่วนลดคูปองรวม {formatBaht(overview.orders.totalDiscount)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.pointsCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Award className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">
                  {overview.points.totalIssued.toLocaleString('th-TH')} พอยต์
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  แลกแล้ว{' '}
                  {overview.points.totalRedeemed.toLocaleString('th-TH')} ·
                  คงเหลือในระบบ{' '}
                  {overview.points.totalCurrentBalance.toLocaleString('th-TH')}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.couponsCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <Gift className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">
                  {overview.coupons.totalIssued.toLocaleString('th-TH')} ใบ
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ใช้แล้ว {overview.coupons.usedCount} · พร้อมใช้{' '}
                  {overview.coupons.availableCount} · แค็ตตาล็อก{' '}
                  {overview.coupons.catalogueCount} แบบ
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.questsCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3]">
                    <Target className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">
                  {overview.quests.totalAssigned.toLocaleString('th-TH')} รายการ
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  สำเร็จแล้ว {overview.quests.completedCount} · กำลังทำ{' '}
                  {overview.quests.activeCount}
                </p>
              </div>
            </div>

            {overview.activeProgram && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0056b3] px-3 py-0.5 text-xs font-semibold text-white">
                      {copy.overview.activeProgramTitle}
                    </span>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">
                      {overview.activeProgram.programName}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600">
                      ระยะเวลาโครงการ:{' '}
                      {formatShortDate(overview.activeProgram.startDate)} –{' '}
                      {formatShortDate(overview.activeProgram.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="rounded-xl bg-white px-4 py-2.5 shadow-sm">
                      <p className="text-xs text-slate-500">วงเงินตั้งต้น</p>
                      <p className="font-bold text-[#0056b3]">
                        {formatBaht(overview.activeProgram.initialGrant)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-2.5 shadow-sm">
                      <p className="text-xs text-slate-500">รัฐร่วมจ่าย</p>
                      <p className="font-bold text-emerald-700">
                        {overview.activeProgram.subsidyPercentage}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-2.5 shadow-sm">
                      <p className="text-xs text-slate-500">เพดานรายวัน</p>
                      <p className="font-bold text-slate-900">
                        {formatBaht(overview.activeProgram.dailySubsidyLimit)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: FR-A02 & FR-M01 Merchant Approval */}
        {!isLoading && !error && activeTab === 'merchants' && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg">
              <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                {copy.merchants.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {copy.merchants.title}
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                {copy.merchants.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'ALL', label: copy.merchants.filterAll },
                { key: 'PENDING', label: copy.merchants.filterPending },
                { key: 'ACTIVE', label: copy.merchants.filterActive },
                { key: 'SUSPENDED', label: copy.merchants.filterSuspended },
                { key: 'REJECTED', label: copy.merchants.filterRejected },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setMerchantFilter(filter.key)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                    merchantFilter === filter.key
                      ? 'bg-[#0056b3] text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {merchants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                {copy.merchants.empty}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {merchants.map((merchant) => {
                  const isBusy = processingMerchantId === merchant.merchantId;
                  return (
                    <div
                      key={merchant.merchantId}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Building2 className="size-4 text-[#0056b3]" />
                            <h3 className="text-base font-bold text-slate-900">
                              {merchant.merchantName}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                merchant.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : merchant.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {merchant.status}
                            </span>
                          </div>
                          {merchant.description && (
                            <p className="text-xs text-slate-600">
                              {merchant.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-500">
                            เจ้าของร้าน: {merchant.owner.fullName} (
                            {merchant.owner.citizenIdMasked}) · โทร:{' '}
                            {merchant.phone ?? '-'}
                          </p>
                          {merchant.address && (
                            <p className="text-xs text-slate-500">
                              ที่ตั้ง: {merchant.address}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs">
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <span className="text-slate-500">ยอดขายสะสม</span>
                            <p className="font-bold text-[#0056b3]">
                              {formatBaht(merchant.totalSales)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <span className="text-slate-500">
                              กระเป๋าร้านค้า
                            </span>
                            <p className="font-bold text-emerald-700">
                              {formatBaht(merchant.walletBalance)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <span className="text-slate-500">
                              สินค้า / ออเดอร์
                            </span>
                            <p className="font-bold text-slate-900">
                              {merchant.productCount} รายการ /{' '}
                              {merchant.paidOrderCount} บิล
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <input
                          type="text"
                          value={
                            merchantActionReason[merchant.merchantId] ?? ''
                          }
                          onChange={(e) =>
                            setMerchantActionReason((prev) => ({
                              ...prev,
                              [merchant.merchantId]: e.target.value,
                            }))
                          }
                          placeholder="ระบุหมายเหตุการตรวจสอบ (บันทึกใน Audit Event)..."
                          className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0056b3] focus:outline-none"
                        />

                        <div className="flex flex-wrap gap-2">
                          {merchant.status !== 'ACTIVE' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleMerchantAction(
                                  merchant.merchantId,
                                  merchant.status === 'SUSPENDED'
                                    ? 'activate'
                                    : 'approve',
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 className="size-3.5" />
                              {merchant.status === 'SUSPENDED'
                                ? copy.merchants.activateBtn
                                : copy.merchants.approveBtn}
                            </button>
                          )}

                          {merchant.status === 'PENDING' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleMerchantAction(
                                  merchant.merchantId,
                                  'reject',
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              <XCircle className="size-3.5" />
                              {copy.merchants.rejectBtn}
                            </button>
                          )}

                          {merchant.status === 'ACTIVE' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleMerchantAction(
                                  merchant.merchantId,
                                  'suspend',
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            >
                              <Clock className="size-3.5" />
                              {copy.merchants.suspendBtn}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: FR-A04 Subsidy Program Management */}
        {!isLoading && !error && activeTab === 'programs' && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg">
              <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                {copy.programs.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {copy.programs.title}
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                {copy.programs.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <form
                onSubmit={(e) => void handleCreateProgram(e)}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5"
              >
                <div className="flex items-center gap-2">
                  <Plus className="size-5 text-[#0056b3]" />
                  <h3 className="text-base font-bold text-slate-900">
                    {copy.programs.createTitle}
                  </h3>
                </div>

                <div>
                  <label
                    htmlFor="program-name-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {copy.programs.programNameLabel}
                  </label>
                  <input
                    id="program-name-input"
                    type="text"
                    required
                    value={newProgram.programName}
                    onChange={(e) =>
                      setNewProgram((prev) => ({
                        ...prev,
                        programName: e.target.value,
                      }))
                    }
                    placeholder="เช่น โครงการไทยช่วยไทยพลีส (ระยะที่ 2)"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-[#0056b3] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="program-grant-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {copy.programs.initialGrantLabel}
                    </label>
                    <input
                      id="program-grant-input"
                      type="number"
                      min={1}
                      max={100000}
                      required
                      value={newProgram.initialGrant}
                      onChange={(e) =>
                        setNewProgram((prev) => ({
                          ...prev,
                          initialGrant: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="program-percent-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {copy.programs.subsidyPercentLabel}
                    </label>
                    <input
                      id="program-percent-input"
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={newProgram.subsidyPercentage}
                      onChange={(e) =>
                        setNewProgram((prev) => ({
                          ...prev,
                          subsidyPercentage: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="program-cap-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {copy.programs.dailyCapLabel}
                    </label>
                    <input
                      id="program-cap-input"
                      type="number"
                      min={1}
                      max={50000}
                      required
                      value={newProgram.dailySubsidyLimit}
                      onChange={(e) =>
                        setNewProgram((prev) => ({
                          ...prev,
                          dailySubsidyLimit: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="program-start-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {copy.programs.startDateLabel}
                    </label>
                    <input
                      id="program-start-input"
                      type="date"
                      required
                      value={newProgram.startDate}
                      onChange={(e) =>
                        setNewProgram((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="program-end-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {copy.programs.endDateLabel}
                    </label>
                    <input
                      id="program-end-input"
                      type="date"
                      required
                      value={newProgram.endDate}
                      onChange={(e) =>
                        setNewProgram((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingProgram}
                  className="w-full rounded-xl bg-[#0056b3] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003d82] disabled:opacity-50"
                >
                  {copy.programs.createBtn}
                </button>
              </form>

              <div className="space-y-4 lg:col-span-7">
                <h3 className="text-base font-bold text-slate-900">
                  {copy.programs.listTitle}
                </h3>
                {programs.map((program) => (
                  <div
                    key={program.programId}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900">
                            {program.programName}
                          </h4>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              program.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {program.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          ช่วงเวลา: {formatShortDate(program.startDate)} –{' '}
                          {formatShortDate(program.endDate)} · สกุลเงิน{' '}
                          {program.currency} ({program.timezone})
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {program.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleProgramStatusChange(
                                program.programId,
                                'ACTIVE',
                              )
                            }
                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            {copy.programs.activateBtn}
                          </button>
                        )}
                        {program.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleProgramStatusChange(
                                program.programId,
                                'INACTIVE',
                              )
                            }
                            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            {copy.programs.pauseBtn}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
                      <div>
                        <span className="text-slate-500">วงเงินตั้งต้น</span>
                        <p className="font-bold text-[#0056b3]">
                          {formatBaht(program.initialGrant)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">
                          สัดส่วนรัฐ / ประชาชน
                        </span>
                        <p className="font-bold text-emerald-700">
                          {program.subsidyPercentage}% /{' '}
                          {program.userPercentage}%
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">เพดานต่อวัน</span>
                        <p className="font-bold text-slate-900">
                          {formatBaht(program.dailySubsidyLimit)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: FR-A05 & FR-S04 AI Quest Generation & Logs */}
        {!isLoading && !error && activeTab === 'quests' && questLogsData && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg">
              <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                {copy.quests.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {copy.quests.title}
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                {copy.quests.description}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-[#0056b3]" />
                <h3 className="text-base font-bold text-slate-900">
                  {copy.quests.generateCardTitle}
                </h3>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div className="min-w-[260px] flex-1">
                  <label
                    htmlFor="select-consumer-quest"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {copy.quests.selectConsumerLabel}
                  </label>
                  <select
                    id="select-consumer-quest"
                    value={selectedConsumerId}
                    onChange={(e) => setSelectedConsumerId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-[#0056b3] focus:outline-none"
                  >
                    {questLogsData.eligibleConsumers.map((consumer) => (
                      <option key={consumer.userId} value={consumer.userId}>
                        {consumer.fullName} ({consumer.citizenIdMasked}) ·
                        บิลชำระแล้ว {consumer.paidOrdersCount} · ภารกิจกำลังทำ{' '}
                        {consumer.activeQuestsCount}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={!selectedConsumerId || isGeneratingQuest}
                  onClick={() => void handleTriggerQuestGeneration()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0056b3] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003d82] disabled:opacity-50"
                >
                  <Sparkles className="size-4" />
                  {isGeneratingQuest
                    ? copy.quests.generatingBtn
                    : copy.quests.generateBtn}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">
                {copy.quests.logsTitle}
              </h3>

              {questLogsData.logs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  {copy.quests.emptyLogs}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {questLogsData.logs.map((log) => (
                    <div
                      key={log.generationId}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-[#0056b3] px-2.5 py-0.5 text-xs font-semibold text-white">
                              Log #{log.generationId}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              {log.status}
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                              ผู้รับภารกิจ: {log.user.fullName} (
                              {log.user.citizenIdMasked})
                            </span>
                          </div>
                          {log.quest && (
                            <p className="mt-1.5 text-sm font-bold text-slate-900">
                              {log.quest.questName} (+{log.quest.rewardPoint}{' '}
                              พอยต์ · ขั้นต่ำ {formatBaht(log.quest.minSpend)})
                            </p>
                          )}
                          {log.selectionReason && (
                            <p className="mt-1 text-xs text-slate-600">
                              เหตุผลการคัดเลือก: {log.selectionReason}
                            </p>
                          )}
                        </div>

                        <div className="text-right text-xs text-slate-500">
                          <p>
                            Provider: <strong>{log.provider}</strong> (
                            {log.modelVersion})
                          </p>
                          <p>
                            Prompt {log.promptVersion} · Policy{' '}
                            {log.policyVersion}
                          </p>
                          <p>{formatDateTime(log.generatedAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 5: FR-A06 Reward Monitoring */}
        {!isLoading &&
          !error &&
          activeTab === 'rewards' &&
          rewardMonitoring && (
            <section className="space-y-6">
              <div className="rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg">
                <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                  {copy.rewards.eyebrow}
                </p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                  {copy.rewards.title}
                </h2>
                <p className="mt-1 text-sm text-blue-100">
                  {copy.rewards.description}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    อัตราทำภารกิจสำเร็จ (Quest Completion)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-[#0056b3]">
                    {rewardMonitoring.summary.questCompletionRate}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    สำเร็จ {rewardMonitoring.summary.questsCompleted} / มอบหมาย{' '}
                    {rewardMonitoring.summary.questsAssigned} (หมดอายุ{' '}
                    {rewardMonitoring.summary.questsExpired})
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    พอยต์ที่ออกให้ทั้งหมด (Points Issued)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                    +
                    {rewardMonitoring.summary.pointsIssued.toLocaleString(
                      'th-TH',
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    แลกคูปองแล้ว{' '}
                    {rewardMonitoring.summary.pointsRedeemed.toLocaleString(
                      'th-TH',
                    )}{' '}
                    พอยต์
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    พอยต์คงเหลือของผู้ใช้รวม (Point Liability)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    {rewardMonitoring.summary.currentPointLiability.toLocaleString(
                      'th-TH',
                    )}{' '}
                    พอยต์
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    พอยต์หมดอายุสะสม{' '}
                    {rewardMonitoring.summary.pointsExpired.toLocaleString(
                      'th-TH',
                    )}{' '}
                    พอยต์
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    อัตราการใช้คูปอง (Coupon Usage Rate)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-purple-700">
                    {rewardMonitoring.summary.couponUsageRate}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ใช้แล้ว {rewardMonitoring.summary.couponsUsed} / แลกทั้งหมด{' '}
                    {rewardMonitoring.summary.couponsIssued} ใบ
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'quests', label: copy.rewards.questsTab },
                    { key: 'points', label: copy.rewards.pointsTab },
                    { key: 'coupons', label: copy.rewards.couponsTab },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setRewardSubTab(t.key)}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                      rewardSubTab === t.key
                        ? 'bg-[#0056b3] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {rewardSubTab === 'quests' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="space-y-3">
                    {rewardMonitoring.recentQuestAssignments.map((item) => (
                      <div
                        key={item.userQuestId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {item.questName} (+{item.rewardPoint} พอยต์)
                          </p>
                          <p className="text-slate-500">
                            ผู้ใช้: {item.userFullName} · มอบหมายเมื่อ{' '}
                            {formatDateTime(item.assignedAt)} · หมดอายุ{' '}
                            {formatDateTime(item.expiresAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-semibold ${
                            item.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'EXPIRED'
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-blue-50 text-[#0056b3]'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rewardSubTab === 'points' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="space-y-3">
                    {rewardMonitoring.recentPointTransactions.map((pt) => (
                      <div
                        key={pt.pointTransactionId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {pt.sourceName} ({pt.transactionType})
                          </p>
                          <p className="text-slate-500">
                            ผู้ใช้: {pt.userFullName} ·{' '}
                            {formatDateTime(pt.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-extrabold ${
                            pt.points > 0
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {pt.points > 0 ? `+${pt.points}` : pt.points} พอยต์
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rewardSubTab === 'coupons' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="space-y-3">
                    {rewardMonitoring.recentCouponRedemptions.map((uc) => (
                      <div
                        key={uc.userCouponId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {uc.couponName} (ใช้ {uc.pointCost} พอยต์)
                          </p>
                          <p className="text-slate-500">
                            ผู้ใช้: {uc.userFullName} · แลกเมื่อ{' '}
                            {formatDateTime(uc.redeemedAt)} · หมดอายุ{' '}
                            {formatDateTime(uc.expiresAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-semibold ${
                            uc.status === 'USED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : uc.status === 'EXPIRED'
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-blue-50 text-[#0056b3]'
                          }`}
                        >
                          {uc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

        {/* TAB 6: FR-A07 Social Impact Dashboard */}
        {!isLoading &&
          !error &&
          activeTab === 'socialImpact' &&
          socialImpact && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg">
                <div>
                  <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                    {copy.socialImpact.eyebrow}
                  </p>
                  <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                    {copy.socialImpact.title}
                  </h2>
                  <p className="mt-1 text-sm text-blue-100">
                    {copy.socialImpact.description}
                  </p>
                </div>

                <div className="flex gap-1.5 rounded-xl bg-white/15 p-1">
                  {(
                    [
                      { days: 7, label: copy.socialImpact.days7 },
                      { days: 14, label: copy.socialImpact.days14 },
                      { days: 30, label: copy.socialImpact.days30 },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.days}
                      type="button"
                      onClick={() => setImpactDays(item.days)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        impactDays === item.days
                          ? 'bg-white text-[#0056b3]'
                          : 'text-blue-100 hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    ประชาชนที่เข้าร่วม (Active Consumers)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    {socialImpact.activeConsumers.toLocaleString('th-TH')} คน
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ร้านค้าชุมชนที่เข้าร่วม{' '}
                    {socialImpact.participatingMerchants} ร้าน
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    เงินหมุนเวียนสู่ชุมชนรวม (Total Final Spend)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-[#0056b3]">
                    {formatBaht(socialImpact.totalFinalSpend)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    จาก {socialImpact.successfulOrders} บิลสำเร็จ · เฉลี่ยร้านละ{' '}
                    {formatBaht(socialImpact.averageSalesPerMerchant)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    เงินอุดหนุนรัฐที่ใช้จริง (Total Subsidy Used)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                    {formatBaht(socialImpact.totalSubsidyUsed)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    เงินส่วนตัวประชาชนสมทบ{' '}
                    {formatBaht(socialImpact.totalPersonalPaid)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    ประสิทธิผลภารกิจ & คูปอง
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    ภารกิจสำเร็จ {socialImpact.questCompletionRate}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    อัตราใช้คูปอง {socialImpact.couponUsageRate}% · พอยต์ออกแล้ว{' '}
                    {socialImpact.pointsIssued}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Sales by Merchant */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
                  <h3 className="text-base font-bold text-slate-900">
                    {copy.socialImpact.salesByMerchantTitle}
                  </h3>
                  <div className="mt-4 space-y-3">
                    {socialImpact.salesByMerchant.map((m, idx) => (
                      <div
                        key={m.merchantId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-[#0056b3] font-bold text-white">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900">
                              {m.merchantName}
                            </p>
                            <p className="text-slate-500">
                              {m.orderCount} บิลสำเร็จ · รัฐอุดหนุน{' '}
                              {formatBaht(m.subsidyUsed)} · จ่ายเอง{' '}
                              {formatBaht(m.personalPaid)}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-extrabold text-[#0056b3]">
                          {formatBaht(m.totalSales)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sales by Category */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
                  <h3 className="text-base font-bold text-slate-900">
                    {copy.socialImpact.salesByCategoryTitle}
                  </h3>
                  <div className="mt-4 space-y-4">
                    {socialImpact.salesByCategory.map((cat) => (
                      <div key={cat.categoryId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">
                            {cat.categoryName} ({cat.itemCount} ชิ้น)
                          </span>
                          <span className="font-semibold text-[#0056b3]">
                            {formatBaht(cat.totalSales)} ({cat.sharePercentage}
                            %)
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#0056b3]"
                            style={{
                              width: `${Math.max(4, cat.sharePercentage)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Daily Trend */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {copy.socialImpact.dailyTrendTitle}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Metric Version: {socialImpact.metricVersion} · Timezone:{' '}
                    {socialImpact.reportingTimezone} · ข้อมูล ณ{' '}
                    {formatDateTime(socialImpact.asOf)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
                  {socialImpact.dailyTrend.map((day) => (
                    <div
                      key={day.date}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"
                    >
                      <p className="font-semibold text-slate-600">
                        {formatShortDate(day.date)}
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-[#0056b3]">
                        {formatBaht(day.totalSales)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {day.orderCount} บิล · รัฐ {formatBaht(day.subsidyUsed)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

        {/* TAB 7: FR-A03 & FR-AUTH-05 Admin Management */}
        {!isLoading && !error && activeTab === 'admins' && adminUsersData && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg">
              <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                {copy.admins.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {copy.admins.title}
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                {copy.admins.description}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  {copy.admins.currentAdminsTitle} (เปิดใช้งานอยู่{' '}
                  {adminUsersData.activeAdminCount} คน)
                </h3>
                <Activity className="size-4 text-[#0056b3]" />
              </div>

              <div className="mt-4 space-y-3">
                {adminUsersData.admins.map((admin) => {
                  const isActive = admin.adminRole?.status === 'ACTIVE';
                  const isLastActiveAdmin =
                    isActive && adminUsersData.activeAdminCount <= 1;
                  const isBusy = processingUserId === admin.userId;

                  return (
                    <div
                      key={admin.userId}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {admin.fullName}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({admin.citizenIdMasked})
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            ADMIN: {admin.adminRole?.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          บทบาททั้งหมด:{' '}
                          {admin.roles
                            .map((r) => `${r.role} (${r.status})`)
                            .join(', ')}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isBusy || isLastActiveAdmin}
                        onClick={() =>
                          void handleToggleAdminStatus(
                            admin.userId,
                            isActive ? 'SUSPENDED' : 'ACTIVE',
                          )
                        }
                        title={
                          isLastActiveAdmin
                            ? 'ไม่สามารถระงับผู้ดูแลระบบคนสุดท้ายที่เปิดใช้งานอยู่ได้'
                            : undefined
                        }
                        className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                          isActive
                            ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {isActive
                          ? copy.admins.suspendAdminBtn
                          : copy.admins.activateAdminBtn}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">
                {copy.admins.allUsersTitle}
              </h3>
              <div className="mt-4 space-y-3">
                {adminUsersData.users
                  .filter((u) => !u.adminRole)
                  .map((u) => (
                    <div
                      key={u.userId}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {u.fullName}{' '}
                          <span className="font-normal text-slate-500">
                            ({u.citizenIdMasked})
                          </span>
                        </p>
                        <p className="text-slate-500">
                          บทบาทปัจจุบัน:{' '}
                          {u.roles.map((r) => r.role).join(', ') || 'CONSUMER'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={processingUserId === u.userId}
                        onClick={() => void handleGrantAdmin(u.userId)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056b3] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#003d82] disabled:opacity-50"
                      >
                        <UserCheck className="size-3.5" />
                        {copy.admins.grantAdminBtn}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
