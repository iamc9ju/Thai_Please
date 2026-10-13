import { apiClient } from '../lib/api-client';
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  LoginRole,
  MeResponse,
} from '../types/auth.types';

export function login(role: LoginRole, credentials: LoginCredentials): Promise<LoginResponse> {
  const rolePath = role === 'administrator' ? 'admin' : role;
  return apiClient.post<LoginResponse>(`/api/auth/${rolePath}/login`, credentials);
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
