import { apiClient } from '../../../lib/api-client';
import type {
  ConsumerOverviewResponse,
  TopUpResponse,
} from '../consumer.types';

const WALLET_API_PATH = '/api/v1/wallet';

export function getConsumerOverview(): Promise<ConsumerOverviewResponse> {
  return apiClient.get<ConsumerOverviewResponse>(`${WALLET_API_PATH}/overview`);
}

export function topUpPersonalWallet(
  amount: number,
  idempotencyKey: string,
): Promise<TopUpResponse> {
  return apiClient.post<TopUpResponse>(`${WALLET_API_PATH}/topup`, {
    amount,
    idempotencyKey,
  });
}
