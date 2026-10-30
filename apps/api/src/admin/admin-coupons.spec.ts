import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';
import { CreateAdminCouponDto } from './dto/admin.dto.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const input = {
  idempotencyKey: '7e3a2360-e013-4dcf-83b6-d74bf4c0a5b1',
  couponName: 'Test coupon',
  discountType: 'FIXED',
  discountValue: '10.25',
  pointCost: 100,
  minPurchase: '50.00',
  validityDays: 7,
  status: 'ACTIVE',
} satisfies CreateAdminCouponDto;
const coupon = {
  couponId: 1n,
  ...input,
  description: null,
  merchantId: null,
  merchant: null,
  createdAt: new Date('2026-10-30T00:00:00Z'),
  _count: { userCoupons: 0 },
};
function setup() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ coupon_id: 1n }]),
    coupon: {
      findMany: vi.fn().mockResolvedValue([coupon]),
      findUnique: vi.fn().mockResolvedValue(coupon),
      create: vi.fn().mockResolvedValue(coupon),
      update: vi.fn().mockResolvedValue(coupon),
      delete: vi.fn().mockResolvedValue(coupon),
    },
    userCoupon: { count: vi.fn().mockResolvedValue(0) },
    auditEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(
      async (action: (client: typeof tx) => Promise<unknown>) => action(tx),
    ),
  };
  // The test double implements only the delegates used by this use case; no database behavior is claimed.
  return { tx, service: new AdminService(prisma as unknown as PrismaService) };
}
describe('FR-A01 admin coupon catalogue', () => {
  it('pages by descending identifier without losing older coupons', async () => {
    const { tx, service } = setup();
    tx.coupon.findMany.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => ({
        ...coupon,
        couponId: BigInt(201 - index),
      })),
    );
    const page = await service.listCoupons(202n);
    expect(page.items).toHaveLength(100);
    expect(page.nextCursor).toBe('102');
    expect(tx.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { couponId: { lt: 202n } },
        orderBy: { couponId: 'desc' },
        take: 101,
      }),
    );
  });
  it('creates exact decimal amounts and an audit event in the transaction', async () => {
    const { tx, service } = setup();
    expect(await service.createCoupon(input, 9n)).toMatchObject({
      couponId: '1',
      discountValue: 10.25,
    });
    // PostgreSQL advisory locks return void; select a scalar so Prisma can deserialize the result.
    expect(tx.$queryRaw.mock.calls[0]?.[0].join('')).toContain(
      'SELECT 1 AS locked FROM pg_advisory_xact_lock(',
    );
    const args = tx.coupon.create.mock.calls[0]?.[0];
    expect(args.data.discountValue.toString()).toBe('10.25');
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 9n,
          targetId: '1',
          correlationId: input.idempotencyKey,
        }),
      }),
    );
  });
  it('replays the original coupon on a repeated creation key', async () => {
    const { tx, service } = setup();
    await service.createCoupon(input, 9n);
    const prior = tx.auditEvent.create.mock.calls[0]?.[0].data;
    tx.auditEvent.findFirst.mockResolvedValue(prior);
    tx.coupon.create.mockClear();
    expect(await service.createCoupon(input, 9n)).toMatchObject({
      couponId: '1',
    });
    expect(tx.coupon.create).not.toHaveBeenCalled();
  });
  it('rejects reuse of a creation key with a different payload', async () => {
    const { tx, service } = setup();
    await service.createCoupon(input, 9n);
    tx.auditEvent.findFirst.mockResolvedValue(
      tx.auditEvent.create.mock.calls[0]?.[0].data,
    );
    tx.coupon.create.mockClear();
    await expect(
      service.createCoupon({ ...input, pointCost: 200 }, 9n),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.coupon.create).not.toHaveBeenCalled();
  });
  it.each(['-1', '1.001', '1e3', 'NaN'])(
    'rejects invalid precise money %s before creation',
    async (value) => {
      const { tx, service } = setup();
      await expect(
        service.createCoupon({ ...input, discountValue: value }, 9n),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.coupon.create).not.toHaveBeenCalled();
    },
  );
  it('rejects percentages above 100', async () => {
    const { service } = setup();
    await expect(
      service.createCoupon(
        { ...input, discountType: 'PERCENTAGE', discountValue: '100.01' },
        9n,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('updates a never-issued coupon and audits it', async () => {
    const { tx, service } = setup();
    await service.updateCoupon(1n, input, 9n);
    expect(tx.coupon.update).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });
  it('blocks edits and deletes after issuance', async () => {
    const { tx, service } = setup();
    tx.userCoupon.count.mockResolvedValue(1);
    await expect(service.updateCoupon(1n, input, 9n)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.deleteCoupon(1n, 9n)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.coupon.update).not.toHaveBeenCalled();
    expect(tx.coupon.delete).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it('deletes never-issued coupons and audits deletion', async () => {
    const { tx, service } = setup();
    await service.deleteCoupon(1n, 9n);
    expect(tx.coupon.delete).toHaveBeenCalledWith({ where: { couponId: 1n } });
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });
  it('does not mutate missing coupons', async () => {
    const { tx, service } = setup();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.deleteCoupon(1n, 9n)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.coupon.delete).not.toHaveBeenCalled();
  });
  it('validates positive points and rejects unknown input fields at the HTTP boundary', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        { ...input, pointCost: 0 },
        { type: 'body', metatype: CreateAdminCouponDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        { ...input, merchantId: '123' },
        { type: 'body', metatype: CreateAdminCouponDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
