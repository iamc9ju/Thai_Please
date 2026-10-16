import { apiClient } from '../../../lib/api-client';
import type {
  ConsumerOverviewResponse,
  ConsumerQuestListResponse,
  OrderPreviewResponse,
  PaymentResultResponse,
  TopUpResponse,
  WalletTransactionHistoryQuery,
  WalletTransactionHistoryResponse,
} from '../consumer.types';

const WALLET_API_PATH = '/api/v1/wallet';
const QUEST_API_PATH = '/api/v1/quests';
const ORDER_API_PATH = '/api/v1/consumer/orders';

export function getConsumerQuests(
  cursor?: string,
  signal?: AbortSignal,
): Promise<ConsumerQuestListResponse> {
  const queryString = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const requestOptions: RequestInit = signal ? { signal } : {};
  return apiClient.get<ConsumerQuestListResponse>(
    `${QUEST_API_PATH}${queryString}`,
    requestOptions,
  );
}

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

export function getWalletTransactions(
  query: WalletTransactionHistoryQuery,
  signal?: AbortSignal,
): Promise<WalletTransactionHistoryResponse> {
  const searchParams = new URLSearchParams();
  if (query.dateFrom) searchParams.set('dateFrom', query.dateFrom);
  if (query.dateTo) searchParams.set('dateTo', query.dateTo);
  if (query.cursor) searchParams.set('cursor', query.cursor);
  if (query.limit !== undefined) {
    searchParams.set('limit', query.limit.toString());
  }
  const queryString = searchParams.toString();
  const requestOptions: RequestInit = signal ? { signal } : {};
  return apiClient.get<WalletTransactionHistoryResponse>(
    `${WALLET_API_PATH}/transactions${queryString ? `?${queryString}` : ''}`,
    requestOptions,
  );
}

export function previewOrder(data: {
  qrToken: string;
  userCouponId?: string | undefined;
}): Promise<OrderPreviewResponse> {
  return apiClient.post<OrderPreviewResponse>(`${ORDER_API_PATH}/preview`, data);
}

export function payByQr(data: {
  qrToken: string;
  userCouponId?: string | undefined;
  confirmationToken?: string | undefined;
}): Promise<PaymentResultResponse> {
  return apiClient.post<PaymentResultResponse>(`${ORDER_API_PATH}/pay`, data);
}

