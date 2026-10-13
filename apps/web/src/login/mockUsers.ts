import type { LoginRole } from './login.types';

type MockUser = Readonly<{
  citizenId: string;
  password: string;
}>;

const env = import.meta.env;

export const mockUsers = {
  consumer: {
    citizenId: env.VITE_MOCK_CONSUMER_CITIZEN_ID ?? '',
    password: env.VITE_MOCK_CONSUMER_PASSWORD ?? '',
  },
  merchant: {
    citizenId: env.VITE_MOCK_MERCHANT_CITIZEN_ID ?? '',
    password: env.VITE_MOCK_MERCHANT_PASSWORD ?? '',
  },
  administrator: {
    citizenId: env.VITE_MOCK_ADMINISTRATOR_CITIZEN_ID ?? '',
    password: env.VITE_MOCK_ADMINISTRATOR_PASSWORD ?? '',
  },
} as const satisfies Record<LoginRole, MockUser>;

export const mockAuthIsAvailable =
  import.meta.env.DEV &&
  env.VITE_MOCK_AUTH_ENABLED === 'true' &&
  Object.values(mockUsers).every(
    (user) => user.citizenId.length === 13 && user.password.length > 0,
  );

export function authenticateMockUser(
  role: LoginRole,
  citizenId: string,
  password: string,
) {
  if (!mockAuthIsAvailable) {
    return false;
  }

  const expectedUser = mockUsers[role];
  return (
    citizenId === expectedUser.citizenId && password === expectedUser.password
  );
}
