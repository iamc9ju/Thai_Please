import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import { hashToken } from '../common/security/token.js';
import { SystemClock } from '../common/time/clock.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { AUTH_METADATA } from './auth.constants.js';
import type { AuthenticatedRequest } from './current-actor.decorator.js';

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly clock: SystemClock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(AUTH_METADATA.public, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    if (token === undefined || token.length < 32) {
      throw new DomainException(
        DOMAIN_ERRORS.unauthorized,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const session = await this.prisma.authSession.findFirst({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        expiresAt: { gt: this.clock.now() },
      },
      include: { user: true },
    });
    if (session === null) {
      throw new DomainException(
        DOMAIN_ERRORS.unauthorized,
        HttpStatus.UNAUTHORIZED,
      );
    }
    request.actor = {
      sessionId: session.id,
      userId: session.userId,
      role: session.user.role,
    };
    return true;
  }
}
