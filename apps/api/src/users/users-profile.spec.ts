import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PasswordService } from '../auth/password/password.service.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { ROLES_METADATA_KEY } from '../auth/authorization/roles.decorator.js';
const fixture = {
  fullName: 'Profile fixture',
  citizenId: '1000000001234',
  phone: '0812345678',
  addressLine: '99',
  subdistrict: 'A',
  district: 'B',
  province: 'C',
  postalCode: '10200',
};
function setup(value: typeof fixture | null) {
  const findUnique = vi.fn().mockResolvedValue(value);
  const service = new UsersService(
    { user: { findUnique } } as unknown as PrismaService,
    {} as PasswordService,
  );
  return { service, findUnique };
}
describe('FR-C01 private profile', () => {
  it('queries only the owner and allowlisted columns, masks citizen ID', async () => {
    const { service, findUnique } = setup(fixture);
    const result = await service.getConsumerProfile(42n);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 42n },
      select: {
        fullName: true,
        citizenId: true,
        phone: true,
        addressLine: true,
        subdistrict: true,
        district: true,
        province: true,
        postalCode: true,
      },
    });
    expect(result).toEqual({
      fullName: fixture.fullName,
      maskedCitizenId: 'X-XXXX-1234',
      role: 'CONSUMER',
      phone: fixture.phone,
      address: '99 A B C 10200',
    });
    expect(JSON.stringify(result)).not.toContain(fixture.citizenId);
  });
  it('does not fabricate a missing user', async () => {
    await expect(setup(null).service.getConsumerProfile(42n)).rejects.toThrow(
      'PROFILE_NOT_FOUND',
    );
  });
  it('requires authentication and consumer role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toEqual([
      AuthGuard,
      RolesGuard,
    ]);
    expect(
      Reflect.getMetadata(
        ROLES_METADATA_KEY,
        Object.getOwnPropertyDescriptor(UsersController.prototype, 'getProfile')
          ?.value,
      ),
    ).toEqual(['CONSUMER']);
  });

  it('returns authenticated user session info including merchant status and role (FR-AUTH-04)', () => {
    const controller = new UsersController({} as never);
    const mockReq = {
      user: {
        userId: 101n,
        citizenId: '1100000000001',
        fullName: 'เจ้าของ ร้านค้า',
        role: 'MERCHANT',
        activeMerchantId: 301n,
        merchantStatus: 'PENDING',
        merchantName: 'ร้านป้าสมศรี',
        merchantRole: 'OWNER',
        sessionId: 99n,
      },
    };

    const result = controller.getMe(mockReq as never);
    expect(result).toEqual({
      user: {
        userId: '101',
        citizenId: '1100000000001',
        fullName: 'เจ้าของ ร้านค้า',
        role: 'MERCHANT',
        activeMerchantId: '301',
        merchantStatus: 'PENDING',
        merchantName: 'ร้านป้าสมศรี',
        merchantRole: 'OWNER',
      },
    });
  });
});
