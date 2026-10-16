import { apiClient } from '../../../lib/api-client';
import type {
  ConsumerOverviewResponse,
  ConsumerQuestListResponse,
  ConsumerSubsidyStatusResponse,
  OrderPreviewResponse,
  PaymentResultResponse,
  TopUpResponse,
  WalletTransactionHistoryQuery,
  WalletTransactionHistoryResponse,
} from '../consumer.types';

const WALLET_API_PATH = '/api/v1/wallet';
const QUEST_API_PATH = '/api/v1/quests';
const ORDER_API_PATH = '/api/v1/consumer/orders';
const INVALID_SUBSIDY_RESPONSE_MESSAGE = 'Invalid subsidy status response';
const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;

function invalidSubsidyResponse(): never {
  throw new Error(INVALID_SUBSIDY_RESPONSE_MESSAGE);
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function property(value: object, key: string): unknown {
  return Reflect.get(value, key);
}

function parseNonNegativeMoney(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return invalidSubsidyResponse();
  }

  const minorUnits = Math.round(value * 100);
  if (
    !Number.isSafeInteger(minorUnits) ||
    !/^\d+(?:\.\d{1,2})?$/.test(value.toString())
  ) {
    return invalidSubsidyResponse();
  }

  return value;
}

function moneyToMinorUnits(value: number): number {
  return Math.round(value * 100);
}

function parseNonEmptyString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return invalidSubsidyResponse();
  }
  return value;
}

function parsePercentage(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    return invalidSubsidyResponse();
  }
  return value;
}

function parseDate(value: unknown, requireTimestamp = false): string {
  const date = parseNonEmptyString(value);
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match || (requireTimestamp && !date.includes('T'))) {
    return invalidSubsidyResponse();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > lastDay ||
    !Number.isFinite(Date.parse(date))
  ) {
    return invalidSubsidyResponse();
  }
  return date;
}

export function parseConsumerSubsidyStatus(
  value: unknown,
): ConsumerSubsidyStatusResponse {
  if (!isObject(value)) return invalidSubsidyResponse();

  const currency = property(value, 'currency');
  const timeZone = property(value, 'timeZone');
  if (currency !== 'THB' || timeZone !== 'Asia/Bangkok') {
    return invalidSubsidyResponse();
  }

  const asOf = parseDate(property(value, 'asOf'), true);
  const subsidyBalance = parseNonNegativeMoney(
    property(value, 'subsidyBalance'),
  );
  const dailySubsidyLimit = parseNonNegativeMoney(
    property(value, 'dailySubsidyLimit'),
  );
  const dailySubsidyUsed = parseNonNegativeMoney(
    property(value, 'dailySubsidyUsed'),
  );
  const dailySubsidyRemaining = parseNonNegativeMoney(
    property(value, 'dailySubsidyRemaining'),
  );

  if (
    moneyToMinorUnits(dailySubsidyRemaining) !==
    Math.max(
      0,
      moneyToMinorUnits(dailySubsidyLimit) -
        moneyToMinorUnits(dailySubsidyUsed),
    )
  ) {
    return invalidSubsidyResponse();
  }

  const rawProgram = property(value, 'program');
  let program: ConsumerSubsidyStatusResponse['program'] = null;
  if (rawProgram !== null) {
    if (!isObject(rawProgram)) return invalidSubsidyResponse();

    const programId = parseNonEmptyString(property(rawProgram, 'programId'));
    const programName = parseNonEmptyString(
      property(rawProgram, 'programName'),
    );
    const subsidyPercentage = parsePercentage(
      property(rawProgram, 'subsidyPercentage'),
    );
    const startDate = parseDate(property(rawProgram, 'startDate'));
    const endDate = parseDate(property(rawProgram, 'endDate'));

    if (Date.parse(startDate) > Date.parse(endDate)) {
      return invalidSubsidyResponse();
    }

    program = {
      programId,
      programName,
      subsidyPercentage,
      startDate,
      endDate,
    };
  }

  return {
    currency,
    timeZone,
    asOf,
    subsidyBalance,
    dailySubsidyLimit,
    dailySubsidyUsed,
    dailySubsidyRemaining,
    program,
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

export function getConsumerOverview(): Promise<ConsumerOverviewResponse> {
  return apiClient.get<ConsumerOverviewResponse>(`${WALLET_API_PATH}/overview`);
}

export async function getConsumerSubsidyStatus(): Promise<ConsumerSubsidyStatusResponse> {
  const response = await apiClient.get<unknown>(`${WALLET_API_PATH}/subsidy`);
  return parseConsumerSubsidyStatus(response);
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
