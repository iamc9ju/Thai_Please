export const API_VERSION = '1' as const;

export const CONSUMER_PROFILE_PATH = '/api/v1/users/me/profile';
export type ConsumerProfileResponse = {
  fullName: string;
  maskedCitizenId: string;
  role: 'CONSUMER';
  phone: string | null;
  address: string | null;
};

export const CONSUMER_QUEST_ASSIGNMENT_PATH =
  '/api/v1/consumer/quests/:assignmentId' as const;
export const QUEST_CANCELLATION_PATH_SUFFIX = 'cancellation' as const;
export const QUEST_CANCEL_PATH_SUFFIX = 'cancel' as const;
export const USER_CANCELLED_QUEST_REASON = 'USER_CANCELLED' as const;

export type ConsumerQuestCancellationPreview = {
  assignmentId: string;
  nextEligibleAt: string;
};

export type ConsumerQuestCancellationResponse =
  ConsumerQuestCancellationPreview & {
    status: 'CANCELLED';
  };

export type HealthStatus = 'error' | 'ok' | 'shutting_down';

export type HealthResponse = {
  status: HealthStatus;
  details?: Readonly<Record<string, { status: string }>>;
};

export const MERCHANT_BUSINESS_TYPES = [
  'FOOD_BEVERAGE',
  'RESTAURANT',
  'MADE_TO_ORDER',
  'THAI_CUISINE',
  'ISAN_CUISINE',
  'HALAL_FOOD',
  'BEVERAGE_SHOP',
  'DESSERT_BAKERY',
  'OTOP',
  'GENERAL_GOODS',
  'COMMUNITY_ENTERPRISE',
  'VILLAGE_COMMUNITY_FUND',
  'PUBLIC_TRANSPORT',
  'SMALL_LEGAL_ENTITY',
  'OTHER',
] as const;

export type MerchantBusinessType = (typeof MERCHANT_BUSINESS_TYPES)[number];

const merchantBusinessTypeSet: ReadonlySet<string> = new Set(
  MERCHANT_BUSINESS_TYPES,
);

export function isMerchantBusinessType(
  value: string,
): value is MerchantBusinessType {
  return merchantBusinessTypeSet.has(value);
}
