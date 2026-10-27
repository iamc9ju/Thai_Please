import type { MerchantBusinessType } from '@thai-please/contracts';

export const LOGIN_ROLES = ['consumer', 'merchant', 'administrator'] as const;

export const API_AUTH_ROLES = ['CONSUMER', 'MERCHANT', 'ADMIN'] as const;

export type LoginRole = (typeof LOGIN_ROLES)[number];

export type ApiAuthRole = (typeof API_AUTH_ROLES)[number];

export type LoginCredentials = {
  citizenId: string;
  password: string;
};

export type AuthUser = {
  userId: string;
  citizenId: string;
  fullName: string;
  role: ApiAuthRole;
  activeMerchantId: string | null;
};

export type LoginResponse = {
  user: {
    fullName: string;
    role: ApiAuthRole;
  };
};

export type MeResponse = {
  user: AuthUser;
};

export type ApiErrorResponse = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export type RegisterConsumerPayload = {
  citizenId: string;
  title: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  homeNumber: string;
  village?: string | undefined;
  building?: string | undefined;
  floor?: string | undefined;
  room?: string | undefined;
  alley?: string | undefined;
  road?: string | undefined;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  password: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
};

export type RegisterMerchantPayload = RegisterConsumerPayload & {
  merchantName: string;
  merchantTypes: MerchantBusinessType[];
  taxId?: string | undefined;
  merchantPhone: string;
  merchantDescription: string;
  merchantAddress: string;
  merchantSubdistrict: string;
  merchantDistrict: string;
  merchantProvince: string;
  merchantPostalCode: string;
  acceptMerchantTerms: boolean;
};

export type RegisterConsumerResponse = {
  success: boolean;
  citizenId: string;
  fullName: string;
};

export type RegisterMerchantResponse = {
  success: boolean;
  merchantId: string;
  merchantName: string;
  merchantTypes: MerchantBusinessType[];
};
