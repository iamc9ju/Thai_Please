import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
});
