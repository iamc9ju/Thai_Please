import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';

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
}
