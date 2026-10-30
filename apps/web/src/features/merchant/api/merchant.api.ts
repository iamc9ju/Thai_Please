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

export function getMyProducts(includeInactive = true): Promise<Product[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiClient.get<Product[]>(`${MERCHANT_API}/products${query}`);
}

export function uploadProductImage(dataUrl: string): Promise<{
  imageUrl: string;
  publicId: string;
}> {
  return apiClient.post<{ imageUrl: string; publicId: string }>(
    `${MERCHANT_API}/products/upload-image`,
    { dataUrl },
  );
}

export function createProduct(data: {
  productName: string;
  price: number;
  categoryId: number;
  description?: string;
  imageUrl?: string;
  isRecommended?: boolean;
}): Promise<Product> {
  return apiClient.post<Product>(`${MERCHANT_API}/products`, data);
}

export function updateProduct(
  productId: string,
  data: {
    productName?: string;
    price?: number;
    categoryId?: number;
    description?: string;
    imageUrl?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    isRecommended?: boolean;
  },
): Promise<Product> {
  return apiClient.put<Product>(
    `${MERCHANT_API}/products/${encodeURIComponent(productId)}`,
    data,
  );
}

export function updateProductStatus(
  productId: string,
  status: 'ACTIVE' | 'INACTIVE',
): Promise<Product> {
  return apiClient.patch<Product>(
    `${MERCHANT_API}/products/${encodeURIComponent(productId)}/status`,
    { status },
  );
}

// ── Orders ───────────────────────────────────────────────────────────────────

export function createOrder(data: {
  items: Array<{ productId: number; quantity: number }>;
  userCouponId?: string;
}): Promise<CreateOrderResponse> {
  return apiClient.post<CreateOrderResponse>(`${MERCHANT_API}/orders`, data);
}

export function getMerchantOrders(params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<MerchantOrder[]> {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
  const query = searchParams.toString();
  return apiClient.get<MerchantOrder[]>(
    `${MERCHANT_API}/orders${query ? `?${query}` : ''}`,
  );
}

export function getMerchantOrderReceipt(
  orderId: string,
): Promise<ReceiptDetail> {
  return apiClient.get<ReceiptDetail>(
    `${MERCHANT_API}/orders/${encodeURIComponent(orderId)}/receipt`,
  );
}

// ── FR-M06: Merchant Wallet & Withdrawal ─────────────────────────────────────

export function getMerchantWalletOverview(params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<MerchantWalletOverview> {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
  const query = searchParams.toString();
  return apiClient.get<MerchantWalletOverview>(
    `${MERCHANT_API}/wallet${query ? `?${query}` : ''}`,
  );
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

export function getMerchantDashboard(
  days = 7,
  page = 1,
  pageSize = 5,
): Promise<MerchantDashboardData> {
  const params = new URLSearchParams({
    days: String(days),
    page: String(page),
    pageSize: String(pageSize),
  });
  return apiClient.get<MerchantDashboardData>(
    `${MERCHANT_API}/dashboard?${params.toString()}`,
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
