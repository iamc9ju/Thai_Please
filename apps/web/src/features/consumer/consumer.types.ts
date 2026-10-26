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
/**
 * Controls whether Dashboard data can skip revalidation when navigating to
 * Wallet. It is not a maximum age for data already displayed on either view.
 */
export const CONSUMER_OVERVIEW_NAVIGATION_REUSE_POLICY = {
  maxAgeMs: 30_000,
} as const;

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
