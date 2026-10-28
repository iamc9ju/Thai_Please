import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { MerchantBusinessType } from '@thai-please/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import {
  AUTH_RATE_LIMITED_CODE,
  LOGIN_MAX_FAILED_ATTEMPTS,
  LoginRateLimiterService,
} from '../src/auth/login-rate-limiter.service.js';
import { PasswordService } from '../src/auth/password/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

interface StoredUser {
  userId: bigint;
  citizenId: string;
  fullName: string;
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  passwordHash: string;
  status: string;
  roles: Array<{ role: string; status: string }>;
}

describe('Auth & Registration HTTP E2E Flow (FR-AUTH-01..FR-AUTH-04)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('registers consumer, attaches merchant role to same identity, logs in across portals with HttpOnly cookie, and enforces 429 brute-force lockout', async () => {
    const usersByCitizenId = new Map<string, StoredUser>();
    const walletsByUserId = new Map<
      bigint,
      {
        walletId: bigint;
        userId: bigint;
        walletType: string;
        subsidyBalance: number;
      }
    >();
    const merchantWallets = new Map<
      bigint,
      { walletId: bigint; merchantId: bigint; walletType: string }
    >();
    const merchants = new Map<
      bigint,
      {
        merchantId: bigint;
        ownerUserId: bigint;
        merchantName: string;
        merchantTypes: MerchantBusinessType[];
        status: string;
      }
    >();
    const sessions: Array<{
      authSessionId: bigint;
      userId: bigint;
      tokenHash: string;
      activeRole: string;
      activeMerchantId: bigint | null;
    }> = [];
    const walletTransactions: Array<{
      walletId: bigint;
      fundType: string;
      transactionType: string;
      amount: number;
    }> = [];

    let seq = 500n;
    const nextBigInt = () => ++seq;

    const prismaHarness = {
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
        fn(prismaHarness),
      user: {
        findUnique: async ({
          where,
        }: {
          where: { citizenId?: string; userId?: bigint };
        }) => {
          if (where.citizenId) {
            return usersByCitizenId.get(where.citizenId) ?? null;
          }
          if (where.userId) {
            return (
              [...usersByCitizenId.values()].find(
                (u) => u.userId === where.userId,
              ) ?? null
            );
          }
          return null;
        },
        create: async ({
          data,
        }: {
          data: {
            citizenId: string;
            fullName: string;
            title: string;
            firstName: string;
            lastName: string;
            dateOfBirth: Date;
            passwordHash: string;
            status: string;
          };
        }) => {
          const created: StoredUser = {
            userId: nextBigInt(),
            citizenId: data.citizenId,
            fullName: data.fullName,
            title: data.title,
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: data.dateOfBirth,
            passwordHash: data.passwordHash,
            status: data.status,
            roles: [],
          };
          usersByCitizenId.set(created.citizenId, created);
          return created;
        },
        update: async () => ({}),
      },
      userRole: {
        create: async ({
          data,
        }: {
          data: { userId: bigint; role: string; status: string };
        }) => {
          const target = [...usersByCitizenId.values()].find(
            (u) => u.userId === data.userId,
          );
          if (target) {
            target.roles.push({ role: data.role, status: data.status });
          }
          return data;
        },
      },
      wallet: {
        findUnique: async ({ where }: { where: { userId: bigint } }) =>
          walletsByUserId.get(where.userId) ?? null,
        create: async ({
          data,
        }: {
          data: {
            userId?: bigint;
            merchantId?: bigint;
            walletType: string;
            subsidyBalance: number;
          };
        }) => {
          const walletId = nextBigInt();
          if (data.userId) {
            const w = {
              walletId,
              userId: data.userId,
              walletType: data.walletType,
              subsidyBalance: Number(data.subsidyBalance),
            };
            walletsByUserId.set(data.userId, w);
            return w;
          }
          if (data.merchantId) {
            const mw = {
              walletId,
              merchantId: data.merchantId,
              walletType: data.walletType,
            };
            merchantWallets.set(data.merchantId, mw);
            return mw;
          }
          return { walletId };
        },
      },
      subsidyProgram: {
        findFirst: async () => ({
          programId: 1n,
          initialGrant: 600,
          status: 'ACTIVE',
        }),
      },
      walletTransaction: {
        create: async ({
          data,
        }: {
          data: {
            walletId: bigint;
            fundType: string;
            transactionType: string;
            amount: number;
          };
        }) => {
          walletTransactions.push({
            walletId: data.walletId,
            fundType: data.fundType,
            transactionType: data.transactionType,
            amount: Number(data.amount),
          });
          return data;
        },
      },
      quest: {
        findMany: async () => [
          { questId: 1n, durationDays: 7 },
          { questId: 2n, durationDays: 7 },
        ],
      },
      userQuest: {
        findFirst: async () => null,
        create: async ({ data }: { data: unknown }) => data,
      },
      merchant: {
        findFirst: async ({
          where,
        }: {
          where: { merchantName?: string; ownerUserId?: bigint };
        }) => {
          if (where.merchantName) {
            return (
              [...merchants.values()].find(
                (m) => m.merchantName === where.merchantName,
              ) ?? null
            );
          }
          if (where.ownerUserId) {
            return (
              [...merchants.values()].find(
                (m) => m.ownerUserId === where.ownerUserId,
              ) ?? null
            );
          }
          return null;
        },
        create: async ({
          data,
        }: {
          data: {
            ownerUserId: bigint;
            merchantName: string;
            merchantTypes: MerchantBusinessType[];
            status: string;
          };
        }) => {
          const merchantId = nextBigInt();
          const created = {
            merchantId,
            ownerUserId: data.ownerUserId,
            merchantName: data.merchantName,
            merchantTypes: data.merchantTypes,
            status: data.status,
          };
          merchants.set(merchantId, created);
          return created;
        },
      },
      authSession: {
        create: async ({
          data,
        }: {
          data: {
            userId: bigint;
            tokenHash: string;
            activeRole: string;
            activeMerchantId: bigint | null;
          };
        }) => {
          const session = {
            authSessionId: nextBigInt(),
            ...data,
          };
          sessions.push(session);
          return session;
        },
        update: async () => ({}),
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        PasswordService,
        LoginRateLimiterService,
        {
          provide: PrismaService,
          useValue: prismaHarness,
        },
        {
          provide: JwtService,
          useValue: {
            sign: (payload: Record<string, unknown>) =>
              `jwt.${payload.sub}.${payload.role}.${payload.jti}`,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'AUTH_SESSION_TTL_SECONDS') return 86400;
              if (key === 'NODE_ENV') return 'test';
              return 'test-secret-32-chars-minimum-value';
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
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

    // 1. FR-AUTH-01: Reject invalid consumer registration (invalid citizenId)
    const invalidReg = await fetch(`${baseUrl}/api/v1/auth/register/customer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        citizenId: '123',
        title: 'นาย',
        firstName: 'สมศักดิ์',
        lastName: 'รักไทย',
        birthDate: '1995-05-15',
        phone: '0812345678',
        homeNumber: '99/1',
        subdistrict: 'คลองเตย',
        district: 'คลองเตย',
        province: 'กรุงเทพมหานคร',
        postalCode: '10110',
        password: 'StrongPassword123!',
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    });
    expect(invalidReg.status).toBe(400);

    // 2. FR-AUTH-01: Valid Consumer Registration creates User + CONSUMER Role + Wallet + Initial Subsidy Grant
    const validConsumerDto = {
      citizenId: '1100000000009',
      title: 'นาย',
      firstName: 'สมศักดิ์',
      lastName: 'รักไทย',
      birthDate: '1995-05-15',
      phone: '0812345678',
      homeNumber: '99/1',
      subdistrict: 'คลองเตย',
      district: 'คลองเตย',
      province: 'กรุงเทพมหานคร',
      postalCode: '10110',
      password: 'StrongPassword123!',
      acceptTerms: true,
      acceptPrivacy: true,
    };

    const consumerRegRes = await fetch(
      `${baseUrl}/api/v1/auth/register/customer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validConsumerDto),
      },
    );
    expect(consumerRegRes.status).toBe(201);
    await expect(consumerRegRes.json()).resolves.toEqual({
      success: true,
      citizenId: '1100000000009',
      fullName: 'สมศักดิ์ รักไทย',
    });
    expect(walletTransactions).toEqual([
      expect.objectContaining({
        fundType: 'SUBSIDY',
        transactionType: 'SUBSIDY_GRANT',
        amount: 600,
      }),
    ]);

    // Duplicate Consumer Registration must return 409 Conflict
    const dupConsumerReg = await fetch(
      `${baseUrl}/api/v1/auth/register/customer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validConsumerDto),
      },
    );
    expect(dupConsumerReg.status).toBe(409);

    // Existing identity data must match before adding another role.
    const mismatchedMerchantRegRes = await fetch(
      `${baseUrl}/api/v1/auth/register/merchant`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...validConsumerDto,
          firstName: 'สมหญิง',
          merchantName: 'ร้านข้อมูลไม่ตรง',
          merchantTypes: ['FOOD_BEVERAGE', 'OTOP'],
          merchantPhone: '0898765432',
          merchantDescription: 'ข้อมูลทดสอบ',
          merchantAddress: '99/1 ถนนพระราม 4',
          merchantSubdistrict: 'คลองเตย',
          merchantDistrict: 'คลองเตย',
          merchantProvince: 'กรุงเทพมหานคร',
          merchantPostalCode: '10110',
          acceptMerchantTerms: true,
        }),
      },
    );
    expect(mismatchedMerchantRegRes.status).toBe(409);
    await expect(mismatchedMerchantRegRes.json()).resolves.toEqual(
      expect.objectContaining({ code: 'IDENTITY_DATA_MISMATCH' }),
    );
    expect(merchants.size).toBe(0);

    // 3. FR-AUTH-02: Existing Consumer registers a Merchant Store using the SAME citizenId, password, and identity data
    const merchantRegRes = await fetch(
      `${baseUrl}/api/v1/auth/register/merchant`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...validConsumerDto,
          merchantName: 'ร้านสมศักดิ์ โภชนา',
          merchantTypes: ['FOOD_BEVERAGE', 'OTOP'],
          merchantPhone: '0898765432',
          merchantDescription: 'อาหารตามสั่งชุมชน',
          merchantAddress: '99/1 ถนนพระราม 4',
          merchantSubdistrict: 'คลองเตย',
          merchantDistrict: 'คลองเตย',
          merchantProvince: 'กรุงเทพมหานคร',
          merchantPostalCode: '10110',
          acceptMerchantTerms: true,
        }),
      },
    );
    expect(merchantRegRes.status).toBe(201);
    await expect(merchantRegRes.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        merchantId: expect.any(String),
        merchantName: 'ร้านสมศักดิ์ โภชนา',
      }),
    );
    expect([...merchants.values()][0]?.status).toBe('PENDING');
    expect([...merchants.values()][0]?.merchantTypes).toEqual([
      'FOOD_BEVERAGE',
      'OTOP',
    ]);
    // Multi-role invariant: still only 1 User record in usersByCitizenId with both CONSUMER & MERCHANT roles
    expect(usersByCitizenId.size).toBe(1);
    const storedUser = usersByCitizenId.get('1100000000009')!;
    expect(storedUser.roles.map((r) => r.role)).toEqual([
      'CONSUMER',
      'MERCHANT',
    ]);
    // Separate Consumer Wallet and Merchant Wallet
    expect(walletsByUserId.size).toBe(1);
    expect(merchantWallets.size).toBe(1);

    // 4. FR-AUTH-04: Login to Consumer Portal and Merchant Portal with HttpOnly Cookie
    const consumerLoginRes = await fetch(
      `${baseUrl}/api/v1/auth/consumer/login`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          citizenId: '1100000000009',
          password: 'StrongPassword123!',
        }),
      },
    );
    expect(consumerLoginRes.status).toBe(200);
    expect(consumerLoginRes.headers.get('set-cookie')).toContain(
      'access_token=',
    );
    expect(consumerLoginRes.headers.get('set-cookie')).toContain('HttpOnly');
    await expect(consumerLoginRes.json()).resolves.toEqual({
      user: {
        fullName: 'สมศักดิ์ รักไทย',
        role: 'CONSUMER',
      },
    });

    const merchantLoginRes = await fetch(
      `${baseUrl}/api/v1/auth/merchant/login`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          citizenId: '1100000000009',
          password: 'StrongPassword123!',
        }),
      },
    );
    expect(merchantLoginRes.status).toBe(200);
    await expect(merchantLoginRes.json()).resolves.toEqual({
      user: {
        fullName: 'สมศักดิ์ รักไทย',
        role: 'MERCHANT',
      },
    });
    // Both sessions store SHA-256 tokenHash in auth_sessions
    expect(sessions).toHaveLength(2);
    expect(sessions[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions[1].tokenHash).toMatch(/^[a-f0-9]{64}$/);

    // 5. FR-AUTH-03: Brute-force protection locks out after 5 failed attempts on Admin Portal
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      const failedRes = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          citizenId: '1100000000009',
          password: `WrongPassword#${i}`,
        }),
      });
      expect(failedRes.status).toBe(401);
    }

    const rateLimitedRes = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        citizenId: '1100000000009',
        password: 'StrongPassword123!',
      }),
    });
    expect(rateLimitedRes.status).toBe(429);
    await expect(rateLimitedRes.json()).resolves.toEqual(
      expect.objectContaining({
        statusCode: 429,
        code: AUTH_RATE_LIMITED_CODE,
        retryAfterSeconds: expect.any(Number),
      }),
    );
  });
});
