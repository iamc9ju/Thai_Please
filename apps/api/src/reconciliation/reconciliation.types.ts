export type ReconciliationStatus = 'RECONCILED' | 'DISCREPANCY_DETECTED';

export interface WalletDiscrepancy {
  walletId: string;
  walletType: string;
  userId?: string | null;
  merchantId?: string | null;
  discrepancyType: string;
  expected: number;
  actual: number;
  diff: number;
}

export interface PointDiscrepancy {
  userId: string;
  citizenId?: string;
  actualPointBalance: number;
  ledgerPointBalance: number;
  diff: number;
}

export interface OrderDiscrepancy {
  orderId: string;
  issue: string;
  details?: Record<string, unknown>;
}

export interface CouponDiscrepancy {
  userCouponId: string;
  issue: string;
  details?: Record<string, unknown>;
}

export interface QuestRewardDiscrepancy {
  userQuestId: string;
  issue: string;
}

export interface ReconciliationSummary {
  isHealthy: boolean;
  totalDiscrepancies: number;
  walletsChecked: number;
  walletDiscrepanciesCount: number;
  usersChecked: number;
  pointDiscrepanciesCount: number;
  ordersChecked: number;
  orderDiscrepanciesCount: number;
  couponsChecked: number;
  couponDiscrepanciesCount: number;
  questRewardsChecked: number;
  questRewardDiscrepanciesCount: number;
}

export interface ReconciliationReport {
  status: ReconciliationStatus;
  executedAt: string;
  summary: ReconciliationSummary;
  details: {
    walletDiscrepancies: WalletDiscrepancy[];
    pointDiscrepancies: PointDiscrepancy[];
    orderDiscrepancies: OrderDiscrepancy[];
    couponDiscrepancies: CouponDiscrepancy[];
    questRewardDiscrepancies: QuestRewardDiscrepancy[];
  };
}
