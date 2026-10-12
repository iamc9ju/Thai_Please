import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { PrototypePolicyService } from '../common/policy/prototype-policy.service.js';
import { SystemClock } from '../common/time/clock.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService citizen-only login (TBD-001 prototype decision)', () => {
  it('creates an opaque expiring session for an existing citizen ID', async () => {
    const sessionCreate = vi.fn().mockResolvedValue({ id: 1 });
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: vi.fn().mockResolvedValue({
                id: 7,
                displayName: 'Demo',
                role: 'CONSUMER',
              }),
            },
            authSession: { create: sessionCreate },
          },
        },
        {
          provide: PrototypePolicyService,
          useValue: {
            authSessionTtlSeconds: 3_600,
            addSeconds: (date: Date, seconds: number) =>
              new Date(date.getTime() + seconds * 1_000),
          },
        },
        {
          provide: SystemClock,
          useValue: { now: () => new Date('2026-10-06T00:00:00.000Z') },
        },
      ],
    }).compile();
    const response = await module.get(AuthService).login('1101700203451');
    expect(response.access_token.length).toBeGreaterThanOrEqual(43);
    expect(response.expires_at).toBe('2026-10-06T01:00:00.000Z');
    expect(sessionCreate).toHaveBeenCalledOnce();
  });
});
