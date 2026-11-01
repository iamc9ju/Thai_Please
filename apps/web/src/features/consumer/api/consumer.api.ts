import { apiClient } from '../../../lib/api-client';
import type {
  ConsumerCouponsResponse,
  ConsumerOrder,
  ConsumerOverviewResponse,
  ConsumerPointsResponse,
  ConsumerQuestListResponse,
  ConsumerQuestProposal,
  ConsumerQuestProposalsResponse,
  ConsumerQuestSelectionResponse,
  OrderPreviewResponse,
  PaymentResultResponse,
  ReceiptDetail,
  RedeemCouponResponse,
  TopUpResponse,
  WalletTransactionHistoryQuery,
  WalletTransactionHistoryResponse,
} from '../consumer.types';

const WALLET_API_PATH = '/api/v1/wallet';
const QUEST_API_PATH = '/api/v1/consumer/quests';
const QUEST_PROPOSALS_API_PATH = `${QUEST_API_PATH}/proposals`;
const ORDER_API_PATH = '/api/v1/consumer/orders';
const POINTS_API_PATH = '/api/v1/consumer/points';
const COUPONS_API_PATH = '/api/v1/consumer/coupons';

const PROPOSAL_STATUSES = new Set([
  'READY',
  'PENDING',
  'COOLDOWN',
  'ELIGIBLE',
  'FAILED',
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function nullableTimestamp(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && Number.isFinite(Date.parse(value)))
  );
}

function parseProposals(value: unknown): ConsumerQuestProposalsResponse {
  if (
    !record(value) ||
    typeof value.status !== 'string' ||
    !PROPOSAL_STATUSES.has(value.status) ||
    !nullableText(value.requestKey) ||
    !nullableTimestamp(value.expiresAt) ||
    !nullableTimestamp(value.nextEligibleAt) ||
    !nullableText(value.reason) ||
    !Array.isArray(value.items) ||
    value.items.length > 3
  ) {
    throw new Error('QUEST_PROPOSALS_RESPONSE_INVALID');
  }
  const items = value.items.map((item: unknown): ConsumerQuestProposal => {
    if (
      !record(item) ||
      typeof item.id !== 'string' ||
      !item.id ||
      (item.type !== 'MIN_SPEND' && item.type !== 'CATEGORY_SPEND') ||
      !nullableText(item.targetCategoryId) ||
      !nullableText(item.targetCategoryName) ||
      (item.type === 'MIN_SPEND' && item.targetCategoryId !== null) ||
      (item.type === 'CATEGORY_SPEND' && !item.targetCategoryId) ||
      typeof item.minimumSpend !== 'string' ||
      !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(item.minimumSpend) ||
      Number(item.minimumSpend) <= 0 ||
      typeof item.rewardPoints !== 'number' ||
      !Number.isSafeInteger(item.rewardPoints) ||
      item.rewardPoints <= 0 ||
      typeof item.durationDays !== 'number' ||
      !Number.isSafeInteger(item.durationDays) ||
      item.durationDays <= 0
    ) {
      throw new Error('QUEST_PROPOSALS_RESPONSE_INVALID');
    }
    return {
      id: item.id,
      type: item.type,
      targetCategoryId: item.targetCategoryId,
      targetCategoryName: item.targetCategoryName,
      minimumSpend: item.minimumSpend,
      rewardPoints: item.rewardPoints,
      durationDays: item.durationDays,
    };
  });
  if (
    (value.status === 'READY' &&
      (!value.requestKey || !value.expiresAt || items.length === 0)) ||
    new Set(items.map((item) => item.id)).size !== items.length
  ) {
    throw new Error('QUEST_PROPOSALS_RESPONSE_INVALID');
  }
  // The status check above narrows the finite server states explicitly.
  switch (value.status) {
    case 'READY':
    case 'PENDING':
    case 'COOLDOWN':
    case 'ELIGIBLE':
    case 'FAILED':
      return {
        status: value.status,
        requestKey: value.requestKey,
        expiresAt: value.expiresAt,
        nextEligibleAt: value.nextEligibleAt,
        reason: value.reason,
        items,
      };
    default:
      throw new Error('QUEST_PROPOSALS_RESPONSE_INVALID');
  }
}

export async function getConsumerQuestProposals(
  signal?: AbortSignal,
): Promise<ConsumerQuestProposalsResponse> {
  return parseProposals(
    await apiClient.get<unknown>(
      QUEST_PROPOSALS_API_PATH,
      signal ? { signal } : {},
    ),
  );
}

export async function createConsumerQuestProposals(
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ConsumerQuestProposalsResponse> {
  return parseProposals(
    await apiClient.post<unknown>(
      QUEST_PROPOSALS_API_PATH,
      { idempotencyKey },
      signal ? { signal } : {},
    ),
  );
}

export async function selectConsumerQuestProposal(
  requestKey: string,
  proposalId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ConsumerQuestSelectionResponse> {
  const result = await apiClient.post<unknown>(
    `${QUEST_PROPOSALS_API_PATH}/${encodeURIComponent(requestKey)}/select`,
    { proposalId, idempotencyKey },
    signal ? { signal } : {},
  );
  if (
    !record(result) ||
    typeof result.assignmentId !== 'string' ||
    !result.assignmentId ||
    typeof result.nextEligibleAt !== 'string' ||
    !Number.isFinite(Date.parse(result.nextEligibleAt))
  ) {
    throw new Error('QUEST_SELECTION_RESPONSE_INVALID');
  }
  return {
    assignmentId: result.assignmentId,
    nextEligibleAt: result.nextEligibleAt,
  };
}

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

export function getConsumerPoints(
  signal?: AbortSignal,
): Promise<ConsumerPointsResponse> {
  const requestOptions: RequestInit = signal ? { signal } : {};
  return apiClient.get<ConsumerPointsResponse>(POINTS_API_PATH, requestOptions);
}

export function getConsumerCoupons(
  signal?: AbortSignal,
): Promise<ConsumerCouponsResponse> {
  const requestOptions: RequestInit = signal ? { signal } : {};
  return apiClient.get<ConsumerCouponsResponse>(
    COUPONS_API_PATH,
    requestOptions,
  );
}

export function redeemConsumerCoupon(
  couponId: string,
): Promise<RedeemCouponResponse> {
  return apiClient.post<RedeemCouponResponse>(
    `${COUPONS_API_PATH}/${encodeURIComponent(couponId)}/redeem`,
    {},
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
  return apiClient.post<OrderPreviewResponse>(
    `${ORDER_API_PATH}/preview`,
    data,
  );
}

export function payByQr(data: {
  qrToken: string;
  userCouponId?: string | undefined;
  confirmationToken?: string | undefined;
}): Promise<PaymentResultResponse> {
  return apiClient.post<PaymentResultResponse>(`${ORDER_API_PATH}/pay`, data);
}

export function getConsumerOrders(
  filter?: { dateFrom?: string | undefined; dateTo?: string | undefined },
  signal?: AbortSignal,
): Promise<ConsumerOrder[]> {
  const searchParams = new URLSearchParams();
  if (filter?.dateFrom) searchParams.set('dateFrom', filter.dateFrom);
  if (filter?.dateTo) searchParams.set('dateTo', filter.dateTo);
  const queryString = searchParams.toString();
  const requestOptions: RequestInit = signal ? { signal } : {};
  return apiClient.get<ConsumerOrder[]>(
    `${ORDER_API_PATH}${queryString ? `?${queryString}` : ''}`,
    requestOptions,
  );
}

export function getOrderReceipt(
  orderId: string,
  signal?: AbortSignal,
): Promise<ReceiptDetail> {
  const requestOptions: RequestInit = signal ? { signal } : {};
  return apiClient.get<ReceiptDetail>(
    `${ORDER_API_PATH}/${encodeURIComponent(orderId)}/receipt`,
    requestOptions,
  );
}
