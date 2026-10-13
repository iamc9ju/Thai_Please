import { apiClient } from '../../../lib/api-client';
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  LoginRole,
  MeResponse,
  RegisterConsumerPayload,
  RegisterConsumerResponse,
  RegisterMerchantPayload,
  RegisterMerchantResponse,
} from '../auth.types';

const AUTH_API_PATH = '/api/v1/auth';
const USERS_API_PATH = '/api/v1/users';

export function login(
  role: LoginRole,
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const rolePath = role === 'administrator' ? 'admin' : role;
  return apiClient.post<LoginResponse>(
    `${AUTH_API_PATH}/${rolePath}/login`,
    credentials,
  );
}

export function registerConsumer(
  payload: RegisterConsumerPayload,
): Promise<RegisterConsumerResponse> {
  return apiClient.post<RegisterConsumerResponse>(
    `${AUTH_API_PATH}/register/customer`,
    payload,
  );
}

export function registerMerchant(
  payload: RegisterMerchantPayload,
): Promise<RegisterMerchantResponse> {
  return apiClient.post<RegisterMerchantResponse>(
    `${AUTH_API_PATH}/register/merchant`,
    payload,
  );
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await apiClient.get<MeResponse>(`${USERS_API_PATH}/me`);
    return res.user;
  } catch {
    return null;
  }
}

export function logout(): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`${AUTH_API_PATH}/logout`);
}
