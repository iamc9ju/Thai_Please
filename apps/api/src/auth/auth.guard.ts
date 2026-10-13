import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

export type JwtPayload = {
  sub: string; // userId
  role: string;
  mid: string | null;
  jti: string;
};

export type AuthenticatedUser = {
  userId: bigint;
  citizenId: string;
  fullName: string;
  role: string;
  activeMerchantId: bigint | null;
  sessionId: bigint;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private hashJti(jti: string): string {
    return createHash('sha256').update(jti).digest('hex');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.['access_token'];

    if (!token) {
      throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    const tokenHash = this.hashJti(payload.jti);

    // ตรวจสอบในตาราง auth_sessions
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('ไม่พบเซสชันการใช้งาน');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('เซสชันนี้ถูกยกเลิกแล้ว');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('เซสชันหมดอายุแล้ว');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('บัญชีผู้ใช้ถูกระงับการใช้งาน');
    }

    // อัปเดตเวลา lastUsedAt ของ session
    await this.prisma.authSession.update({
      where: { authSessionId: session.authSessionId },
      data: { lastUsedAt: new Date() },
    });

    request.user = {
      userId: session.user.userId,
      citizenId: session.user.citizenId,
      fullName: session.user.fullName,
      role: session.activeRole,
      activeMerchantId: session.activeMerchantId,
      sessionId: session.authSessionId,
    };

    return true;
  }
}
