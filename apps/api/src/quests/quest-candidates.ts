/** ORM-independent purchase and quest facts shared by proposal preparation and persistence. */
export type QuestCandidateType = 'MIN_SPEND' | 'CATEGORY_SPEND';
export interface PurchaseFact {
  id: string;
  merchantId: string;
  paidAt: Date;
  finalMinor: bigint;
  personalMinor: bigint;
  items: readonly {
    id: string;
    productId: string;
    categoryId: string;
    lineMinor: bigint;
  }[];
}
export interface EligibleCatalog {
  readonly categories: ReadonlySet<string>;
  readonly categoryNames?: ReadonlyMap<string, string>;
}
export interface PriorQuest {
  type: string;
  targetId: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  status: string;
  minimumSpendMinor?: string | null;
  assignedAt?: Date;
  ruleVersion?: string;
  spendBasis?: string;
}
/** A domain-validated AI proposal enriched with server-owned reward and duration. */
export interface Candidate {
  id: string;
  type: QuestCandidateType;
  targetId: string | null;
  minimumSpendMinor: string | null;
  rewardPoints: number;
  durationDays: number;
}
