import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { AdminController } from './admin.controller.js';
import type { AdminService } from './admin.service.js';
import { AdminGenerateQuestDto } from './dto/admin.dto.js';

const origin = 'http://localhost:5173';
const key = '541c432e-94e6-4a46-bda4-da5dd0864b71';
function fixture(
  requestOrigin: string | undefined = origin,
  json = true,
  role = 'ADMIN',
) {
  const service = {
    generatePersonalizedQuestForConsumer: vi
      .fn()
      .mockResolvedValue({ status: 'PENDING' }),
  };
  const controller = new AdminController(
    service as unknown as AdminService,
    { getOrThrow: () => origin } as unknown as ConfigService,
  );
  const request = {
    user: { userId: 1n, role },
    get: () => requestOrigin,
    is: () => json,
  } as unknown as Request;
  return { service, controller, request };
}
describe('FR-C07 legacy administrator proposal endpoint', () => {
  it('delegates trusted JSON requests and preserves target, actor and key', async () => {
    const f = fixture();
    await expect(
      f.controller.generatePersonalizedQuest(f.request, {
        userId: '3',
        idempotencyKey: key,
      }),
    ).resolves.toEqual({ status: 'PENDING' });
    expect(f.service.generatePersonalizedQuestForConsumer).toHaveBeenCalledWith(
      3n,
      1n,
      key,
    );
  });
  it.each([
    [undefined, true],
    ['https://untrusted.example', true],
    [origin, false],
  ])(
    'rejects untrusted mutation origin/content-type',
    async (requestOrigin, json) => {
      const f = fixture(
        requestOrigin === undefined ? '' : String(requestOrigin),
        Boolean(json),
      );
      await expect(
        f.controller.generatePersonalizedQuest(f.request, {
          userId: '3',
          idempotencyKey: key,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        f.service.generatePersonalizedQuestForConsumer,
      ).not.toHaveBeenCalled();
    },
  );
  it('rejects another active role and out-of-range database IDs', async () => {
    const denied = fixture(origin, true, 'CONSUMER');
    await expect(
      denied.controller.generatePersonalizedQuest(denied.request, {
        userId: '3',
        idempotencyKey: key,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const f = fixture();
    await expect(
      f.controller.generatePersonalizedQuest(f.request, {
        userId: '9999999999999999999',
        idempotencyKey: key,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      f.service.generatePersonalizedQuestForConsumer,
    ).not.toHaveBeenCalled();
  });
  it('requires UUID v4 in the request DTO', async () => {
    const dto = new AdminGenerateQuestDto();
    dto.userId = '3';
    dto.idempotencyKey = 'legacy-arbitrary-key';
    expect(
      (await validate(dto)).some(
        (error) => error.property === 'idempotencyKey',
      ),
    ).toBe(true);
    dto.idempotencyKey = key;
    expect(await validate(dto)).toEqual([]);
  });
});
