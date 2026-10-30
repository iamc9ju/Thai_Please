import { th } from '../../../i18n/th';
import { apiClient } from '../../../lib/api-client';
import type { ConsumerQuestProposalsResponse } from '../../consumer/consumer.types';
import type {
  AdminMerchantItem,
  AdminMerchantStatusResult,
  AdminRoleStatus,
  MerchantStatus,
  AdminUsersListResponse,
  CreateSubsidyProgramInput,
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

const ADMIN_API_BASE = '/api/v1/admin';

export const ADMIN_API_ROUTES = {
  overview: `${ADMIN_API_BASE}/overview`,
  merchants: `${ADMIN_API_BASE}/merchants`,
  admins: `${ADMIN_API_BASE}/users/admins`,
  subsidyPrograms: `${ADMIN_API_BASE}/subsidy-programs`,
  generateQuest: `${ADMIN_API_BASE}/quests/generate-personalized`,
  questGenerationLogs: `${ADMIN_API_BASE}/quest-generation-logs`,
  rewardMonitoring: `${ADMIN_API_BASE}/rewards/monitoring`,
  socialImpact: `${ADMIN_API_BASE}/dashboard/social-impact`,
  coupons: `${ADMIN_API_BASE}/coupons`,
} as const;

export function getAdminCoupons(
  before?: string,
  search?: string,
): Promise<AdminCouponPage> {
  return apiClient.get<AdminCouponPage>(
    `${ADMIN_API_ROUTES.coupons}?${new URLSearchParams({ ...(before ? { before } : {}), ...(search ? { search } : {}) })}`,
  );
}
async function couponMutation<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof Error) {
      const entry = Object.entries(th.adminPortal.coupons.errors).find(
        ([code]) => code === error.message,
      );
      if (entry) throw new Error(entry[1]);
    }
    throw error;
  }
}
export function createAdminCoupon(
  input: AdminCouponInput,
): Promise<AdminCouponItem> {
  return couponMutation(apiClient.post(ADMIN_API_ROUTES.coupons, input));
}
export function updateAdminCoupon(
  couponId: string,
  input: AdminCouponInput,
): Promise<AdminCouponItem> {
  return couponMutation(
    apiClient.patch(`${ADMIN_API_ROUTES.coupons}/${couponId}`, input),
  );
}
export function deleteAdminCoupon(couponId: string): Promise<void> {
  return couponMutation(
    apiClient.delete(`${ADMIN_API_ROUTES.coupons}/${couponId}`),
  );
}

export function updateSubsidyProgram(
  programId: string,
  input: CreateSubsidyProgramInput,
): Promise<SubsidyProgramItem> {
  return apiClient.patch(
    `${ADMIN_API_ROUTES.subsidyPrograms}/${programId}`,
    input,
  );
}

export function getPlatformOverview(): Promise<PlatformOverviewResponse> {
  return apiClient.get<PlatformOverviewResponse>(ADMIN_API_ROUTES.overview);
}

export async function getAdminMerchants(
  status?: string,
): Promise<AdminMerchantItem[]> {
  const query = status && status !== 'ALL' ? `?status=${status}` : '';
  const response = await apiClient.get<{ items: AdminMerchantItem[] }>(
    `${ADMIN_API_ROUTES.merchants}${query}`,
  );
  return response.items;
}

export function updateMerchantApprovalStatus(
  merchantId: string,
  action: 'approve' | 'reject' | 'suspend' | 'activate',
  reason?: string,
  expectedStatus?: MerchantStatus,
): Promise<AdminMerchantStatusResult> {
  return apiClient.post<AdminMerchantStatusResult>(
    `${ADMIN_API_ROUTES.merchants}/${merchantId}/${action}`,
    {
      ...(reason ? { reason } : {}),
      ...(expectedStatus ? { expectedStatus } : {}),
    },
  );
}

export function getAdminUsersAndRoles(): Promise<AdminUsersListResponse> {
  return apiClient.get<AdminUsersListResponse>(ADMIN_API_ROUTES.admins);
}

export function grantAdminRole(userId: string): Promise<{
  userRoleId: string;
  userId: string;
  fullName: string;
  role: string;
  status: AdminRoleStatus;
}> {
  return apiClient.post(`${ADMIN_API_BASE}/users/${userId}/roles/admin`, {});
}

export function updateAdminRoleStatus(
  userId: string,
  status: AdminRoleStatus,
): Promise<{
  userRoleId: string;
  userId: string;
  fullName: string;
  role: string;
  status: AdminRoleStatus;
}> {
  return apiClient.patch(`${ADMIN_API_BASE}/users/${userId}/roles/admin`, {
    status,
  });
}

export async function getSubsidyPrograms(): Promise<SubsidyProgramItem[]> {
  const response = await apiClient.get<{ items: SubsidyProgramItem[] }>(
    ADMIN_API_ROUTES.subsidyPrograms,
  );
  return response.items;
}

export function createSubsidyProgram(
  input: CreateSubsidyProgramInput,
): Promise<SubsidyProgramItem> {
  return apiClient.post<SubsidyProgramItem>(
    ADMIN_API_ROUTES.subsidyPrograms,
    input,
  );
}

export function updateSubsidyProgramStatus(
  programId: string,
  status: ProgramStatus,
): Promise<SubsidyProgramItem> {
  return apiClient.patch<SubsidyProgramItem>(
    `${ADMIN_API_ROUTES.subsidyPrograms}/${programId}`,
    { status },
  );
}

export function getQuestGenerationLogs(): Promise<QuestGenerationLogsResponse> {
  return apiClient.get<QuestGenerationLogsResponse>(
    ADMIN_API_ROUTES.questGenerationLogs,
  );
}

export function triggerQuestGeneration(
  userId: string,
  idempotencyKey: string,
): Promise<ConsumerQuestProposalsResponse> {
  return apiClient.post(ADMIN_API_ROUTES.generateQuest, {
    userId,
    idempotencyKey,
  });
}

export function getRewardMonitoring(): Promise<RewardMonitoringResponse> {
  return apiClient.get<RewardMonitoringResponse>(
    ADMIN_API_ROUTES.rewardMonitoring,
  );
}

export function getSocialImpactDashboard(
  days = 7,
): Promise<SocialImpactDashboardResponse> {
  return apiClient.get<SocialImpactDashboardResponse>(
    `${ADMIN_API_ROUTES.socialImpact}?days=${days}`,
  );
}
