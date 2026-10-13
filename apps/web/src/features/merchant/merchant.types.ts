export type Product = {
  productId: string;
  productName: string;
  description: string | null;
  price: number;
  status: string;
  categoryId: string;
  categoryName: string;
};

export type Category = {
  categoryId: string;
  categoryName: string;
  description: string | null;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type CreateOrderResponse = {
  orderId: string;
  status: string;
  subtotal: number;
  finalAmount: number;
  qrToken: string;
  qrExpiresAt: string;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
};

export type MerchantOrder = {
  orderId: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  subsidyAmount: number;
  userPaidAmount: number;
  consumerName: string | null;
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
};

export type OrderPreview = {
  orderId: string;
  merchantName: string;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  subsidyAmount: number;
  userPaidAmount: number;
  personalBalance: number;
  subsidyBalance: number;
  canAfford: boolean;
  qrExpiresAt: string;
  items: Array<{
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  appliedCoupon: {
    userCouponId: string;
    couponName: string;
    discountType: string;
    discountValue: number;
  } | null;
};

export type PaymentResult = {
  success: boolean;
  isIdempotentReplay: boolean;
  orderId: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  subsidyAmount: number;
  userPaidAmount: number;
  paidAt: string;
};
