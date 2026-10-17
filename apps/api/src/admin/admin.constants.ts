export const ADMIN_ROUTES = {
  overview: 'admin/overview',
  merchants: 'admin/merchants',
  approveMerchant: 'admin/merchants/:id/approve',
  rejectMerchant: 'admin/merchants/:id/reject',
  suspendMerchant: 'admin/merchants/:id/suspend',
  activateMerchant: 'admin/merchants/:id/activate',
  admins: 'admin/users/admins',
  grantAdminRole: 'admin/users/:userId/roles/admin',
  subsidyPrograms: 'admin/subsidy-programs',
  updateSubsidyProgram: 'admin/subsidy-programs/:id',
  generatePersonalizedQuest: 'admin/quests/generate-personalized',
  questGenerationLogs: 'admin/quest-generation-logs',
  rewardMonitoring: 'admin/rewards/monitoring',
  socialImpact: 'admin/dashboard/social-impact',
} as const;

export const MERCHANT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

export const PROGRAM_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'PAUSED',
  'ARCHIVED',
] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const ADMIN_ROLE_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AdminRoleStatus = (typeof ADMIN_ROLE_STATUSES)[number];

export const SOCIAL_IMPACT_DEFAULTS = {
  METRIC_VERSION: '1.0.0',
  REPORTING_TIMEZONE: 'Asia/Bangkok',
  DEFAULT_TREND_DAYS: 7,
  MIN_TREND_DAYS: 1,
  MAX_TREND_DAYS: 30,
  TOP_MERCHANTS_LIMIT: 10,
  RECENT_LOGS_LIMIT: 50,
} as const;
