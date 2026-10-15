import { z } from 'zod';

// Fixed invariants (FR-C07 / FR-S06) are not policy switches.
export const QUEST_COMPLETION_INVARIANTS = {
  receiptStatus: 'PAID',
  receiptCount: 1,
  amountBasis: 'AFTER_DISCOUNTS_BEFORE_SUBSIDY_SPLIT',
  categoryBasis: 'ORDER_ITEM_SNAPSHOT',
  expiryBoundary: 'EXCLUSIVE',
  assignmentMode: 'AUTOMATIC',
  rewardMode: 'TRANSACTIONAL_EXACTLY_ONCE',
} as const;

export const QuestTypeSchema = z.enum([
  'MIN_SPEND',
  'CATEGORY_SPEND',
  'PRODUCT_PURCHASE',
  'MERCHANT_SPEND',
]);
const positiveInteger = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const pointMap = z.strictObject({
  MIN_SPEND: positiveInteger,
  CATEGORY_SPEND: positiveInteger,
  PRODUCT_PURCHASE: positiveInteger,
  MERCHANT_SPEND: positiveInteger,
});

export const QuestPolicySchema = z
  .strictObject({
    version: z.string().regex(/^quest-policy-v[1-9][0-9]*$/),
    candidates: z.strictObject({
      types: z
        .array(QuestTypeSchema)
        .min(1)
        .max(4)
        .refine(
          (types) => new Set(types).size === types.length,
          'Duplicate quest types',
        ),
      historyDays: positiveInteger,
      recentHistoryDays: positiveInteger,
      minimumHistoryOrders: positiveInteger,
      minimumTargetOrders: positiveInteger,
      spendMultipliers: z
        .array(
          z.strictObject({
            numerator: positiveInteger,
            denominator: positiveInteger,
          }),
        )
        .min(1),
      spendBasis: z.strictObject({
        MIN_SPEND: z.literal('WHOLE_ORDER_AVERAGE'),
        CATEGORY_SPEND: z.literal('TARGET_CATEGORY_AVERAGE'),
        MERCHANT_SPEND: z.literal('TARGET_MERCHANT_AVERAGE'),
      }),
      currency: z.literal('THB'),
      minorUnitsPerMajor: z.literal(100),
      minimumSpendMinorUnits: positiveInteger,
      maximumSpendMinorUnits: positiveInteger,
      rounding: z.literal('CEIL_MINOR_UNIT'),
      targetSelection: z.literal('PREVIOUSLY_PURCHASED_ACTIVE_ONLY'),
      targetOrdering: z.literal('FREQUENCY_DESC_LAST_PURCHASE_DESC_ID_ASC'),
      maximumPerType: positiveInteger,
      maximumTotal: positiveInteger,
      insufficientHistory: z.literal('DEFER'),
    }),
    selection: z.strictObject({
      scoreMinimum: z.literal(0),
      scoreMaximum: z.literal(100),
      criteria: z.literal('PURCHASE_RELEVANCE_AND_ACHIEVABLE_CHALLENGE'),
      tieBreak: z.literal('LOWER_SPEND_THEN_CANDIDATE_ID_ASC'),
      providerFailure: z.literal('DEFER'),
      maximumAttemptsPerGeneration: positiveInteger.max(3),
    }),
    assignment: z.strictObject({
      maximumActivePerUser: positiveInteger,
      maximumNewPerUserPerDay: positiveInteger,
      scheduleTimezone: z.literal('Asia/Bangkok'),
      dailyHour: z.number().int().min(0).max(23),
      dailyMinute: z.number().int().min(0).max(59),
      durationDays: positiveInteger,
      duplicateCooldownDays: z
        .number()
        .int()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER),
      duplicateIdentity: z.literal('TYPE_AND_TARGET'),
      cooldownStartsAt: z.literal('COMPLETION_OR_EXPIRY'),
      nextQuest: z.literal('NEXT_DAILY_RUN_AFTER_FINALIZATION'),
    }),
    rewards: z.strictObject({
      pointsByType: pointMap,
      pointValidityDays: positiveInteger,
      globalDailyReservationBudgetPoints: positiveInteger,
      globalOutstandingReservationBudgetPoints: positiveInteger,
      budgetExhausted: z.literal('DEFER'),
      reserveAt: z.literal('ASSIGNMENT'),
      releaseAt: z.literal('EXPIRY_OR_REWARD_ISSUANCE'),
    }),
    completion: z.strictObject({
      maximumAssignmentsPerReceipt: positiveInteger,
    }),
  })
  .superRefine((policy, ctx) => {
    const reject = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const c = policy.candidates;
    if (c.recentHistoryDays > c.historyDays)
      reject(
        ['candidates', 'recentHistoryDays'],
        'Recent window exceeds history window',
      );
    if (c.minimumSpendMinorUnits > c.maximumSpendMinorUnits)
      reject(['candidates', 'maximumSpendMinorUnits'], 'Invalid spend range');
    if (c.maximumTotal < c.maximumPerType)
      reject(
        ['candidates', 'maximumTotal'],
        'Total limit is below per-type limit',
      );
    if (c.spendMultipliers.some((ratio) => ratio.numerator < ratio.denominator))
      reject(
        ['candidates', 'spendMultipliers'],
        'Spend multiplier must be at least one',
      );
    const largestReward = Math.max(
      ...c.types.map((type) => policy.rewards.pointsByType[type]),
    );
    if (policy.rewards.globalDailyReservationBudgetPoints < largestReward)
      reject(
        ['rewards', 'globalDailyReservationBudgetPoints'],
        'Budget cannot fund one quest',
      );
    if (policy.rewards.globalOutstandingReservationBudgetPoints < largestReward)
      reject(
        ['rewards', 'globalOutstandingReservationBudgetPoints'],
        'Outstanding budget cannot fund one quest',
      );
    if (
      policy.completion.maximumAssignmentsPerReceipt >
      policy.assignment.maximumActivePerUser
    )
      reject(
        ['completion', 'maximumAssignmentsPerReceipt'],
        'Receipt limit exceeds active limit',
      );
  });

export type QuestPolicy = z.infer<typeof QuestPolicySchema>;

/** Trust boundary: callers load JSON; domain code owns validation, not filesystem I/O. */
export function parseQuestPolicy(input: unknown): QuestPolicy {
  return QuestPolicySchema.parse(input);
}
