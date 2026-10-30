import type { MerchantBusinessType } from '@thai-please/contracts';

export type MerchantStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export type AdminRoleStatus = 'ACTIVE' | 'SUSPENDED';
export type ProgramStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface PlatformOverviewResponse {
  users: {
    total: number;
    consumers: number;
    merchants: number;
    admins: number;
  };
  merchants: {
    total: number;
    active: number;
    pending: number;
    rejected: number;
    suspended: number;
  };
  orders: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalFinalSpend: number;
    totalSubsidyUsed: number;
    totalPersonalPaid: number;
    totalDiscount: number;
  };
  points: {
    totalCurrentBalance: number;
    totalIssued: number;
    totalRedeemed: number;
    totalExpired: number;
  };
  coupons: {
    catalogueCount: number;
    totalIssued: number;
    availableCount: number;
    usedCount: number;
    expiredCount: number;
  };
  quests: {
    templatesCount: number;
    totalAssigned: number;
    activeCount: number;
    completedCount: number;
    expiredCount: number;
  };
  activeProgram: {
    programId: string;
    programName: string;
    initialGrant: number;
    subsidyPercentage: number;
    dailySubsidyLimit: number;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  asOf: string;
}

export interface AdminMerchantItem {
  merchantId: string;
  merchantName: string;
  merchantTypes: MerchantBusinessType[];
  description: string | null;
  address: string | null;
  phone: string | null;
  status: MerchantStatus;
  owner: {
    userId: string;
    fullName: string;
    citizenIdMasked: string;
    phone: string | null;
  };
  walletBalance: number;
  walletStatus: string;
  productCount: number;
  paidOrderCount: number;
  totalSales: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMerchantStatusResult {
  merchantId: string;
  merchantName: string;
  previousStatus: string;
  status: MerchantStatus;
  updatedAt: string;
  audit: {
    event: string;
    actorAdminId: string;
    merchantId: string;
    merchantName: string;
    previousStatus: string;
    newStatus: MerchantStatus;
    reason: string | null;
    occurredAt: string;
  };
}

export interface AdminUserItem {
  userId: string;
  fullName: string;
  citizenIdMasked: string;
  phone: string | null;
  status: string;
  pointBalance: number;
  lastLoginAt: string | null;
  createdAt: string;
  roles: {
    userRoleId: string;
    role: string;
    status: string;
    createdByAdminId: string | null;
    createdByAdminName: string | null;
    createdAt: string;
  }[];
  adminRole: {
    userRoleId: string;
    status: AdminRoleStatus;
    createdByAdminId: string | null;
    createdByAdminName: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface AdminUsersListResponse {
  admins: AdminUserItem[];
  users: AdminUserItem[];
  activeAdminCount: number;
}

export interface SubsidyProgramItem {
  programId: string;
  programName: string;
  initialGrant: number;
  subsidyPercentage: number;
  userPercentage: number;
  dailySubsidyLimit: number;
  currency: string;
  timezone: string;
  startDate: string;
  endDate: string;
  status: ProgramStatus;
  createdAt: string;
  walletCount?: number;
  orderCount?: number;
  walletTransactionCount?: number;
}

export interface CreateSubsidyProgramInput {
  programName: string;
  initialGrant: number;
  subsidyPercentage: number;
  dailySubsidyLimit: number;
  startDate: string;
  endDate: string;
  status?: ProgramStatus;
}

export interface QuestGenerationLogItem {
  proposal?: {
    questId: string;
    questName: string;
    questType: string;
    minSpend: number;
    rewardPoint: number;
    durationDays: number;
  } | null;
  candidates?: Array<{
    questName: string;
    questType: string;
    minSpend: number;
    rewardPoint: number;
  }>;
  validationResult?: {
    status: 'ACCEPTED' | 'NOT_RECORDED';
    evidence: 'ASSIGNED_QUEST_RULE' | 'NO_RECORDED_VALIDATION';
  };
  proposals?: {
    id: string;
    type: 'MIN_SPEND' | 'CATEGORY_SPEND';
    targetId: string | null;
    minimumSpendMinor: string;
  }[];
  validation?: {
    attempts: { call: number; acceptedCount: number; rejections: string[] }[];
    rejections: string[];
  };
  generationId: string;
  requestKey: string | null;
  status: string;
  provider: string | null;
  modelVersion: string | null;
  promptVersion: string | null;
  policyVersion: string | null;
  selectionReason: string | null;
  reservedPoints: number;
  generatedAt: string;
  finishedAt: string | null;
  user: {
    userId: string;
    fullName: string;
    citizenIdMasked: string;
  };
  actor: {
    userId: string;
    fullName: string;
  } | null;
  quest: {
    questId: string;
    questName: string;
    questType: string;
    rewardPoint: number;
    minSpend: number;
    durationDays: number;
  } | null;
  assignment: {
    userQuestId: string;
    status: string;
    expiresAt: string;
    completedAt: string | null;
  } | null;
}

export interface EligibleConsumerItem {
  userId: string;
  fullName: string;
  citizenIdMasked: string;
  pointBalance: number;
  paidOrdersCount: number;
  activeQuestsCount: number;
}

export interface QuestGenerationLogsResponse {
  logs: QuestGenerationLogItem[];
  eligibleConsumers: EligibleConsumerItem[];
}

export interface RewardMonitoringResponse {
  summary: {
    questsAssigned: number;
    questsActive: number;
    questsCompleted: number;
    questsExpired: number;
    questCompletionRate: number;
    pointsIssued: number;
    pointsRedeemed: number;
    pointsExpired: number;
    currentPointLiability: number;
    couponsCatalogueCount: number;
    couponsIssued: number;
    couponsAvailable: number;
    couponsUsed: number;
    couponsExpired: number;
    couponUsageRate: number;
  };
  recentQuestAssignments: {
    userQuestId: string;
    userId: string;
    userFullName: string;
    questId: string;
    questName: string;
    questType: string;
    rewardPoint: number;
    minSpend: number;
    status: string;
    assignedAt: string;
    expiresAt: string;
    completedAt: string | null;
    completedOrderId: string | null;
  }[];
  recentPointTransactions: {
    pointTransactionId: string;
    userId: string;
    userFullName: string;
    transactionType: string;
    points: number;
    sourceName: string;
    createdAt: string;
    expiresAt: string | null;
  }[];
  recentCouponRedemptions: {
    userCouponId: string;
    userId: string;
    userFullName: string;
    couponId: string;
    couponName: string;
    discountType: string;
    discountValue: number;
    pointCost: number;
    status: string;
    redeemedAt: string;
    expiresAt: string;
    usedAt: string | null;
    usedOrderId: string | null;
  }[];
  asOf: string;
}

export interface SocialImpactDashboardResponse {
  activeConsumers: number;
  participatingMerchants: number;
  successfulOrders: number;
  totalFinalSpend: number;
  totalSubsidyUsed: number;
  totalPersonalPaid: number;
  totalDiscountGiven: number;
  averageSalesPerMerchant: number;
  questsAssigned: number;
  questsCompleted: number;
  questCompletionRate: number;
  pointsIssued: number;
  pointsRedeemed: number;
  couponsIssued: number;
  couponsUsed: number;
  couponUsageRate: number;
  salesByMerchant: {
    merchantId: string;
    merchantName: string;
    orderCount: number;
    totalSales: number;
    subsidyUsed: number;
    personalPaid: number;
  }[];
  salesByCategory: {
    categoryId: string;
    categoryName: string;
    itemCount: number;
    totalSales: number;
    sharePercentage: number;
  }[];
  dailyTrend: {
    date: string;
    orderCount: number;
    totalSales: number;
    subsidyUsed: number;
    personalPaid: number;
  }[];
  metricVersion: string;
  reportingTimezone: string;
  asOf: string;
}
