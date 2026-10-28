import { z } from 'zod';

// Expose bounded proposal facts and machine codes, never arbitrary model text.
const auditProposal = z.object({
  id: z.string().min(1).max(160),
  type: z.enum(['MIN_SPEND', 'CATEGORY_SPEND']),
  targetId: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .max(19)
    .nullable(),
  minimumSpendMinor: z.string().regex(/^[1-9][0-9]{0,11}$/),
});
const auditCode = z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/);
const auditAttempt = z.object({
  call: z.number().int().min(1).max(2),
  acceptedCount: z.number().int().min(0).max(3),
  rejections: z.array(auditCode).max(20),
});
const validationSchema = z.object({
  output: z.object({ attempts: z.array(auditAttempt).max(2) }),
  rejections: z.array(auditCode).max(20),
});

export function questAudit(proposals: unknown, validation: unknown) {
  const items = Array.isArray(proposals) ? proposals.slice(0, 3) : [];
  const safeProposals = items.flatMap((value: unknown) => {
    const parsed = auditProposal.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  const parsed = validationSchema.safeParse(validation);
  return {
    proposals: safeProposals,
    validation: {
      attempts: parsed.success ? parsed.data.output.attempts : [],
      rejections: parsed.success ? parsed.data.rejections : [],
    },
  };
}
