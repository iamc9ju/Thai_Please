import { z } from 'zod';

const environmentSchema = z.object({
  API_PREFIX: z.string().trim().min(1).default('api'),
  APP_NAME: z.string().trim().min(1).default('thai-please-api'),
  CORS_ORIGINS: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .default(5_000),
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .default(10_000),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  ENABLE_SWAGGER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(60).default(28_800),
  QR_TTL_SECONDS: z.coerce.number().int().min(30).default(300),
  INITIAL_SUBSIDY_BAHT: z.coerce.number().int().min(1).default(1_000),
  DAILY_SUBSIDY_CAP_BAHT: z.coerce.number().int().min(0).default(200),
  SUBSIDY_PERCENT: z.coerce.number().int().min(0).max(100).default(60),
  COUPON_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  POINT_TTL_DAYS: z.coerce.number().int().min(1).default(365),
  QUEST_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  MAX_TOPUP_BAHT: z.coerce.number().int().min(1).default(100_000),
  BUSINESS_TIME_ZONE: z.literal('Asia/Bangkok').default('Asia/Bangkok'),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): EnvironmentVariables {
  return environmentSchema.parse(values);
}
