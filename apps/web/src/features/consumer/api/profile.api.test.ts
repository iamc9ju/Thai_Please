import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSUMER_PROFILE_PATH } from '@thai-please/contracts';
import { apiClient } from '../../../lib/api-client';
import { getConsumerProfile } from './profile.api';
vi.mock('../../../lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
const read = vi.mocked(apiClient.get);
const profile = {
  fullName: 'fixture',
  maskedCitizenId: 'X-XXXX-1234',
  role: 'CONSUMER',
  phone: null,
  address: null,
};
beforeEach(() => read.mockReset());
describe('FR-C01 profile contract', () => {
  it('uses the self route and forwards cancellation', async () => {
    read.mockResolvedValue(profile);
    const signal = new AbortController().signal;
    expect(await getConsumerProfile(signal)).toEqual(profile);
    expect(read).toHaveBeenCalledWith(CONSUMER_PROFILE_PATH, { signal });
  });
  it.each([
    null,
    {},
    { ...profile, role: 'ADMIN' },
    { ...profile, phone: 123 },
  ])('rejects invalid responses', async (value) => {
    read.mockResolvedValue(value);
    await expect(getConsumerProfile()).rejects.toThrow(
      'PROFILE_RESPONSE_INVALID',
    );
  });
});
