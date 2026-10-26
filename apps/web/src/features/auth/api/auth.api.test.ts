import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import type { AuthUser, MeResponse } from '../auth.types';
import { invalidateSessionScope } from '../session-scope';
import { getMe, login } from './auth.api';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

const userFixture: AuthUser = {
  userId: 'user-1',
  citizenId: '1100000000001',
  fullName: 'ผู้ใช้ทดสอบ',
  role: 'CONSUMER',
  activeMerchantId: null,
};

beforeEach(() => {
  invalidateSessionScope();
  mockedGet.mockReset();
  mockedPost.mockReset();
});

describe('auth request lifecycle', () => {
  it('deduplicates only the same in-flight current-user request', async () => {
    let resolveMe!: (value: MeResponse) => void;
    mockedGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );

    const first = getMe();
    const second = getMe();

    expect(second).toBe(first);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    resolveMe({ user: userFixture });
    await Promise.all([first, second]);

    mockedGet.mockResolvedValueOnce({ user: userFixture });
    await getMe();
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('does not reuse an old current-user request after login changes session', async () => {
    mockedGet.mockReturnValueOnce(new Promise(() => undefined));
    void getMe();
    mockedPost.mockResolvedValueOnce({
      user: { fullName: userFixture.fullName, role: userFixture.role },
    });

    await login('consumer', {
      citizenId: userFixture.citizenId,
      password: 'test-password',
    });
    mockedGet.mockResolvedValueOnce({ user: userFixture });
    await getMe();

    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});
