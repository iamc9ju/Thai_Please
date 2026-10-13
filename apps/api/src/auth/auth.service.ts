import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type {
  RegisterConsumerDto,
  RegisterMerchantDto,
} from './dto/register.dto.js';

type ActiveRole = 'CONSUMER' | 'MERCHANT' | 'ADMIN';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  private hashJti(jti: string): string {
    return createHash('sha256').update(jti).digest('hex');
  }

  async login(dto: LoginDto, role: ActiveRole) {
    const invalidCredentialsError = new UnauthorizedException(
      'เลขประจำตัวประชาชนหรือรหัสผ่านไม่ถูกต้อง',
    );

    // 1. ดึง user พร้อม roles โดยใช้ citizenId (camelCase)
    const user = await this.prisma.user.findUnique({
      where: { citizenId: dto.citizenId },
      include: {
        roles: true,
      },
    });

    if (!user) throw invalidCredentialsError;

    // 2. ตรวจ password hash
    if (user.passwordHash !== this.hashPassword(dto.password)) {
      throw invalidCredentialsError;
    }

    // 3. ตรวจ user status
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('บัญชีนี้ถูกระงับการใช้งาน');
    }

    // 4. ตรวจว่ามี role ตรงกับ portal และ ACTIVE อยู่
    const hasRole = user.roles.some(
      (r) => r.role === role && r.status === 'ACTIVE',
    );
    if (!hasRole) throw invalidCredentialsError;

    // 5. กรณี MERCHANT: ดึง merchant ของ user
    let merchantId: bigint | null = null;
    if (role === 'MERCHANT') {
      const merchant = await this.prisma.merchant.findFirst({
        where: { ownerUserId: user.userId },
      });
      if (!merchant) throw invalidCredentialsError;
      merchantId = merchant.merchantId;
    }

    // 6. Sign JWT
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const token = this.jwtService.sign({
      sub: user.userId.toString(),
      role,
      mid: merchantId?.toString() ?? null,
      jti,
    });

    // 7. บันทึก session ลง auth_sessions
    await this.prisma.authSession.create({
      data: {
        userId: user.userId,
        tokenHash: this.hashJti(jti),
        activeRole: role,
        activeMerchantId: merchantId,
        expiresAt,
      },
    });

    // 8. อัปเดต lastLoginAt
    await this.prisma.user.update({
      where: { userId: user.userId },
      data: { lastLoginAt: new Date() },
    });

    return {
      token,
      user: {
        fullName: user.fullName,
        role,
      },
    };
  }

  async logout(sessionId: bigint): Promise<void> {
    await this.prisma.authSession.update({
      where: { authSessionId: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async registerConsumer(dto: RegisterConsumerDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { citizenId: dto.citizenId },
      include: { roles: true },
    });

    if (existingUser) {
      const hasConsumerRole = existingUser.roles.some(
        (r) => r.role === 'CONSUMER',
      );
      if (hasConsumerRole) {
        throw new ConflictException(
          'เลขประจำตัวประชาชนนี้ได้ลงทะเบียนเป็นประชาชนแล้ว',
        );
      }
    }

    const addressParts = [
      dto.homeNumber,
      dto.village ? `หมู่ ${dto.village}` : null,
      dto.building ? `อาคาร ${dto.building}` : null,
      dto.floor ? `ชั้น ${dto.floor}` : null,
      dto.room ? `ห้อง ${dto.room}` : null,
      dto.alley ? `ซอย ${dto.alley}` : null,
      dto.road ? `ถนน ${dto.road}` : null,
    ].filter(Boolean);
    const addressLine = addressParts.join(' ');

    return this.prisma.$transaction(async (tx) => {
      let user = existingUser;

      if (!user) {
        user = await tx.user.create({
          data: {
            citizenId: dto.citizenId,
            fullName: `${dto.firstName} ${dto.lastName}`.trim(),
            phone: dto.phone,
            role: 'CONSUMER',
            passwordHash: this.hashPassword(dto.password),
            title: dto.title,
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: new Date(dto.birthDate),
            addressLine,
            subdistrict: dto.subdistrict,
            district: dto.district,
            province: dto.province,
            postalCode: dto.postalCode,
            termsAcceptedAt: dto.acceptTerms ? new Date() : null,
            privacyAcceptedAt: dto.acceptPrivacy ? new Date() : null,
            status: 'ACTIVE',
          },
          include: { roles: true },
        });
      }

      await tx.userRole.create({
        data: {
          userId: user.userId,
          role: 'CONSUMER',
          status: 'ACTIVE',
        },
      });

      const existingWallet = await tx.wallet.findUnique({
        where: { userId: user.userId },
      });

      if (!existingWallet) {
        const now = new Date();
        const activeProgram = await tx.subsidyProgram.findFirst({
          where: {
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
          },
        });

        const initialGrant = activeProgram ? activeProgram.initialGrant : 0;

        const wallet = await tx.wallet.create({
          data: {
            userId: user.userId,
            walletType: 'CONSUMER',
            personalBalance: 0,
            subsidyBalance: initialGrant,
            subsidyProgramId: activeProgram?.programId ?? null,
            status: 'ACTIVE',
          },
        });

        if (activeProgram && Number(initialGrant) > 0) {
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.walletId,
              programId: activeProgram.programId,
              fundType: 'SUBSIDY',
              transactionType: 'SUBSIDY_GRANT',
              amount: initialGrant,
              balanceBefore: 0,
              balanceAfter: initialGrant,
              businessRef: `grant_${wallet.walletId}_${Date.now()}`,
              correlationId: randomUUID(),
              userId: user.userId,
              walletTypeSnapshot: 'CONSUMER',
            },
          });
        }
      }

      return {
        success: true,
        citizenId: user.citizenId,
        fullName: user.fullName,
      };
    });
  }

  async registerMerchant(dto: RegisterMerchantDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { citizenId: dto.citizenId },
      include: { roles: true },
    });

    if (existingUser) {
      const hasMerchantRole = existingUser.roles.some(
        (r) => r.role === 'MERCHANT',
      );
      if (hasMerchantRole) {
        throw new ConflictException(
          'เลขประจำตัวประชาชนนี้ได้ลงทะเบียนร้านค้าแล้ว',
        );
      }
    }

    const existingMerchant = await this.prisma.merchant.findFirst({
      where: { merchantName: dto.merchantName },
    });
    if (existingMerchant) {
      throw new ConflictException('ชื่อร้านค้านี้มีในระบบแล้ว');
    }

    const addressParts = [
      dto.homeNumber,
      dto.village ? `หมู่ ${dto.village}` : null,
      dto.building ? `อาคาร ${dto.building}` : null,
      dto.floor ? `ชั้น ${dto.floor}` : null,
      dto.room ? `ห้อง ${dto.room}` : null,
      dto.alley ? `ซอย ${dto.alley}` : null,
      dto.road ? `ถนน ${dto.road}` : null,
    ].filter(Boolean);
    const addressLine = addressParts.join(' ');

    const merchantFullAddress = [
      dto.merchantAddress,
      dto.merchantSubdistrict ? `ต./แขวง ${dto.merchantSubdistrict}` : null,
      dto.merchantDistrict ? `อ./เขต ${dto.merchantDistrict}` : null,
      dto.merchantProvince ? `จ. ${dto.merchantProvince}` : null,
      dto.merchantPostalCode,
    ]
      .filter(Boolean)
      .join(' ');

    return this.prisma.$transaction(async (tx) => {
      let user = existingUser;

      if (!user) {
        user = await tx.user.create({
          data: {
            citizenId: dto.citizenId,
            fullName: `${dto.firstName} ${dto.lastName}`.trim(),
            phone: dto.phone,
            role: 'MERCHANT',
            passwordHash: this.hashPassword(dto.password),
            title: dto.title,
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: new Date(dto.birthDate),
            addressLine,
            subdistrict: dto.subdistrict,
            district: dto.district,
            province: dto.province,
            postalCode: dto.postalCode,
            termsAcceptedAt: dto.acceptTerms ? new Date() : null,
            privacyAcceptedAt: dto.acceptPrivacy ? new Date() : null,
            status: 'ACTIVE',
          },
          include: { roles: true },
        });
      }

      await tx.userRole.create({
        data: {
          userId: user.userId,
          role: 'MERCHANT',
          status: 'ACTIVE',
        },
      });

      const merchant = await tx.merchant.create({
        data: {
          ownerUserId: user.userId,
          merchantName: dto.merchantName,
          description: dto.merchantDescription,
          address: merchantFullAddress,
          phone: dto.merchantPhone,
          status: 'PENDING',
        },
      });

      await tx.wallet.create({
        data: {
          merchantId: merchant.merchantId,
          walletType: 'MERCHANT',
          merchantBalance: 0,
          personalBalance: 0,
          subsidyBalance: 0,
          status: 'ACTIVE',
        },
      });

      return {
        success: true,
        merchantId: merchant.merchantId.toString(),
        merchantName: merchant.merchantName,
      };
    });
  }
}


