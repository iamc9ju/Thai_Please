export const LOGIN_ROLES = ['consumer', 'merchant', 'administrator'] as const;

export type LoginRole = (typeof LOGIN_ROLES)[number];

export type LoginCredentials = {
  citizenId: string;
  password: string;
};

export type AuthUser = {
  fullName: string;
  role: string;
};

export type LoginResponse = {
  user: AuthUser;
};

export type ApiErrorResponse = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};
