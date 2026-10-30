export const CONSUMER_VIEWS = [
  'overview',
  'wallet',
  'payment',
  'orders',
  'quests',
  'rewards',
  'profile',
] as const;

export type ConsumerView = (typeof CONSUMER_VIEWS)[number];

export type PaymentStep = 'scan' | 'review' | 'success';

export const TOP_UP_MIN_BAHT = 1;
export const TOP_UP_MAX_BAHT = 50_000;
export const TOP_UP_QUICK_AMOUNTS = [100, 200, 500, 1_000] as const;
export const WALLET_HISTORY_PAGE_SIZE = 20;
export const WALLET_HISTORY_ITEMS_PER_PAGE = 5;

export type WalletTransactionItem = {
  transactionId: string;
  fundType: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
};

export type WalletTransactionHistoryResponse = {
  items: WalletTransactionItem[];
  nextCursor: string | null;
};

export type WalletTransactionHistoryQuery = {
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
};

export type ConsumerOverviewResponse = {
  wallet: {
    walletId: string;
    personalBalance: number;
    subsidyBalance: number;
    totalBalance: number;
    dailySubsidyLimit: number;
    dailySubsidyUsed: number;
    dailySubsidyRemaining: number;
    pointBalance: number;
  };
  program: {
    programId: string;
    programName: string;
    subsidyPercentage: number;
    userPercentage: number;
    dailySubsidyLimit: number;
    startDate: string;
    endDate: string;
  } | null;
  quests: Array<{
    userQuestId: string;
    questId: string;
    questName: string;
    description: string | null;
    rewardPoint: number;
    minSpend: number | null;
    expiresAt: string;
    status: string;
  }>;
  coupons: Array<{
    userCouponId: string;
    couponId: string;
    couponName: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    minPurchase: number;
    expiresAt: string;
    status: string;
  }>;
  recentTransactions: WalletTransactionItem[];
  recentOrders: Array<{
    orderId: string;
    merchantName: string;
    finalAmount: number;
    paidAt: string;
  }>;
};

export type ConsumerOverviewLoadState =
  | { status: 'loading' }
  | { status: 'success'; data: ConsumerOverviewResponse }
  | { status: 'permission-denied' }
  | { status: 'error' };

export type TopUpResponse = {
  success: boolean;
  isIdempotentReplay: boolean;
  transactionId: string;
  amount: number;
  personalBalance: number;
  createdAt: string;
};

export type ConsumerQuest = {
  id: string;
  amountBasis?: 'PERSONAL_AFTER_DISCOUNT' | 'FINAL_AFTER_DISCOUNT';
  questName?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  assignedAt: string;
  expiresAt: string;
  completedAt: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  completedOrderId?: string | null;
  receiptNumber?: string | null;
  type: 'MIN_SPEND' | 'CATEGORY_SPEND' | 'MERCHANT_SPEND' | 'PRODUCT_PURCHASE';
  targetCategoryId: string | null;
  targetCategoryName?: string | null;
  targetProductId: string | null;
  targetProductName?: string | null;
  targetMerchantId: string | null;
  targetMerchantName?: string | null;
  minimumSpendMinor: string | null;
  rewardPoints: number;
};

export type ConsumerQuestListResponse = {
  items: ConsumerQuest[];
  nextCursor: string | null;
};

export type ConsumerQuestProposal = {
  id: string;
  type: 'MIN_SPEND' | 'CATEGORY_SPEND';
  targetCategoryId: string | null;
  targetCategoryName: string | null;
  minimumSpend: string;
  rewardPoints: number;
  durationDays: number;
};

export type ConsumerQuestProposalsResponse = {
  status: 'READY' | 'PENDING' | 'COOLDOWN' | 'ELIGIBLE' | 'FAILED';
  requestKey: string | null;
  expiresAt: string | null;
  nextEligibleAt: string | null;
  reason: string | null;
  items: ConsumerQuestProposal[];
};

export type ConsumerQuestSelectionResponse = {
  assignmentId: string;
  nextEligibleAt: string;
};

export type ConsumerQuestLoadState =
  | { status: 'loading' }
  | { status: 'success'; data: ConsumerQuestListResponse }
  | { status: 'permission-denied' }
  | { status: 'error'; message?: string };

export type ConsumerPointTransactionItem = {
  pointTransactionId: string;
  transactionType: string;
  points: number;
  sourceName: string | null;
  userQuestId: string | null;
  completedOrderId: string | null;
  userCouponId: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ConsumerPointsResponse = {
  pointBalance: number;
  expiringPoints: number;
  nearestExpiryAt: string | null;
  items: ConsumerPointTransactionItem[];
};

export type CouponCatalogueItem = {
  couponId: string;
  couponName: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minPurchase: number;
  pointCost: number;
  validityDays: number;
  merchantId: string | null;
  merchantName: string | null;
  canRedeem: boolean;
};

export type OwnedConsumerCoupon = {
  userCouponId: string;
  couponId: string;
  couponName: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minPurchase: number;
  pointCost: number;
  merchantId: string | null;
  merchantName: string | null;
  status: string;
  redeemedAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedOrderId: string | null;
};

export type ConsumerCouponsResponse = {
  pointBalance: number;
  catalogue: CouponCatalogueItem[];
  ownedCoupons: OwnedConsumerCoupon[];
};

export type RedeemCouponResponse = {
  success: boolean;
  pointBalance: number;
  pointTransactionId: string;
  pointsDeducted: number;
  userCoupon: OwnedConsumerCoupon;
};

export type OrderPreviewItem = {
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type OrderPreviewResponse = {
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
  items: OrderPreviewItem[];
  appliedCoupon: {
    userCouponId: string;
    couponName: string;
    discountType: string;
    discountValue: number;
  } | null;
};

export type PaymentResultResponse = {
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

export type ConsumerOrderItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  categoryName?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type ConsumerOrder = {
  orderId: string;
  receiptNumber: string;
  status: string;
  merchantId: string;
  merchantName: string;
  merchantAddress: string | null;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  subsidyAmount: number;
  userPaidAmount: number;
  createdAt: string;
  paidAt: string | null;
  itemCount: number;
  items: ConsumerOrderItem[];
  appliedCoupon: {
    couponName: string;
    discountValue: number;
    discountType: string;
  } | null;
};

export type ReceiptDetail = {
  orderId: string;
  receiptNumber: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  subsidyAmount: number;
  userPaidAmount: number;
  merchant: {
    merchantId: string;
    merchantName: string;
    address: string;
    phone: string | null;
  };
  consumer: {
    fullName: string;
    maskedCitizenId: string;
  };
  items: Array<{
    orderItemId: string;
    productId: string;
    productName: string;
    categoryName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  appliedCoupon: {
    couponName: string;
    discountValue: number;
    discountType: string;
  } | null;
};
