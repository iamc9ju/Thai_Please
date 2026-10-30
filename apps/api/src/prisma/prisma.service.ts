import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

function normalizePgConnectionString(rawUrl: string | undefined): {
  connectionString: string | undefined;
  schema: string;
} {
  if (!rawUrl) {
    return { connectionString: undefined, schema: 'public' };
  }
  try {
    const parsed = new URL(rawUrl);
    const schema = parsed.searchParams.get('schema') ?? 'public';
    const sslMode = parsed.searchParams.get('sslmode');
    if (
      (sslMode === 'require' ||
        sslMode === 'prefer' ||
        sslMode === 'verify-ca') &&
      !parsed.searchParams.has('uselibpqcompat')
    ) {
      parsed.searchParams.set('sslmode', 'verify-full');
    }
    return { connectionString: parsed.toString(), schema };
  } catch {
    return { connectionString: rawUrl, schema: 'public' };
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const { connectionString, schema } = normalizePgConnectionString(
      process.env.DATABASE_URL,
    );
    const adapter = new PrismaPg({ connectionString }, { schema });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
