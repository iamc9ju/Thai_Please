import { z } from 'zod';

const environmentSchema = z
  .object({
    API_PREFIX: z.string().trim().min(1).default('api/v1'),
    AUTH_SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(28_800),
    CORS_ORIGINS: z.string().trim().min(1).default('http://localhost:5173'),
    DATABASE_URL: z.string().trim().min(1),
    JWT_SECRET: z.string().min(32),
    GEMINI_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().trim().min(1).optional(),
    ),
    GEMINI_MODEL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9._-]+$/)
        .max(100)
        .optional(),
    ),
    GEMINI_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(30000)
      .default(15000),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.GEMINI_API_KEY) !== Boolean(env.GEMINI_MODEL))
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_MODEL'],
        message: 'Configure GEMINI_API_KEY and GEMINI_MODEL together',
      });
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(values);
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
