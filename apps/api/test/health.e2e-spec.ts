import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('health endpoints', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function startApp() {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: async () => [{ '?column?': 1 }],
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    return app.getUrl();
  }

  it('exposes versioned liveness and readiness endpoints', async () => {
    const baseUrl = await startApp();

    const live = await fetch(`${baseUrl}/api/v1/health/live`);
    const ready = await fetch(`${baseUrl}/api/v1/health/ready`);

    await expect(live.json()).resolves.toEqual({ status: 'ok' });
    await expect(ready.json()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });
});
