export const LOGIN_ROLES = ['consumer', 'merchant', 'administrator'] as const;

export type LoginRole = (typeof LOGIN_ROLES)[number];

export type LoginCredentials = {
  citizenId: string;
  password: string;
};

export type AuthUser = {
  userId: string;
  citizenId: string;
  fullName: string;
  role: string;
  activeMerchantId: string | null;
};

export type LoginResponse = {
  user: {
    fullName: string;
    role: string;
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
