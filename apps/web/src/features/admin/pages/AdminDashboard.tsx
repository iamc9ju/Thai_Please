import { useToast } from '../../../components/toast/ToastProvider';
import { ProgramList } from '../components/ProgramList';
import { AdminDirectoryList } from '../components/AdminDirectoryList';
import { QuestLogList } from '../components/QuestLogList';
import { RewardHistoryPages } from '../components/RewardHistoryPages';
import { MerchantSales } from '../components/MerchantSales';
import { CouponManager } from '../components/CouponManager';
import { formatTrendDate } from '../format-trend-date';
import {
  LoadingState,
  type LoadingStateVariant,
} from '../../../components/LoadingState';
import { useLatestRequest } from '../../../lib/use-latest-request';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
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
  Plus,
  RefreshCw,
  Store,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import {
  MERCHANT_BUSINESS_TYPES,
  type MerchantBusinessType,
} from '@thai-please/contracts';
import { AdminShell, type AdminTab } from '../components/AdminShell';
import '../admin.css';
import {
  MerchantActionDialog,
  type MerchantConfirmation,
} from '../components/MerchantActionDialog';
import { merchantActionsCopy } from '../merchant-actions.copy';
import { QuestGenerationDetails } from '../components/QuestGenerationDetails';
import { SubsidyProgramEditor } from '../components/SubsidyProgramEditor';
import { adminManagementCopy } from '../admin-management.copy';
import {
  createSubsidyProgram,
  createAdminCoupon,
  deleteAdminCoupon,
  getAdminCoupons,
  getAdminMerchants,
  getAdminUsersAndRoles,
  getPlatformOverview,
  getQuestGenerationLogs,
  getRewardMonitoring,
  getSocialImpactDashboard,
  getSubsidyPrograms,
  grantAdminRole,
  updateAdminRoleStatus,
  updateMerchantApprovalStatus,
  updateSubsidyProgramStatus,
  updateAdminCoupon,
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
  AdminCouponInput,
  AdminCouponItem,
  AdminCouponPage,
} from '../admin.types';

const UNSPECIFIED_MERCHANT_TYPE = '__UNSPECIFIED__';
const BUSINESS_TYPE_FILTER_PREFIX = 'business:';
const LEGACY_TYPE_FILTER_PREFIX = 'legacy:';
const loadingVariantByTab: Record<AdminTab, LoadingStateVariant> = {
  overview: 'dashboard',
  merchants: 'table',
  programs: 'cards',
  coupons: 'cards',
  quests: 'table',
  rewards: 'dashboard',
  socialImpact: 'dashboard',
  admins: 'table',
};

export interface AdminDashboardProps {
  adminName?: string | undefined;
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
    timeZone: 'Asia/Bangkok',
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
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* Quest generation control logic retained while the admin page is read-only.
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

*/
export function AdminDashboard({
  adminName = th.adminPortal.shell.defaultName,
  onLogout,
}: AdminDashboardProps) {
  const copy = th.adminPortal;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
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
  const [merchantSearch, setMerchantSearch] = useState('');
  const [merchantTypeFilter, setMerchantTypeFilter] = useState('');
  const merchantSearchQuery = merchantSearch.trim().toLocaleLowerCase('th-TH');
  const merchantTypeOptions = [
    ...MERCHANT_BUSINESS_TYPES.map((value) => ({
      value: `${BUSINESS_TYPE_FILTER_PREFIX}${value}`,
      label:
        th.registration.merchantTypes.find((option) => option.value === value)
          ?.label ?? value,
    })),
    ...[
      ...new Set(
        merchants.flatMap((merchant) =>
          merchant.merchantType &&
          !MERCHANT_BUSINESS_TYPES.includes(
            merchant.merchantType as MerchantBusinessType,
          )
            ? [merchant.merchantType]
            : [],
        ),
      ),
    ].map((value) => ({
      value: `${LEGACY_TYPE_FILTER_PREFIX}${value}`,
      label: value,
    })),
  ];
  const visibleMerchants = merchants.filter((merchant) => {
    const merchantTypes = merchant.merchantTypes ?? [];
    const typeMatches = !merchantTypeFilter
      ? true
      : merchantTypeFilter === UNSPECIFIED_MERCHANT_TYPE
        ? merchantTypes.length === 0 && !merchant.merchantType
        : merchantTypeFilter.startsWith(BUSINESS_TYPE_FILTER_PREFIX)
          ? merchantTypes.includes(
              merchantTypeFilter.slice(
                BUSINESS_TYPE_FILTER_PREFIX.length,
              ) as MerchantBusinessType,
            )
          : merchantTypeFilter.startsWith(LEGACY_TYPE_FILTER_PREFIX)
            ? merchant.merchantType ===
              merchantTypeFilter.slice(LEGACY_TYPE_FILTER_PREFIX.length)
            : false;
    const searchText = [
      merchant.merchantName,
      merchant.owner.fullName,
      merchant.phone,
      merchant.owner.phone,
      merchant.address,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th-TH');
    return (
      typeMatches &&
      (!merchantSearchQuery || searchText.includes(merchantSearchQuery))
    );
  });
  const [merchantActionReason, setMerchantActionReason] = useState<
    Record<string, string>
  >({});
  const [processingMerchantId, setProcessingMerchantId] = useState<
    string | null
  >(null);

  const [merchantConfirmation, setMerchantConfirmation] =
    useState<MerchantConfirmation | null>(null);
  const [isMerchantSubmitting, setIsMerchantSubmitting] = useState(false);
  const [merchantCompleted, setMerchantCompleted] = useState(0);
  const merchantSubmissionLock = useRef(false);

  const [programs, setPrograms] = useState<SubsidyProgramItem[]>([]);
  const [couponSearch, setCouponSearch] = useState('');
  const [coupons, setCoupons] = useState<AdminCouponItem[]>([]);
  const [couponPage, setCouponPage] = useState<AdminCouponPage | null>(null);
  const [isCouponSubmitting, setIsCouponSubmitting] = useState(false);
  const [newProgram, setNewProgram] = useState({
    programName: '',
    initialGrant: '',
    subsidyPercentage: '',
    dailySubsidyLimit: '',
    startDate: '',
    endDate: '',
  });
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [processingProgramId, setProcessingProgramId] = useState<string | null>(
    null,
  );

  const [questLogsData, setQuestLogsData] =
    useState<QuestGenerationLogsResponse | null>(null);
  /* Quest generation control logic retained while the admin page is read-only.
  const [selectedConsumerId, setSelectedConsumerId] = useState<string>('');
  const [consumerSegment, setConsumerSegment] = useState<
    'ALL_ELIGIBLE' | 'NO_ACTIVE_QUEST'
  >('ALL_ELIGIBLE');
  const selectableConsumers =
    questLogsData?.eligibleConsumers.filter(
      (consumer) =>
        consumerSegment === 'ALL_ELIGIBLE' || consumer.activeQuestsCount === 0,
    ) ?? [];
  const effectiveConsumerId = selectableConsumers.some(
    (consumer) => consumer.userId === selectedConsumerId,
  )
    ? selectedConsumerId
    : (selectableConsumers[0]?.userId ?? '');
  const selectedConsumerIsEligible = effectiveConsumerId !== '';
  const [isGeneratingQuest, setIsGeneratingQuest] = useState(false);
*/

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

  const beginRequest = useLatestRequest();
  const loadActiveTabData = useCallback(
    async (tab: AdminTab) => {
      const { isCurrent } = beginRequest();
      setIsLoading(true);
      setError(null);
      setIsForbidden(false);
      try {
        if (tab === 'overview') {
          const res = await getPlatformOverview();
          if (!isCurrent()) return;
          setOverview(res);
        } else if (tab === 'merchants') {
          const items = await getAdminMerchants(merchantFilter);
          if (!isCurrent()) return;
          setMerchants(items);
        } else if (tab === 'programs') {
          const items = await getSubsidyPrograms();
          if (!isCurrent()) return;
          setPrograms(items);
        } else if (tab === 'coupons') {
          const page = await getAdminCoupons(undefined, couponSearch);
          if (!isCurrent()) return;
          setCoupons(page.items);
          setCouponPage(page);
        } else if (tab === 'quests') {
          const res = await getQuestGenerationLogs();
          if (!isCurrent()) return;
          setQuestLogsData(res);
          /* Retained with the admin quest generation controls.
          setSelectedConsumerId((previous) =>
            res.eligibleConsumers.some(
              (consumer) => consumer.userId === previous,
            )
              ? previous
              : (res.eligibleConsumers[0]?.userId ?? ''),
          );
          */
        } else if (tab === 'rewards') {
          const res = await getRewardMonitoring();
          if (!isCurrent()) return;
          setRewardMonitoring(res);
        } else if (tab === 'socialImpact') {
          const res = await getSocialImpactDashboard(impactDays);
          if (!isCurrent()) return;
          setSocialImpact(res);
        } else if (tab === 'admins') {
          const res = await getAdminUsersAndRoles();
          if (!isCurrent()) return;
          setAdminUsersData(res);
        }
      } catch (err) {
        if (!isCurrent()) return;
        setIsForbidden(err instanceof ApiError && err.status === 403);
        setError(err instanceof Error ? err.message : copy.errorTitle);
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [beginRequest, copy.errorTitle, impactDays, merchantFilter, couponSearch],
  );

  const manageCoupon = async (
    action: 'create' | 'update' | 'delete',
    input?: AdminCouponInput,
    couponId?: string,
  ) => {
    setIsCouponSubmitting(true);
    try {
      if (action === 'create' && input) await createAdminCoupon(input);
      if (action === 'update' && input && couponId)
        await updateAdminCoupon(couponId, input);
      if (action === 'delete' && couponId) await deleteAdminCoupon(couponId);
      const page = await getAdminCoupons(undefined, couponSearch);
      setCoupons(page.items);
      setCouponPage(page);
      setActionBanner({
        type: 'success',
        message: th.adminPortal.coupons.saved,
      });
    } catch (err) {
      setActionBanner({
        type: 'error',
        message:
          err instanceof Error ? err.message : th.adminPortal.coupons.failed,
      });
      throw err;
    } finally {
      setIsCouponSubmitting(false);
    }
  };

  const loadNextCouponPage = async () => {
    if (!couponPage?.nextCursor || isCouponSubmitting) return;
    setIsCouponSubmitting(true);
    try {
      const page = await getAdminCoupons(couponPage.nextCursor, couponSearch);
      setCoupons((previous) => [...previous, ...page.items]);
      setCouponPage(page);
    } catch (err) {
      setActionBanner({
        type: 'error',
        message: err instanceof Error ? err.message : copy.errorTitle,
      });
    } finally {
      setIsCouponSubmitting(false);
    }
  };

  useEffect(() => {
    void loadActiveTabData(activeTab);
  }, [activeTab, loadActiveTabData]);

  const handleMerchantAction = async (
    merchantId: string,
    action: 'approve' | 'reject' | 'suspend' | 'activate',
  ) => {
    if (merchantSubmissionLock.current) return;
    merchantSubmissionLock.current = true;
    setIsMerchantSubmitting(true);
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
      merchantSubmissionLock.current = false;
      setIsMerchantSubmitting(false);
    }
  };

  const requestMerchantAction = (
    merchantId: string,
    action: 'approve' | 'reject' | 'suspend' | 'activate',
  ) => {
    if (merchantSubmissionLock.current) return;
    if (action === 'approve' || action === 'reject') {
      const merchant = merchants.find((item) => item.merchantId === merchantId);
      if (merchant)
        setMerchantConfirmation({
          action,
          bulk: false,
          merchants: [
            {
              merchantId: merchant.merchantId,
              merchantName: merchant.merchantName,
              status: merchant.status,
            },
          ],
        });
    } else {
      void handleMerchantAction(merchantId, action);
    }
  };

  const confirmMerchantAction = async () => {
    if (!merchantConfirmation || merchantSubmissionLock.current) return;
    const confirmation = merchantConfirmation;
    merchantSubmissionLock.current = true;
    setIsMerchantSubmitting(true);
    setMerchantCompleted(0);
    setActionBanner(null);
    let succeeded = 0;
    const failures: string[] = [];
    try {
      for (const [index, merchant] of confirmation.merchants.entries()) {
        try {
          const result = await updateMerchantApprovalStatus(
            merchant.merchantId,
            confirmation.action,
            merchantActionReason[merchant.merchantId]?.trim() || undefined,
            merchant.status,
          );
          succeeded += 1;
          setMerchants((previous) =>
            previous.flatMap((item) =>
              item.merchantId !== result.merchantId
                ? [item]
                : merchantFilter === 'PENDING'
                  ? []
                  : [
                      {
                        ...item,
                        status: result.status,
                        updatedAt: result.updatedAt,
                      },
                    ],
            ),
          );
        } catch (error) {
          failures.push(merchant.merchantName);
          if (
            error instanceof ApiError &&
            (error.status === 401 || error.status === 403)
          ) {
            failures.push(
              ...confirmation.merchants
                .slice(index + 1)
                .map((item) => item.merchantName),
            );
            break;
          }
        } finally {
          setMerchantCompleted(index + 1);
        }
      }
      let message = confirmation.bulk
        ? merchantActionsCopy.bulkResult(succeeded, failures)
        : succeeded > 0
          ? merchantActionsCopy.updated(
              confirmation.merchants[0]?.merchantName ?? '',
            )
          : merchantActionsCopy.failed;
      try {
        setMerchants(await getAdminMerchants(merchantFilter));
      } catch {
        message += ` · ${merchantActionsCopy.refreshFailed}`;
      }
      setActionBanner({
        type: failures.length > 0 ? 'error' : 'success',
        message,
      });
    } finally {
      setMerchantConfirmation(null);
      merchantSubmissionLock.current = false;
      setIsMerchantSubmitting(false);
    }
  };

  const handleCreateProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newProgram.programName.trim() || isSavingProgram) return;
    if (newProgram.startDate > newProgram.endDate) {
      showToast({
        type: 'warning',
        title: adminManagementCopy.programCreateRejected,
        description: adminManagementCopy.dateOrder,
      });
      setActionBanner(null);
      return;
    }
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
      const message =
        err instanceof Error
          ? err.message
          : adminManagementCopy.programCreateFailed;
      setActionBanner(null);
      showToast({
        type: 'warning',
        title: adminManagementCopy.programCreateRejected,
        description: message,
      });
    } finally {
      setIsSavingProgram(false);
    }
  };

  const handleProgramStatusChange = async (
    programId: string,
    status: ProgramStatus,
  ) => {
    if (processingProgramId !== null) return;
    setProcessingProgramId(programId);
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
    } finally {
      setProcessingProgramId(null);
    }
  };

  /* Quest generation control logic retained while the admin page is read-only.
  const handleTriggerQuestGeneration = async () => {
    if (!selectedConsumerIsEligible || isGeneratingQuest) return;
    setIsGeneratingQuest(true);
    setActionBanner(null);
    try {
      const result = await triggerQuestGeneration(
        effectiveConsumerId,
        createUuidV4(),
      );
      setActionBanner({
        type: result.status === 'FAILED' ? 'error' : 'success',
        message: th.adminPortal.questProposalStatus[result.status],
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

*/
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
    <AdminShell
      activeTab={activeTab}
      adminName={adminName}
      isLoading={isLoading}
      onNavigate={(tab) => {
        setActionBanner(null);
        setActiveTab(tab);
      }}
      onRefresh={() => {
        setActionBanner(null);
        void loadActiveTabData(activeTab);
      }}
      onLogout={onLogout}
    >
      <div className="space-y-6">
        {merchantConfirmation && (
          <MerchantActionDialog
            confirmation={merchantConfirmation}
            busy={isMerchantSubmitting}
            completed={merchantCompleted}
            onConfirm={() => void confirmMerchantAction()}
            onCancel={() => {
              if (!merchantSubmissionLock.current)
                setMerchantConfirmation(null);
            }}
          />
        )}
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
          <LoadingState
            label={copy.loading}
            variant={loadingVariantByTab[activeTab]}
          />
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          >
            <AlertCircle className="mx-auto mb-3 size-10 text-red-600" />
            <h2 className="text-base font-bold text-red-900">
              {isForbidden ? copy.shell.forbiddenTitle : copy.errorTitle}
            </h2>
            <p className="mt-1 text-sm text-red-700">
              {isForbidden ? copy.shell.forbiddenDescription : error}
            </p>
            <button
              type="button"
              onClick={() => void loadActiveTabData(activeTab)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              <RefreshCw className="size-4" />
              {copy.retry}
            </button>
          </div>
        ) : null}

        {/* TAB 1: FR-A01 Platform Overview */}
        {!isLoading && !error && activeTab === 'overview' && overview && (
          <section className="space-y-6">
            <div className="admin-section-hero">
              <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
                {copy.shell.overviewBadge}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {copy.shell.welcome}
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                {copy.shell.welcomeDescription}
              </p>
            </div>

            <div className="admin-overview-toolbar">
              <h3>{copy.shell.quickActions}</h3>
              <span>
                <Clock size={14} aria-hidden="true" />
                {copy.shell.updatedAt} {formatDateTime(overview.asOf)}
              </span>
            </div>
            <div className="admin-shortcuts">
              <button type="button" onClick={() => setActiveTab('merchants')}>
                <span className="admin-shortcut-icon">
                  <Store aria-hidden="true" />
                </span>
                <span>
                  <strong>{copy.shell.merchantAction}</strong>
                  <small>{copy.shell.merchantActionDescription}</small>
                </span>
                <span className="admin-count">
                  {overview.merchants.pending.toLocaleString('th-TH')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('socialImpact')}
              >
                <span className="admin-shortcut-icon">
                  <TrendingUp aria-hidden="true" />
                </span>
                <span>
                  <strong>{copy.shell.impactAction}</strong>
                  <small>{copy.shell.impactActionDescription}</small>
                </span>
                <BarChart3 size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {copy.overview.usersCard}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-brand">
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
                <p className="mt-3 text-2xl font-extrabold text-brand">
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
                  <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-brand">
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

            {!overview.activeProgram && (
              <div
                role="status"
                className="rounded-2xl border border-dashed border-line bg-panel p-6 text-sm text-muted"
              >
                {copy.shell.noProgram}
              </div>
            )}
            {overview.activeProgram && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-white">
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
                      <p className="font-bold text-brand">
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
            <div className="admin-section-hero">
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

            <div className="grid gap-4 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-2">
              <label
                className="text-xs font-semibold"
                htmlFor="merchant-search"
              >
                {merchantActionsCopy.searchLabel}
                <input
                  id="merchant-search"
                  type="search"
                  value={merchantSearch}
                  onChange={(event) => setMerchantSearch(event.target.value)}
                  disabled={isMerchantSubmitting}
                  placeholder={merchantActionsCopy.searchPlaceholder}
                  className="mt-2 w-full rounded-xl border border-line px-3 py-2.5 text-sm"
                />
              </label>
              <label
                className="text-xs font-semibold"
                htmlFor="merchant-type-filter"
              >
                {merchantActionsCopy.typeLabel}
                <select
                  id="merchant-type-filter"
                  value={merchantTypeFilter}
                  onChange={(event) =>
                    setMerchantTypeFilter(event.target.value)
                  }
                  disabled={isMerchantSubmitting}
                  className="mt-2 w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm"
                >
                  <option value="">{merchantActionsCopy.allTypes}</option>
                  {merchantTypeOptions.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                  <option value={UNSPECIFIED_MERCHANT_TYPE}>
                    {merchantActionsCopy.unknownType}
                  </option>
                </select>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                <p role="status" className="text-xs text-muted">
                  {merchantActionsCopy.searchResult(
                    visibleMerchants.length,
                    merchants.length,
                  )}
                </p>
                {(merchantSearch || merchantTypeFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMerchantSearch('');
                      setMerchantTypeFilter('');
                    }}
                    disabled={isMerchantSubmitting}
                    className="text-xs font-semibold text-brand-strong underline"
                  >
                    {merchantActionsCopy.clearFilters}
                  </button>
                )}
              </div>
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
                  aria-pressed={merchantFilter === filter.key}
                  disabled={isMerchantSubmitting}
                  onClick={() => setMerchantFilter(filter.key)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                    merchantFilter === filter.key
                      ? 'bg-brand text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {(merchantFilter === 'ALL' || merchantFilter === 'PENDING') && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4">
                <p className="text-sm font-semibold">
                  {merchantActionsCopy.total(
                    visibleMerchants.filter(
                      (merchant) => merchant.status === 'PENDING',
                    ).length,
                  )}
                </p>
                <button
                  type="button"
                  disabled={
                    isMerchantSubmitting ||
                    !visibleMerchants.some(
                      (merchant) => merchant.status === 'PENDING',
                    )
                  }
                  onClick={() =>
                    setMerchantConfirmation({
                      action: 'approve',
                      bulk: true,
                      merchants: visibleMerchants
                        .filter((merchant) => merchant.status === 'PENDING')
                        .map((merchant) => ({
                          merchantId: merchant.merchantId,
                          merchantName: merchant.merchantName,
                          status: merchant.status,
                        })),
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {merchantActionsCopy.approveAll}
                </button>
              </div>
            )}
            {visibleMerchants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                {merchants.length === 0
                  ? copy.merchants.empty
                  : merchantActionsCopy.noMatches}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {visibleMerchants.map((merchant) => {
                  const isBusy =
                    isMerchantSubmitting ||
                    processingMerchantId === merchant.merchantId;
                  return (
                    <div
                      key={merchant.merchantId}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Building2 className="size-4 text-brand" />
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
                          <p className="text-xs text-muted">
                            {merchantActionsCopy.typeLabel}:{' '}
                            {merchant.merchantType ||
                              merchantActionsCopy.unknownType}
                          </p>
                          {merchant.description && (
                            <p className="text-xs text-slate-600">
                              {merchant.description}
                            </p>
                          )}
                          {(merchant.merchantTypes?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {merchant.merchantTypes.map((merchantType) => (
                                <span
                                  key={merchantType}
                                  className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#0056b3]"
                                >
                                  {th.registration.merchantTypes.find(
                                    (option) => option.value === merchantType,
                                  )?.label ?? merchantType}
                                </span>
                              ))}
                            </div>
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
                            <p className="font-bold text-brand">
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
                          aria-label={`${merchantActionsCopy.reasonLabel} ${merchant.merchantName}`}
                          disabled={isMerchantSubmitting}
                          maxLength={500}
                          value={
                            merchantActionReason[merchant.merchantId] ?? ''
                          }
                          onChange={(e) =>
                            setMerchantActionReason((prev) => ({
                              ...prev,
                              [merchant.merchantId]: e.target.value,
                            }))
                          }
                          placeholder={merchantActionsCopy.reasonPlaceholder}
                          className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-brand focus:outline-none"
                        />

                        <div className="flex flex-wrap gap-2">
                          {merchant.status !== 'ACTIVE' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                requestMerchantAction(
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
                                requestMerchantAction(
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
                                requestMerchantAction(
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

        {!error && activeTab === 'coupons' && (
          <CouponManager
            items={coupons}
            onSearchChange={setCouponSearch}
            busy={isCouponSubmitting}
            onCreate={(input) => manageCoupon('create', input)}
            onUpdate={(couponId, input) =>
              manageCoupon('update', input, couponId)
            }
            onDelete={(couponId) => manageCoupon('delete', undefined, couponId)}
            hasMore={couponPage?.nextCursor !== null}
            onLoadMore={() => void loadNextCouponPage()}
          />
        )}

        {/* TAB 3: FR-A04 Subsidy Program Management */}
        {!isLoading && !error && activeTab === 'programs' && (
          <section className="space-y-6">
            <div className="admin-section-hero">
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
                  <Plus className="size-5 text-brand" />
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
                    placeholder={copy.programs.programNameLabel}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>

                <p className="text-xs text-muted">
                  {adminManagementCopy.supportedPolicy}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-50"
                >
                  {copy.programs.createBtn}
                </button>
              </form>

              <div className="space-y-4 lg:col-span-7">
                <h3 className="text-base font-bold text-slate-900">
                  {copy.programs.listTitle}
                </h3>
                <ProgramList programs={programs}>
                  {(program) => (
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
                              disabled={processingProgramId !== null}
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
                              disabled={processingProgramId !== null}
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
                          <p className="font-bold text-brand">
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
                      <SubsidyProgramEditor
                        program={program}
                        onSaved={(updated) =>
                          setPrograms((previous) =>
                            previous.map((item) =>
                              item.programId === updated.programId
                                ? updated
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                </ProgramList>
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: FR-A05 & FR-S04 AI Quest Generation & Logs */}
        {!isLoading && !error && activeTab === 'quests' && questLogsData && (
          <section className="space-y-6">
            <div className="admin-section-hero">
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

            {/* Admin quest generation controls retained for future restoration.
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-brand" />
                <h3 className="text-base font-bold text-slate-900">
                  {copy.quests.generateCardTitle}
                </h3>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div className="w-full">
                  <label
                    htmlFor="quest-consumer-segment"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {adminManagementCopy.segment}
                  </label>
                  <select
                    id="quest-consumer-segment"
                    value={consumerSegment}
                    disabled={isGeneratingQuest}
                    onChange={(event) => {
                      const segment =
                        event.target.value === 'NO_ACTIVE_QUEST'
                          ? 'NO_ACTIVE_QUEST'
                          : 'ALL_ELIGIBLE';
                      setConsumerSegment(segment);
                      const available = questLogsData.eligibleConsumers.filter(
                        (consumer) =>
                          segment === 'ALL_ELIGIBLE' ||
                          consumer.activeQuestsCount === 0,
                      );
                      setSelectedConsumerId(available[0]?.userId ?? '');
                    }}
                    className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm"
                  >
                    <option value="ALL_ELIGIBLE">
                      {adminManagementCopy.allEligible}
                    </option>
                    <option value="NO_ACTIVE_QUEST">
                      {adminManagementCopy.noActiveQuest}
                    </option>
                  </select>
                  <p className="mt-2 text-xs text-muted">
                    {adminManagementCopy.segmentHint}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="select-consumer-quest"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {copy.quests.selectConsumerLabel}
                  </label>
                  <select
                    id="select-consumer-quest"
                    value={effectiveConsumerId}
                    disabled={
                      isGeneratingQuest || selectableConsumers.length === 0
                    }
                    onChange={(e) => setSelectedConsumerId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
                  >
                    {selectableConsumers.length === 0 && (
                      <option value="">{adminManagementCopy.noRecords}</option>
                    )}
                    {selectableConsumers.map((consumer) => (
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
                  disabled={!selectedConsumerIsEligible || isGeneratingQuest}
                  onClick={() => void handleTriggerQuestGeneration()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-50"
                >
                  <Sparkles className="size-4" />
                  {isGeneratingQuest
                    ? copy.quests.generatingBtn
                    : copy.quests.generateBtn}
                </button>
              </div>
            </div>

            */}
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
                  <QuestLogList logs={questLogsData.logs}>
                    {(log) => (
                      <div
                        key={log.generationId}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
                                Log #{log.generationId}
                              </span>

                              <span className="text-xs font-semibold text-slate-700">
                                ผู้รับภารกิจ: {log.user.fullName} (
                                {log.user.citizenIdMasked})
                              </span>
                            </div>
                            {log.quest && (
                              <p className="mt-1.5 text-sm font-bold text-slate-900">
                                {log.quest.questName} (+{log.quest.rewardPoint}{' '}
                                พอยต์ · ขั้นต่ำ {formatBaht(log.quest.minSpend)}
                                )
                              </p>
                            )}
                            {log.selectionReason && (
                              <p className="mt-1 text-xs text-slate-600">
                                เหตุผลการคัดเลือก: {log.selectionReason}
                              </p>
                            )}
                            {(log.proposals?.length ?? 0) > 0 && (
                              <div className="mt-2 text-xs text-slate-700">
                                <p className="font-semibold">
                                  {copy.questAudit.proposals}
                                </p>
                                <ul>
                                  {log.proposals?.map((proposal) => (
                                    <li key={proposal.id}>
                                      {proposal.type} ·{' '}
                                      {proposal.targetId
                                        ? `${copy.questAudit.category} ${proposal.targetId}`
                                        : copy.questAudit.allCategories}
                                      {' · '}
                                      {copy.questAudit.personalTarget}:{' '}
                                      {formatBaht(
                                        Number(proposal.minimumSpendMinor) /
                                          100,
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(log.validation?.attempts.length ?? 0) > 0 && (
                              <details className="mt-2 text-xs text-slate-600">
                                <summary>{copy.questAudit.validation}</summary>
                                {log.validation?.attempts.map((attempt) => (
                                  <p key={attempt.call}>
                                    {copy.questAudit.call} {attempt.call}:{' '}
                                    {copy.questAudit.accepted}{' '}
                                    {attempt.acceptedCount}
                                    {' · '}
                                    {attempt.rejections.join(', ') ||
                                      copy.questAudit.noRejections}
                                  </p>
                                ))}
                                {(log.validation?.rejections.length ?? 0) >
                                  0 && (
                                  <p>{log.validation?.rejections.join(', ')}</p>
                                )}
                              </details>
                            )}
                          </div>

                          <div className="text-right text-xs text-slate-500">
                            <p>
                              Provider:{' '}
                              <strong>
                                {log.provider ??
                                  adminManagementCopy.notRecorded}
                              </strong>{' '}
                              (
                              {log.modelVersion ??
                                adminManagementCopy.notRecorded}
                              )
                            </p>
                            <p>
                              Prompt{' '}
                              {log.promptVersion ??
                                adminManagementCopy.notRecorded}{' '}
                              · Policy{' '}
                              {log.policyVersion ??
                                adminManagementCopy.notRecorded}
                            </p>
                            <p>{formatDateTime(log.generatedAt)}</p>
                          </div>
                        </div>
                        <QuestGenerationDetails log={log} />
                      </div>
                    )}
                  </QuestLogList>
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
              <div className="admin-section-hero">
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

              <p className="text-xs text-muted">
                {adminManagementCopy.rewardPeriodHint}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    อัตราทำภารกิจสำเร็จ (Quest Completion)
                  </span>
                  <p className="mt-2 text-2xl font-extrabold text-brand">
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
                    aria-pressed={rewardSubTab === t.key}
                    onClick={() => setRewardSubTab(t.key)}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                      rewardSubTab === t.key
                        ? 'bg-brand text-white shadow-sm'
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
                    {rewardMonitoring.recentQuestAssignments.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted">
                        {adminManagementCopy.noRecords}
                      </p>
                    )}
                    <RewardHistoryPages key="quests">
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
                            {item.completedAt && (
                              <p className="text-muted">
                                {adminManagementCopy.completedAt}:{' '}
                                {formatDateTime(item.completedAt)}
                              </p>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-semibold ${
                              item.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : item.status === 'EXPIRED'
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-blue-50 text-brand'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </RewardHistoryPages>
                  </div>
                </div>
              )}

              {rewardSubTab === 'points' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="space-y-3">
                    {rewardMonitoring.recentPointTransactions.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted">
                        {adminManagementCopy.noRecords}
                      </p>
                    )}
                    <RewardHistoryPages key="points">
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
                            <p className="text-muted">
                              {adminManagementCopy.expiresAt}:{' '}
                              {pt.expiresAt
                                ? formatDateTime(pt.expiresAt)
                                : adminManagementCopy.noExpiry}
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
                    </RewardHistoryPages>
                  </div>
                </div>
              )}

              {rewardSubTab === 'coupons' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="space-y-3">
                    {rewardMonitoring.recentCouponRedemptions.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted">
                        {adminManagementCopy.noRecords}
                      </p>
                    )}
                    <RewardHistoryPages key="coupons">
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
                            {uc.usedAt && (
                              <p className="text-muted">
                                {adminManagementCopy.usedAt}:{' '}
                                {formatDateTime(uc.usedAt)}
                              </p>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-semibold ${
                              uc.status === 'USED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : uc.status === 'EXPIRED'
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-blue-50 text-brand'
                            }`}
                          >
                            {uc.status}
                          </span>
                        </div>
                      ))}
                    </RewardHistoryPages>
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
              <div className="flex flex-wrap items-center justify-between gap-4 admin-section-hero">
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
                      aria-pressed={impactDays === item.days}
                      onClick={() => setImpactDays(item.days)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        impactDays === item.days
                          ? 'bg-white text-brand'
                          : 'text-blue-100 hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted">
                {adminManagementCopy.impactPeriodHint}
              </p>
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
                  <p className="mt-2 text-2xl font-extrabold text-brand">
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
                <MerchantSales
                  merchants={socialImpact.salesByMerchant}
                  days={impactDays}
                />

                {/* Sales by Category */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
                  <h3 className="text-base font-bold text-slate-900">
                    {copy.socialImpact.salesByCategoryTitle}
                  </h3>
                  <p className="mt-2 text-xs text-muted">
                    {adminManagementCopy.categoryGrossHint}
                  </p>
                  <div className="mt-4 space-y-4">
                    {socialImpact.salesByCategory.length === 0 && (
                      <p className="py-6 text-sm text-muted">
                        {adminManagementCopy.noRecords}
                      </p>
                    )}
                    {socialImpact.salesByCategory.map((cat) => (
                      <div key={cat.categoryId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">
                            {cat.categoryName} ({cat.itemCount} ชิ้น)
                          </span>
                          <span className="font-semibold text-brand">
                            {formatBaht(cat.totalSales)} ({cat.sharePercentage}
                            %)
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{
                              width: `${Math.min(100, Math.max(0, cat.sharePercentage))}%`,
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
                        {formatTrendDate(day.date)}
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-brand">
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
            <div className="admin-section-hero">
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
                <Activity className="size-4 text-brand" />
              </div>

              <div className="mt-4 space-y-3">
                <AdminDirectoryList
                  items={adminUsersData.admins}
                  label={copy.admins.currentAdminsTitle}
                >
                  {(admin) => {
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
                  }}
                </AdminDirectoryList>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">
                {copy.admins.allUsersTitle}
              </h3>
              <div className="mt-4 space-y-3">
                <AdminDirectoryList
                  items={adminUsersData.users.filter((u) => !u.adminRole)}
                  label={copy.admins.allUsersTitle}
                >
                  {(u) => (
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
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
                      >
                        <UserCheck className="size-3.5" />
                        {copy.admins.grantAdminBtn}
                      </button>
                    </div>
                  )}
                </AdminDirectoryList>
              </div>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
