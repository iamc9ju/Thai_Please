import {
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { QuestsController } from './quests.controller.js';
import { QuestsService } from './quests.service.js';

describe('quest HTTP authorization and contracts', () => {
  let app: INestApplication | undefined;
  const generate = vi.fn().mockResolvedValue({ status: 'ASSIGNED' });
  const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });
  async function start(role: 'ADMIN' | 'CONSUMER') {
    const module = await Test.createTestingModule({
      controllers: [QuestsController],
      providers: [
        { provide: QuestsService, useValue: { generate, list } },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            CORS_ORIGINS: 'http://localhost:5173',
          }),
        },
        Reflector,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = { userId: 5n, role };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    return app.getUrl();
  }
  it('denies consumer generation and restricts list to session identity', async () => {
    const url = await start('CONSUMER');
    const denied = await fetch(`${url}/admin/quests/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        userId: '1',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    });
    expect(denied.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
    expect((await fetch(`${url}/quests?userId=1`)).status).toBe(400);
    expect((await fetch(`${url}/quests`)).status).toBe(200);
    expect(list).toHaveBeenCalledWith(5n, undefined);
  });
  it('requires trusted origin, validates IDs and rejects extra mutation fields', async () => {
    const url = await start('ADMIN');
    const body = {
      userId: '1',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    };
    const post = (payload: unknown, origin = 'http://localhost:5173') =>
      fetch(`${url}/admin/quests/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(payload),
      });
    expect((await post(body, 'https://untrusted.invalid')).status).toBe(403);
    expect((await post({ ...body, rewardPoints: 999 })).status).toBe(400);
    expect(
      (await post({ ...body, userId: '9999999999999999999' })).status,
    ).toBe(400);
    expect((await post(body)).status).toBe(201);
    expect(generate).toHaveBeenCalledWith(1n, 5n, body.idempotencyKey);
  });
});
