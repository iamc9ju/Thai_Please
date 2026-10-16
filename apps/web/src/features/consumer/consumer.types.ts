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
export const WALLET_HISTORY_PAGE_SIZE = 20;

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

export type ConsumerSubsidyStatusResponse = {
  currency: 'THB';
  timeZone: 'Asia/Bangkok';
  asOf: string;
  subsidyBalance: number;
  dailySubsidyLimit: number;
  dailySubsidyUsed: number;
  dailySubsidyRemaining: number;
  program: {
    programId: string;
    programName: string;
    subsidyPercentage: number;
    startDate: string;
    endDate: string;
  } | null;
};

export type ConsumerOverviewLoadState =
  | { status: 'loading' }
  | {
      status: 'success';
      data: ConsumerOverviewResponse;
      subsidy: ConsumerSubsidyStatusResponse;
    }
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
  questName?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  assignedAt: string;
  expiresAt: string;
  completedAt: string | null;
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

export type ConsumerQuestLoadState =
  | { status: 'loading' }
  | { status: 'success'; data: ConsumerQuestListResponse }
  | { status: 'permission-denied' }
  | { status: 'error'; message?: string };

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

