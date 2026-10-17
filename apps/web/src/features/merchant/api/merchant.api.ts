import { apiClient } from '../../../lib/api-client';
import type {
  Category,
  CreateOrderResponse,
  MerchantDashboardData,
  MerchantOrder,
  MerchantWalletOverview,
  MerchantWalletTransactionsPage,
  MerchantWithdrawalResult,
  OrderPreview,
  PaymentResult,
  Product,
} from '../merchant.types';
import type { ReceiptDetail } from '../../consumer/consumer.types';

const MERCHANT_API = '/api/v1/merchant';
const CATALOG_API = '/api/v1/catalog';
const CONSUMER_API = '/api/v1/consumer';

// ── Catalog ──────────────────────────────────────────────────────────────────

export function getCategories(): Promise<Category[]> {
  return apiClient.get<Category[]>(`${CATALOG_API}/categories`);
}

export function getMyProducts(): Promise<Product[]> {
  return apiClient.get<Product[]>(`${MERCHANT_API}/products`);
}

export function createProduct(data: {
  productName: string;
  price: number;
  categoryId: number;
  description?: string;
}): Promise<Product> {
  return apiClient.post<Product>(`${MERCHANT_API}/products`, data);
}

// ── Orders ───────────────────────────────────────────────────────────────────

export function createOrder(data: {
  items: Array<{ productId: number; quantity: number }>;
  userCouponId?: string;
}): Promise<CreateOrderResponse> {
  return apiClient.post<CreateOrderResponse>(`${MERCHANT_API}/orders`, data);
}

export function getMerchantOrders(): Promise<MerchantOrder[]> {
  return apiClient.get<MerchantOrder[]>(`${MERCHANT_API}/orders`);
}

export function getMerchantOrderReceipt(
  orderId: string,
): Promise<ReceiptDetail> {
  return apiClient.get<ReceiptDetail>(
    `${MERCHANT_API}/orders/${encodeURIComponent(orderId)}/receipt`,
  );
}

// ── FR-M06: Merchant Wallet & Withdrawal ─────────────────────────────────────

export function getMerchantWalletOverview(): Promise<MerchantWalletOverview> {
  return apiClient.get<MerchantWalletOverview>(`${MERCHANT_API}/wallet`);
}

export function getMerchantWalletTransactions(params?: {
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}): Promise<MerchantWalletTransactionsPage> {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();
  return apiClient.get<MerchantWalletTransactionsPage>(
    `${MERCHANT_API}/wallet/transactions${query ? `?${query}` : ''}`,
  );
}

export function withdrawMerchantWallet(data: {
  amount: number;
  idempotencyKey: string;
}): Promise<MerchantWithdrawalResult> {
  return apiClient.post<MerchantWithdrawalResult>(
    `${MERCHANT_API}/wallet/withdrawals`,
    data,
  );
}

// ── FR-M07: Merchant Analytics Dashboard ─────────────────────────────────────

export function getMerchantDashboard(days = 7): Promise<MerchantDashboardData> {
  return apiClient.get<MerchantDashboardData>(
    `${MERCHANT_API}/dashboard?days=${encodeURIComponent(String(days))}`,
  );
}

// ── Consumer QR Payment ───────────────────────────────────────────────────────

export function previewOrder(data: {
  qrToken: string;
  userCouponId?: string;
}): Promise<OrderPreview> {
  return apiClient.post<OrderPreview>(`${CONSUMER_API}/orders/preview`, data);
}

export function payByQr(data: {
  qrToken: string;
  userCouponId?: string;
}): Promise<PaymentResult> {
  return apiClient.post<PaymentResult>(`${CONSUMER_API}/orders/pay`, data);
}
