export const API_VERSION = '1' as const;

export const CONSUMER_PROFILE_PATH = '/api/v1/users/me/profile';
export type ConsumerProfileResponse = {
  fullName: string;
  maskedCitizenId: string;
  role: 'CONSUMER';
  phone: string | null;
  address: string | null;
};

export type HealthStatus = 'error' | 'ok' | 'shutting_down';

export type HealthResponse = {
  status: HealthStatus;
  details?: Readonly<Record<string, { status: string }>>;
};

export const MERCHANT_BUSINESS_TYPES = [
  'FOOD_BEVERAGE',
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
