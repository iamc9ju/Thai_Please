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
  recentTransactions: Array<{
    transactionId: string;
    fundType: string;
    transactionType: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string;
  }>;
};

export type TopUpResponse = {
  success: boolean;
  isIdempotentReplay: boolean;
  transactionId: string;
  amount: number;
  personalBalance: number;
  createdAt: string;
};
