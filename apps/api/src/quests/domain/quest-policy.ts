import { z } from 'zod';

export const QUEST_COMPLETION_INVARIANTS = {
  receiptStatus: 'PAID',
  receiptCount: 1,
  amountBasis: 'PERSONAL_AFTER_DISCOUNT',
  categoryBasis: 'ORDER_ITEM_SNAPSHOT',
  expiryBoundary: 'EXCLUSIVE',
  assignmentMode: 'CONSUMER_SELECTION',
  rewardMode: 'TRANSACTIONAL_EXACTLY_ONCE',
} as const;
export const QuestTypeSchema = z.enum(['MIN_SPEND', 'CATEGORY_SPEND']);
const positiveInteger = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const QuestPolicySchema = z
  .strictObject({
    version: z.string().regex(/^quest-policy-v[1-9][0-9]*$/),
    proposals: z.strictObject({
      desiredCount: z.literal(3),
      maximumCalls: positiveInteger.max(2),
      offerValidityHours: positiveInteger.max(168),
      retryCooldownMinutes: positiveInteger,
      maximumSetsPerDay: positiveInteger,
      historyDays: positiveInteger,
      recentHistoryLimit: positiveInteger.max(100),
      spendStepMinorUnits: z.literal(1000),
      workerPollMilliseconds: z.number().int().min(100).max(60000),
      distributionUpperMinorUnits: z
        .array(positiveInteger)
        .min(1)
        .max(20)
        .refine(
          (values) =>
            values.every(
              (value, index) => index === 0 || value > (values[index - 1] ?? 0),
            ),
          'Distribution bounds must increase',
        ),
    }),
    candidates: z.strictObject({
      types: z
        .array(QuestTypeSchema)
        .min(1)
        .max(2)
        .refine(
          (types) => new Set(types).size === types.length,
          'Duplicate quest types',
        ),
      historyDays: positiveInteger,
      minimumHistoryOrders: positiveInteger,
      currency: z.literal('THB'),
      minorUnitsPerMajor: z.literal(100),
    }),
    assignment: z.strictObject({
      cycleDays: positiveInteger,
      maximumActivePerUser: z.literal(1),
      durationDays: positiveInteger,
      duplicateCooldownDays: z
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER),
      duplicateIdentity: z.literal('TYPE_TARGET_AND_AMOUNT'),
      cooldownStartsAt: z.literal('COMPLETION_OR_EXPIRY'),
      nextQuest: z.literal('NEXT_CYCLE_AFTER_SELECTION'),
    }),
    rewards: z.strictObject({
      pointsByType: z.strictObject({
        MIN_SPEND: positiveInteger,
        CATEGORY_SPEND: positiveInteger,
      }),
      pointValidityDays: positiveInteger,
      globalDailyReservationBudgetPoints: positiveInteger,
      globalOutstandingReservationBudgetPoints: positiveInteger,
      budgetExhausted: z.literal('DEFER'),
      reserveAt: z.literal('ASSIGNMENT'),
      releaseAt: z.literal('EXPIRY_OR_REWARD_ISSUANCE'),
    }),
    completion: z.strictObject({ maximumAssignmentsPerReceipt: z.literal(1) }),
  })
  .superRefine((policy, ctx) => {
    if (policy.assignment.durationDays > policy.assignment.cycleDays)
      ctx.addIssue({
        code: 'custom',
        path: ['assignment', 'durationDays'],
        message: 'Quest duration exceeds cycle',
      });
    if (
      policy.rewards.pointsByType.MIN_SPEND !==
      policy.rewards.pointsByType.CATEGORY_SPEND
    )
      ctx.addIssue({
        code: 'custom',
        path: ['rewards', 'pointsByType'],
        message: 'Quest proposals must have equal rewards',
      });
    const reward = Math.max(
      ...policy.candidates.types.map(
        (type) => policy.rewards.pointsByType[type],
      ),
    );
    for (const field of [
      'globalDailyReservationBudgetPoints',
      'globalOutstandingReservationBudgetPoints',
    ] as const)
      if (policy.rewards[field] < reward)
        ctx.addIssue({
          code: 'custom',
          path: ['rewards', field],
          message: 'Budget cannot fund one quest',
        });
  });
export type QuestPolicy = z.infer<typeof QuestPolicySchema>;
export function parseQuestPolicy(input: unknown): QuestPolicy {
  return QuestPolicySchema.parse(input);
}
