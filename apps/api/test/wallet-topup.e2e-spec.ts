import {
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { RolesGuard } from '../src/auth/authorization/roles.guard.js';
import { WalletController } from '../src/wallet/wallet.controller.js';
import { WalletService } from '../src/wallet/wallet.service.js';

describe('POST /api/v1/wallet/topup HTTP contract', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('uses authenticated consumer identity and rejects a non-integer amount', async () => {
    const topUpPersonal = vi.fn().mockResolvedValue({
      success: true,
      isIdempotentReplay: false,
      transactionId: '101',
      amount: 100,
      personalBalance: 300,
      createdAt: new Date('2026-10-14T02:00:00.000Z'),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: { topUpPersonal } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = {
            userId: 42n,
            citizenId: '1000000000001',
            fullName: 'ผู้ใช้ทดสอบ',
            role: 'CONSUMER',
            activeMerchantId: null,
            sessionId: 7n,
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();

    const success = await fetch(`${baseUrl}/api/v1/wallet/topup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: 100,
        idempotencyKey: 'http-contract-key',
      }),
    });

    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        transactionId: '101',
        personalBalance: 300,
      }),
    );
    expect(topUpPersonal).toHaveBeenCalledWith(42n, {
      amount: 100,
      idempotencyKey: 'http-contract-key',
    });

    const invalid = await fetch(`${baseUrl}/api/v1/wallet/topup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: 1.5,
        idempotencyKey: 'http-contract-key-2',
      }),
    });

    expect(invalid.status).toBe(400);
    expect(topUpPersonal).toHaveBeenCalledOnce();
  });
});
