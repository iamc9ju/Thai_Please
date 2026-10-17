import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './authorization/roles.guard.js';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';
import { PasswordService } from './password/password.service.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<number>('AUTH_SESSION_TTL_SECONDS'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    LoginRateLimiterService,
    PasswordService,
    RolesGuard,
  ],
  exports: [
    AuthService,
    AuthGuard,
    LoginRateLimiterService,
    PasswordService,
    RolesGuard,
    JwtModule,
  ],
})
export class AuthModule {}
