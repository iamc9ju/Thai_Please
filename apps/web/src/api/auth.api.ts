import { apiClient } from '../lib/api-client';
import type { LoginCredentials, LoginResponse, LoginRole } from '../types/auth.types';

export function login(role: LoginRole, credentials: LoginCredentials): Promise<LoginResponse> {
  const rolePath = role === 'administrator' ? 'admin' : role;
  return apiClient.post<LoginResponse>(`/api/auth/${rolePath}/login`, credentials);
}
