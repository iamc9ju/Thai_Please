import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { EnvironmentVariables } from '../../config/environment.js';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const adapter = new PrismaPg({
      connectionTimeoutMillis: config.get(
        'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
        { infer: true },
      ),
      connectionString: config.get('DATABASE_URL', { infer: true }),
      idleTimeoutMillis: config.get('DATABASE_POOL_IDLE_TIMEOUT_MS', {
        infer: true,
      }),
      max: config.get('DATABASE_POOL_MAX', { infer: true }),
    });
    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
