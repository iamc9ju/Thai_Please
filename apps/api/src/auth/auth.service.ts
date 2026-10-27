import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActiveRole } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type {
  RegisterConsumerDto,
  RegisterMerchantDto,
} from './dto/register.dto.js';
import { PasswordService } from './password/password.service.js';
import { parseValidBirthDate } from './birth-date.js';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';

const IDENTITY_DATA_MISMATCH_CODE = 'IDENTITY_DATA_MISMATCH';
const IDENTITY_DATA_MISMATCH_MESSAGE =
  'ข้อมูลส่วนบุคคลไม่ตรงกับบัญชีที่ลงทะเบียนไว้ กรุณาตรวจสอบข้อมูลหรือติดต่อผู้ดูแลระบบ';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly rateLimiter: LoginRateLimiterService = new LoginRateLimiterService(),
  ) {}

  private hashJti(jti: string): string {
    return createHash('sha256').update(jti).digest('hex');
  }

  private normalizeIdentityText(value: string | null | undefined): string {
    return (value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
  }

  private assertExistingIdentityMatches(
    existingUser: {
      title: string | null;
      firstName: string | null;
      lastName: string | null;
      dateOfBirth: Date | null;
    },
    registration: {
      title: string;
      firstName: string;
      lastName: string;
      birthDate: Date;
    },
  ): void {
    const textMatches =
      this.normalizeIdentityText(existingUser.title) ===
        this.normalizeIdentityText(registration.title) &&
      this.normalizeIdentityText(existingUser.firstName) ===
        this.normalizeIdentityText(registration.firstName) &&
      this.normalizeIdentityText(existingUser.lastName) ===
        this.normalizeIdentityText(registration.lastName);
    const birthDateMatches =
      existingUser.dateOfBirth?.getTime() === registration.birthDate.getTime();

    if (!textMatches || !birthDateMatches) {
      throw new ConflictException({
        code: IDENTITY_DATA_MISMATCH_CODE,
        message: IDENTITY_DATA_MISMATCH_MESSAGE,
      });
    }
  }

  async login(dto: LoginDto, role: ActiveRole, clientIp?: string) {
    // 0. ตรวจสอบ Rate Limit / Brute-force protection (FR-AUTH-03)
    this.rateLimiter.assertAllowed(role, dto.citizenId, clientIp);

    const failLogin = (): never => {
      this.rateLimiter.recordFailure(role, dto.citizenId, clientIp);
      throw new UnauthorizedException(
        'เลขประจำตัวประชาชนหรือรหัสผ่านไม่ถูกต้อง',
      );
    };

    // 1. ดึง user พร้อม roles โดยใช้ citizenId (camelCase)
    const user = await this.prisma.user.findUnique({
      where: { citizenId: dto.citizenId },
      include: {
        roles: true,
      },
    });

    if (!user) return failLogin();

    // 2. ตรวจ password hash
    if (!(await this.passwords.verify(dto.password, user.passwordHash))) {
      return failLogin();
    }

    // 3. ตรวจ user status
    if (user.status !== 'ACTIVE') {
      this.rateLimiter.recordFailure(role, dto.citizenId, clientIp);
      throw new UnauthorizedException('บัญชีนี้ถูกระงับการใช้งาน');
    }

    // 4. ตรวจว่ามี role ตรงกับ portal และ ACTIVE อยู่
    const hasRole = user.roles.some(
      (r) => r.role === role && r.status === 'ACTIVE',
    );
    if (!hasRole) return failLogin();

    // 5. กรณี MERCHANT: ดึง merchant ของ user
    let merchantId: bigint | null = null;
    if (role === 'MERCHANT') {
      const merchant = await this.prisma.merchant.findFirst({
        where: { ownerUserId: user.userId },
      });
      if (!merchant) return failLogin();
      merchantId = merchant.merchantId;
    }

    // ล้างสถิติการเข้าสู่ระบบผิดพลาดเมื่อยืนยันตัวตนสำเร็จ
    this.rateLimiter.clearFailures(role, dto.citizenId, clientIp);

    // 6. Sign JWT
    const jti = randomUUID();
    const sessionDurationMs =
      this.config.getOrThrow<number>('AUTH_SESSION_TTL_SECONDS') * 1000;
    const expiresAt = new Date(Date.now() + sessionDurationMs);

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
    const birthDate = parseValidBirthDate(dto.birthDate);
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

      if (
        existingUser.status !== 'ACTIVE' ||
        !(await this.passwords.verify(dto.password, existingUser.passwordHash))
      ) {
        throw new UnauthorizedException(
          'ไม่สามารถเพิ่มบทบาทให้บัญชีเดิมได้ กรุณาตรวจสอบข้อมูลเข้าสู่ระบบ',
        );
      }

      this.assertExistingIdentityMatches(existingUser, {
        title: dto.title,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate,
      });
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
    const passwordHash = await this.passwords.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      let user = existingUser;

      if (!user) {
        user = await tx.user.create({
          data: {
            citizenId: dto.citizenId,
            fullName: `${dto.firstName} ${dto.lastName}`.trim(),
            phone: dto.phone,
            role: 'CONSUMER',
            passwordHash,
            title: dto.title,
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: birthDate,
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

      // มอบหมายภารกิจเริ่มต้นให้ประชาชนโดยอัตโนมัติ (FR-C07 / FR-S05)
      const defaultQuests = await tx.quest.findMany({
        orderBy: { questId: 'asc' },
        take: 3,
      });
      const assignedAt = new Date();
      for (const q of defaultQuests) {
        const existingAssignment = await tx.userQuest.findFirst({
          where: { userId: user.userId, questId: q.questId },
        });
        if (!existingAssignment) {
          await tx.userQuest.create({
            data: {
              userId: user.userId,
              questId: q.questId,
              status: 'ACTIVE',
              assignedAt,
              expiresAt: new Date(
                assignedAt.getTime() + q.durationDays * 24 * 60 * 60 * 1000,
              ),
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
    const birthDate = parseValidBirthDate(dto.birthDate);
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

      if (
        existingUser.status !== 'ACTIVE' ||
        !(await this.passwords.verify(dto.password, existingUser.passwordHash))
      ) {
        throw new UnauthorizedException(
          'ไม่สามารถเพิ่มบทบาทให้บัญชีเดิมได้ กรุณาตรวจสอบข้อมูลเข้าสู่ระบบ',
        );
      }

      this.assertExistingIdentityMatches(existingUser, {
        title: dto.title,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate,
      });
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
    const passwordHash = await this.passwords.hash(dto.password);

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
            passwordHash,
            title: dto.title,
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: birthDate,
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
          merchantTypes: dto.merchantTypes,
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
        merchantTypes: merchant.merchantTypes,
      };
    });
  }
}
