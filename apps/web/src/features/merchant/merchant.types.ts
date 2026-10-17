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

// ── FR-M06: Merchant Wallet & Withdrawal Types ───────────────────────────────

export type MerchantOrderIncome = {
  orderId: string;
  receiptNumber: string;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  subsidyAmount: number;
  userPaidAmount: number;
  consumerName: string | null;
  paidAt: string;
};

export type MerchantWalletTransaction = {
  transactionId: string;
  fundType: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  businessRef: string;
  transferReference: string | null;
  orderId: string | null;
  receiptNumber: string | null;
  subsidyAmount: number | null;
  userPaidAmount: number | null;
  finalAmount: number | null;
  consumerName: string | null;
  createdAt: string;
};

export type MerchantWalletOverview = {
  wallet: {
    walletId: string;
    merchantId: string;
    merchantName: string;
    merchantStatus: string;
    walletStatus: string;
    merchantBalance: number;
    totalSalesIncome: number;
    totalSubsidyPortion: number;
    totalPersonalPortion: number;
    totalWithdrawn: number;
    paidOrderCount: number;
  };
  withdrawalEligibility: {
    isOwner: boolean;
    hasConsumerRole: boolean;
    hasConsumerWallet: boolean;
    consumerWalletId: string | null;
    consumerPersonalBalance: number | null;
    canWithdraw: boolean;
  };
  orderIncomes: MerchantOrderIncome[];
  recentTransactions: MerchantWalletTransaction[];
};

export type MerchantWalletTransactionsPage = {
  items: MerchantWalletTransaction[];
  nextCursor: string | null;
};

export type MerchantWithdrawalResult = {
  success: boolean;
  isIdempotentReplay: boolean;
  withdrawalId: string;
  creditTransactionId: string | null;
  transferReference: string;
  amount: number;
  merchantBalanceBefore: number;
  merchantBalanceAfter: number;
  consumerPersonalBalanceBefore: number;
  consumerPersonalBalanceAfter: number;
  createdAt: string;
};

// ── FR-M07: Merchant Analytics Dashboard Types ───────────────────────────────

export type MerchantTopProduct = {
  productId: string;
  productName: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
};

export type MerchantSalesTrendItem = {
  date: string;
  totalSales: number;
  subsidyAmount: number;
  personalAmount: number;
  discountAmount: number;
  orderCount: number;
};

export type MerchantDashboardData = {
  merchant: {
    merchantId: string;
    merchantName: string;
    status: string;
    merchantBalance: number;
  };
  summary: {
    totalSales: number;
    totalSubtotal: number;
    totalDiscountAmount: number;
    orderCount: {
      paid: number;
      pending: number;
      total: number;
      averageOrderValue: number;
    };
    subsidyReceived: number;
    personalPaymentReceived: number;
    subsidySharePercent: number;
    personalSharePercent: number;
    couponOrders: {
      count: number;
      totalDiscount: number;
      usageRatePercent: number;
    };
  };
  topProducts: MerchantTopProduct[];
  salesTrend: MerchantSalesTrendItem[];
  dataFreshness: {
    asOf: string;
    timezone: string;
    trendDays: number;
  };
};
