import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { RegisterConsumerDto } from './dto/register.dto.js';
import {
  AUTH_RATE_LIMITED_CODE,
  LOGIN_LOCKOUT_WINDOW_MS,
  LOGIN_MAX_FAILED_ATTEMPTS,
  LoginRateLimiterService,
} from './login-rate-limiter.service.js';

describe('AuthService & LoginRateLimiterService (FR-AUTH-03, FR-AUTH-04)', () => {
  let authService: AuthService;
  let rateLimiter: LoginRateLimiterService;
  let prismaMock: {
    user: { findUnique: Mock; update: Mock };
    merchant: { findFirst: Mock };
    authSession: { create: Mock; update: Mock };
  };
  let passwordsMock: { verify: Mock };
  let jwtServiceMock: { sign: Mock };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      merchant: {
        findFirst: vi.fn(),
      },
      authSession: {
        create: vi.fn().mockResolvedValue({ authSessionId: 1n }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    passwordsMock = {
      verify: vi.fn(),
    };
    jwtServiceMock = {
      sign: vi.fn().mockReturnValue('signed-jwt-token'),
    };
    rateLimiter = new LoginRateLimiterService();

    authService = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtServiceMock as never,
      { getOrThrow: vi.fn().mockReturnValue(86400) } as never,
      passwordsMock as never,
      rateLimiter,
    );
  });

  it('authenticates valid credentials, persists SHA-256 tokenHash in auth_sessions, and resets failure count', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      userId: 101n,
      citizenId: '1100000000001',
      fullName: 'สมชาย ใจดี',
      passwordHash: 'argon2id$hash',
      status: 'ACTIVE',
      roles: [{ role: 'CONSUMER', status: 'ACTIVE' }],
    });
    passwordsMock.verify.mockResolvedValueOnce(false);

    // 1st attempt fails
    await expect(
      authService.login(
        { citizenId: '1100000000001', password: 'WrongPassword1!' },
        'CONSUMER',
        '127.0.0.1',
      ),
    ).rejects.toThrow(UnauthorizedException);

    // 2nd attempt succeeds and clears failure bucket
    passwordsMock.verify.mockResolvedValueOnce(true);
    const result = await authService.login(
      { citizenId: '1100000000001', password: 'CorrectPassword1!' },
      'CONSUMER',
      '127.0.0.1',
    );

    expect(result).toEqual({
      token: 'signed-jwt-token',
      user: {
        fullName: 'สมชาย ใจดี',
        role: 'CONSUMER',
      },
    });
    expect(prismaMock.authSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 101n,
          activeRole: 'CONSUMER',
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it('blocks brute-force login after 5 consecutive failed attempts with 429 Too Many Requests (FR-AUTH-03)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      userId: 101n,
      citizenId: '1100000000001',
      fullName: 'สมชาย ใจดี',
      passwordHash: 'argon2id$hash',
      status: 'ACTIVE',
      roles: [{ role: 'CONSUMER', status: 'ACTIVE' }],
    });
    passwordsMock.verify.mockResolvedValue(false);

    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      await expect(
        authService.login(
          { citizenId: '1100000000001', password: `WrongPass#${i}` },
          'CONSUMER',
          '203.0.113.10',
        ),
      ).rejects.toThrow(UnauthorizedException);
    }

    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(
      LOGIN_MAX_FAILED_ATTEMPTS,
    );

    // 6th attempt must be rejected by rate limiter before hitting the database
    let rateLimitError: unknown;
    try {
      await authService.login(
        { citizenId: '1100000000001', password: 'EvenCorrectPassword1!' },
        'CONSUMER',
        '203.0.113.10',
      );
    } catch (error) {
      rateLimitError = error;
    }

    expect(rateLimitError).toBeInstanceOf(HttpException);
    const httpError = rateLimitError as HttpException;
    expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(httpError.getResponse()).toEqual(
      expect.objectContaining({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: AUTH_RATE_LIMITED_CODE,
        retryAfterSeconds: expect.any(Number),
      }),
    );
    // Database was NOT queried on the rate-limited attempt
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(
      LOGIN_MAX_FAILED_ATTEMPTS,
    );
  });

  it('releases the lockout after LOGIN_LOCKOUT_WINDOW_MS elapses', () => {
    const startMs = 1_700_000_000_000;
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      rateLimiter.recordFailure(
        'ADMIN',
        '9000000000001',
        '10.0.0.1',
        startMs + i * 1000,
      );
    }

    // Still locked inside window
    expect(() =>
      rateLimiter.assertAllowed(
        'ADMIN',
        '9000000000001',
        '10.0.0.1',
        startMs + LOGIN_LOCKOUT_WINDOW_MS - 1,
      ),
    ).toThrow(HttpException);

    // Unlocked once window expires
    expect(() =>
      rateLimiter.assertAllowed(
        'ADMIN',
        '9000000000001',
        '10.0.0.1',
        startMs + LOGIN_LOCKOUT_WINDOW_MS,
      ),
    ).not.toThrow();
  });
});

describe('FR-C07 consumer registration proposal-only lifecycle', () => {
  it('registers an account without automatically assigning any catalogue quests', async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({
          userId: 1n,
          citizenId: '1100000000001',
          fullName: 'Fixture Consumer',
        }),
      },
      userRole: { create: vi.fn().mockResolvedValue({}) },
      wallet: { findUnique: vi.fn().mockResolvedValue({ walletId: 1n }) },
      quest: {
        findMany: vi.fn().mockResolvedValue([{ questId: 1n, durationDays: 7 }]),
      },
      userQuest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const auth = new AuthService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      { hash: vi.fn().mockResolvedValue('fixture-hash') } as never,
    );
    const dto: RegisterConsumerDto = {
      citizenId: '1100000000001',
      title: 'นาย',
      firstName: 'Fixture',
      lastName: 'Consumer',
      birthDate: '2000-01-01',
      phone: '0811111111',
      homeNumber: '1',
      subdistrict: 'Fixture',
      district: 'Fixture',
      province: 'Fixture',
      postalCode: '10100',
      password: 'FixturePassword1!',
      acceptTerms: true,
      acceptPrivacy: true,
    };
    await expect(auth.registerConsumer(dto)).resolves.toMatchObject({
      success: true,
    });
    expect(tx.user.create).toHaveBeenCalledOnce();
    expect(tx.userRole.create).toHaveBeenCalledOnce();
    expect(tx.quest.findMany).not.toHaveBeenCalled();
    expect(tx.userQuest.create).not.toHaveBeenCalled();
  });
});
