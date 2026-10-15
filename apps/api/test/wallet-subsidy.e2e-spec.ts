import {
  UnauthorizedException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { WalletController } from '../src/wallet/wallet.controller.js';
import { WalletService } from '../src/wallet/wallet.service.js';

describe('GET /api/v1/wallet/subsidy HTTP contract', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('uses authenticated consumer identity and serializes the complete FR-C03 contract', async () => {
    const getConsumerSubsidyStatus = vi.fn().mockResolvedValue({
      currency: 'THB',
      timeZone: 'Asia/Bangkok',
      asOf: '2026-10-14T10:30:00.000Z',
      subsidyBalance: 800,
      dailySubsidyLimit: 200,
      dailySubsidyUsed: 50,
      dailySubsidyRemaining: 150,
      program: {
        programId: '7',
        programName: 'โครงการทดสอบ',
        subsidyPercentage: 50,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: { getConsumerSubsidyStatus },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          const role = request.headers['x-test-role'];
          if (role !== 'CONSUMER' && role !== 'MERCHANT') {
            throw new UnauthorizedException('AUTH_REQUIRED');
          }
          request.user = {
            userId: 42n,
            citizenId: '1000000000001',
            fullName: 'ผู้ใช้ทดสอบ',
            role,
            activeMerchantId: null,
            sessionId: 7n,
          };
          return true;
        },
      })
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
    const response = await fetch(`${baseUrl}/api/v1/wallet/subsidy`, {
      headers: { 'x-test-role': 'CONSUMER' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      currency: 'THB',
      timeZone: 'Asia/Bangkok',
      asOf: '2026-10-14T10:30:00.000Z',
      subsidyBalance: 800,
      dailySubsidyLimit: 200,
      dailySubsidyUsed: 50,
      dailySubsidyRemaining: 150,
      program: {
        programId: '7',
        programName: 'โครงการทดสอบ',
        subsidyPercentage: 50,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    });
    expect(getConsumerSubsidyStatus).toHaveBeenCalledOnce();
    expect(getConsumerSubsidyStatus).toHaveBeenCalledWith(42n);

    const unauthenticated = await fetch(`${baseUrl}/api/v1/wallet/subsidy`);
    expect(unauthenticated.status).toBe(401);

    const forbidden = await fetch(`${baseUrl}/api/v1/wallet/subsidy`, {
      headers: { 'x-test-role': 'MERCHANT' },
    });
    expect(forbidden.status).toBe(403);
    expect(getConsumerSubsidyStatus).toHaveBeenCalledOnce();
  });
});
