import 'reflect-metadata';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { ROLES_METADATA_KEY } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import type { ActiveRole } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { WalletController } from './wallet.controller.js';
import type { WalletService } from './wallet.service.js';

const overviewHandler = Object.getOwnPropertyDescriptor(
  WalletController.prototype,
  'getOverview',
)?.value as WalletController['getOverview'];

function createExecutionContext(role?: ActiveRole): ExecutionContext {
  return {
    getHandler: () => overviewHandler,
    getClass: () => WalletController,
    switchToHttp: () => ({
      getRequest: () => (role ? { user: { role } } : {}),
    }),
  } as unknown as ExecutionContext;
}

describe('WalletController FR-C01 authorization', () => {
  it('requires authentication and the CONSUMER role for overview', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, WalletController)).toEqual([
      AuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, overviewHandler)).toEqual([
      'CONSUMER',
    ]);
  });

  it('allows a consumer and rejects a different active role', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(createExecutionContext('CONSUMER'))).toBe(true);
    expect(() => guard.canActivate(createExecutionContext('MERCHANT'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects an unauthenticated request before overview access', async () => {
    const guard = new AuthGuard({} as JwtService, {} as PrismaService);

    await expect(guard.canActivate(createExecutionContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('passes only the authenticated session userId to the service', async () => {
    const getConsumerOverview = vi.fn().mockResolvedValue({});
    const controller = new WalletController({
      getConsumerOverview,
    } as unknown as WalletService);
    const authenticatedUserId = 42n;
    const request = {
      user: {
        userId: authenticatedUserId,
        citizenId: '1000000000001',
        fullName: 'ผู้ใช้ทดสอบ',
        role: 'CONSUMER',
        activeMerchantId: null,
        sessionId: 7n,
      },
    } as Request;

    await controller.getOverview(request);

    expect(getConsumerOverview).toHaveBeenCalledOnce();
    expect(getConsumerOverview).toHaveBeenCalledWith(authenticatedUserId);
  });
});
