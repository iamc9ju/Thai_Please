import {
  CONSUMER_PROFILE_PATH,
  type ConsumerProfileResponse,
} from '@thai-please/contracts';
import { apiClient } from '../../../lib/api-client';
export async function getConsumerProfile(
  signal?: AbortSignal,
): Promise<ConsumerProfileResponse> {
  const value = await apiClient.get<unknown>(
    CONSUMER_PROFILE_PATH,
    signal ? { signal } : {},
  );
  if (
    typeof value !== 'object' ||
    value === null ||
    !('fullName' in value) ||
    typeof value.fullName !== 'string' ||
    !('maskedCitizenId' in value) ||
    typeof value.maskedCitizenId !== 'string' ||
    !('role' in value) ||
    value.role !== 'CONSUMER' ||
    !('phone' in value) ||
    !(value.phone === null || typeof value.phone === 'string') ||
    !('address' in value) ||
    !(value.address === null || typeof value.address === 'string')
  )
    throw new Error('PROFILE_RESPONSE_INVALID');
  return {
    fullName: value.fullName,
    maskedCitizenId: value.maskedCitizenId,
    role: value.role,
    phone: value.phone,
    address: value.address,
  };
}
