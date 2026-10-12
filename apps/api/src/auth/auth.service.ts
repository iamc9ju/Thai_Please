import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import { PrototypePolicyService } from '../common/policy/prototype-policy.service.js';
import { createOpaqueToken, hashToken } from '../common/security/token.js';
import { SystemClock } from '../common/time/clock.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import type { LoginResponseDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PrototypePolicyService,
    private readonly clock: SystemClock,
  ) {}

  async login(citizenId: string): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { citizenId } });
    if (user === null) {
      throw new DomainException(
        DOMAIN_ERRORS.citizenNotFound,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const token = createOpaqueToken();
    const expiresAt = this.policy.addSeconds(
      this.clock.now(),
      this.policy.authSessionTtlSeconds,
    );
    await this.prisma.authSession.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });
    return {
      access_token: token,
      token_type: 'Bearer',
      expires_at: expiresAt.toISOString(),
      user: { id: user.id, display_name: user.displayName, role: user.role },
    };
  }
}
