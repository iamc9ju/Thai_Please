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
import { getSessionGeneration, invalidateSessionScope } from '../session-scope';

const AUTH_API_PATH = '/api/v1/auth';
const USERS_API_PATH = '/api/v1/users';

type MeRequest = {
  generation: number;
  promise: Promise<AuthUser | null>;
};

let meRequest: MeRequest | null = null;

export async function login(
  role: LoginRole,
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const rolePath = role === 'administrator' ? 'admin' : role;
  const response = await apiClient.post<LoginResponse>(
    `${AUTH_API_PATH}/${rolePath}/login`,
    credentials,
  );
  invalidateSessionScope();
  return response;
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

export function getMe(): Promise<AuthUser | null> {
  const generation = getSessionGeneration();
  if (meRequest?.generation === generation) {
    return meRequest.promise;
  }

  const promise = apiClient
    .get<MeResponse>(`${USERS_API_PATH}/me`)
    .then((response) => response.user)
    .catch(() => null);
  const request = { generation, promise };
  meRequest = request;
  const clearRequest = () => {
    if (meRequest === request) meRequest = null;
  };
  void promise.then(clearRequest, clearRequest);
  return promise;
}

export async function logout(): Promise<{ success: boolean }> {
  try {
    return await apiClient.post<{ success: boolean }>(
      `${AUTH_API_PATH}/logout`,
    );
  } finally {
    invalidateSessionScope();
  }
}
