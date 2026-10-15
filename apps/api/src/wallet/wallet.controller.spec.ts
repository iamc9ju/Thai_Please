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
import type { TopUpDto } from './dto/top-up.dto.js';
import type { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto.js';
import { WalletController } from './wallet.controller.js';
import type { WalletService } from './wallet.service.js';

const overviewHandler = Object.getOwnPropertyDescriptor(
  WalletController.prototype,
  'getOverview',
)?.value as WalletController['getOverview'];
const topUpHandler = Object.getOwnPropertyDescriptor(
  WalletController.prototype,
  'topUp',
)?.value as WalletController['topUp'];
const subsidyHandler = Object.getOwnPropertyDescriptor(
  WalletController.prototype,
  'getSubsidyStatus',
)?.value as WalletController['getSubsidyStatus'];
const transactionsHandler = Object.getOwnPropertyDescriptor(
  WalletController.prototype,
  'getTransactions',
)?.value as WalletController['getTransactions'];

function createExecutionContext(
  role?: ActiveRole,
  handler:
    | WalletController['getOverview']
    | WalletController['getSubsidyStatus']
    | WalletController['topUp']
    | WalletController['getTransactions'] = overviewHandler,
): ExecutionContext {
  return {
    getHandler: () => handler,
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

  it('requires the CONSUMER role for top-up', () => {
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, topUpHandler)).toEqual([
      'CONSUMER',
    ]);

    const guard = new RolesGuard(new Reflector());
    expect(
      guard.canActivate(createExecutionContext('CONSUMER', topUpHandler)),
    ).toBe(true);
    expect(() =>
      guard.canActivate(createExecutionContext('MERCHANT', topUpHandler)),
    ).toThrow(ForbiddenException);
  });

  it('requires the CONSUMER role and passes only the session identity for subsidy status', async () => {
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, subsidyHandler)).toEqual([
      'CONSUMER',
    ]);
    const guard = new RolesGuard(new Reflector());
    expect(
      guard.canActivate(createExecutionContext('CONSUMER', subsidyHandler)),
    ).toBe(true);
    expect(() =>
      guard.canActivate(createExecutionContext('MERCHANT', subsidyHandler)),
    ).toThrow(ForbiddenException);

    const getConsumerSubsidyStatus = vi.fn().mockResolvedValue({});
    const controller = new WalletController({
      getConsumerSubsidyStatus,
    } as unknown as WalletService);
    const request = {
      user: {
        userId: 42n,
        citizenId: '1000000000001',
        fullName: 'ผู้ใช้ทดสอบ',
        role: 'CONSUMER',
        activeMerchantId: null,
        sessionId: 7n,
      },
    } as Request;

    await controller.getSubsidyStatus(request);

    expect(getConsumerSubsidyStatus).toHaveBeenCalledOnce();
    expect(getConsumerSubsidyStatus).toHaveBeenCalledWith(42n);
  });

  it('uses session userId and the validated body for top-up', async () => {
    const topUpPersonal = vi.fn().mockResolvedValue({ success: true });
    const controller = new WalletController({
      topUpPersonal,
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
    const dto: TopUpDto = {
      amount: 500,
      idempotencyKey: 'controller-key-123',
    };

    await controller.topUp(request, dto);

    expect(topUpPersonal).toHaveBeenCalledOnce();
    expect(topUpPersonal).toHaveBeenCalledWith(authenticatedUserId, dto);
  });

  it('requires the CONSUMER role and session identity for transaction history', async () => {
    expect(
      Reflect.getMetadata(ROLES_METADATA_KEY, transactionsHandler),
    ).toEqual(['CONSUMER']);
    const guard = new RolesGuard(new Reflector());
    expect(
      guard.canActivate(
        createExecutionContext('CONSUMER', transactionsHandler),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        createExecutionContext('MERCHANT', transactionsHandler),
      ),
    ).toThrow(ForbiddenException);

    const getConsumerTransactions = vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    const controller = new WalletController({
      getConsumerTransactions,
    } as unknown as WalletService);
    const request = {
      user: {
        userId: 42n,
        citizenId: '1000000000001',
        fullName: 'ผู้ใช้ทดสอบ',
        role: 'CONSUMER',
        activeMerchantId: null,
        sessionId: 7n,
      },
    } as Request;
    const query: WalletTransactionsQueryDto = {
      dateFrom: '2026-10-01',
      dateTo: '2026-10-14',
      limit: 20,
    };

    await controller.getTransactions(request, query);

    expect(getConsumerTransactions).toHaveBeenCalledOnce();
    expect(getConsumerTransactions).toHaveBeenCalledWith(42n, query);
  });
});
