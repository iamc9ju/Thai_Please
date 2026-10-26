import { cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import { invalidateSessionScope } from '../session-scope';
import type { MeResponse } from '../auth.types';
import { useAuth } from '../use-auth';
import { AuthProvider } from './AuthProvider';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

function AuthProbe() {
  const { isLoading, user } = useAuth();
  if (isLoading) return <p>loading</p>;
  return <p>{user?.fullName ?? 'anonymous'}</p>;
}

beforeEach(() => {
  invalidateSessionScope();
  mockedGet.mockReset();
});

afterEach(cleanup);

describe('AuthProvider request lifecycle', () => {
  it('requests the current user once under React StrictMode', async () => {
    let resolveMe!: (value: MeResponse) => void;
    mockedGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );

    render(
      <StrictMode>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </StrictMode>,
    );

    expect(mockedGet).toHaveBeenCalledTimes(1);
    resolveMe({
      user: {
        userId: 'user-1',
        citizenId: '1100000000001',
        fullName: 'ผู้ใช้ทดสอบ',
        role: 'CONSUMER',
        activeMerchantId: null,
      },
    });

    expect(await screen.findByText('ผู้ใช้ทดสอบ')).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});
