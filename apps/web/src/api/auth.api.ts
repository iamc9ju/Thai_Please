import { apiClient } from '../lib/api-client';
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
} from '../types/auth.types';

export function login(role: LoginRole, credentials: LoginCredentials): Promise<LoginResponse> {
  const rolePath = role === 'administrator' ? 'admin' : role;
  return apiClient.post<LoginResponse>(`/api/auth/${rolePath}/login`, credentials);
}

export function registerConsumer(
  payload: RegisterConsumerPayload,
): Promise<RegisterConsumerResponse> {
  return apiClient.post<RegisterConsumerResponse>(
    '/api/auth/register/consumer',
    payload,
  );
}

export function registerMerchant(
  payload: RegisterMerchantPayload,
): Promise<RegisterMerchantResponse> {
  return apiClient.post<RegisterMerchantResponse>(
    '/api/auth/register/merchant',
    payload,
  );
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await apiClient.get<MeResponse>('/api/auth/me');
    return res.user;
  } catch {
    return null;
  }
}

export function logout(): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>('/api/auth/logout');
}

