import { apiClient } from '../../../lib/api-client';
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
} as const;

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
): Promise<{
  generationId: string;
  assignmentId: string;
  questId: string;
  title: string;
  description: string;
  rewardPoints: number;
  expiresAt: string;
}> {
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
