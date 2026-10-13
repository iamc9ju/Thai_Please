import { apiClient } from '../../../lib/api-client';
import type {
  Category,
  CreateOrderResponse,
  MerchantOrder,
  OrderPreview,
  PaymentResult,
  Product,
} from '../merchant.types';

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
