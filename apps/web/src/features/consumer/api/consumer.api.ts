import { apiClient } from '../../../lib/api-client';
import { getSessionGeneration } from '../../auth/session-scope';
import type {
  ConsumerOverviewResponse,
  TopUpResponse,
  WalletTransactionHistoryQuery,
  WalletTransactionHistoryResponse,
} from '../consumer.types';

const WALLET_API_PATH = '/api/v1/wallet';

type OverviewRequest = {
  generation: number;
  promise: Promise<ConsumerOverviewResponse>;
};

let overviewRequest: OverviewRequest | null = null;
const walletTransactionRequests = new Map<
  string,
  Promise<WalletTransactionHistoryResponse>
>();

export function invalidateConsumerOverviewRequest() {
  overviewRequest = null;
}

export function invalidateWalletTransactionRequests() {
  walletTransactionRequests.clear();
}

export function getConsumerOverview(options?: {
  forceRefresh?: boolean;
}): Promise<ConsumerOverviewResponse> {
  const generation = getSessionGeneration();
  if (!options?.forceRefresh && overviewRequest?.generation === generation) {
    return overviewRequest.promise;
  }

  const promise = apiClient.get<ConsumerOverviewResponse>(
    `${WALLET_API_PATH}/overview`,
  );
  const request = { generation, promise };
  overviewRequest = request;
  const clearRequest = () => {
    if (overviewRequest === request) overviewRequest = null;
  };
  void promise.then(clearRequest, clearRequest);
  return promise;
}

export function topUpPersonalWallet(
  amount: number,
  idempotencyKey: string,
): Promise<TopUpResponse> {
  return apiClient
    .post<TopUpResponse>(`${WALLET_API_PATH}/topup`, {
      amount,
      idempotencyKey,
    })
    .then((response) => {
      invalidateConsumerOverviewRequest();
      invalidateWalletTransactionRequests();
      return response;
    });
}

function abortedRequest() {
  return new DOMException('The request was aborted.', 'AbortError');
}

function subscribeToRequest<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortedRequest());

  return new Promise<T>((resolve, reject) => {
    const stopListening = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      stopListening();
      reject(abortedRequest());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then(
      (value) => {
        stopListening();
        resolve(value);
      },
      (error: unknown) => {
        stopListening();
        reject(error);
      },
    );
  });
}

export function getWalletTransactions(
  query: WalletTransactionHistoryQuery,
  signal?: AbortSignal,
): Promise<WalletTransactionHistoryResponse> {
  if (signal?.aborted) return Promise.reject(abortedRequest());

  const searchParams = new URLSearchParams();
  if (query.dateFrom) searchParams.set('dateFrom', query.dateFrom);
  if (query.dateTo) searchParams.set('dateTo', query.dateTo);
  if (query.cursor) searchParams.set('cursor', query.cursor);
  if (query.limit !== undefined) {
    searchParams.set('limit', query.limit.toString());
  }
  const queryString = searchParams.toString();
  const path = `${WALLET_API_PATH}/transactions${queryString ? `?${queryString}` : ''}`;
  const requestKey = `${getSessionGeneration()}:${path}`;
  let request = walletTransactionRequests.get(requestKey);
  if (!request) {
    request = apiClient.get<WalletTransactionHistoryResponse>(path);
    walletTransactionRequests.set(requestKey, request);
    const clearRequest = () => {
      if (walletTransactionRequests.get(requestKey) === request) {
        walletTransactionRequests.delete(requestKey);
      }
    };
    void request.then(clearRequest, clearRequest);
  }

  return subscribeToRequest(request, signal);
}
