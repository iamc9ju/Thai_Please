import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { BearerAuthGuard } from './bearer-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    BearerAuthGuard,
    { provide: APP_GUARD, useExisting: BearerAuthGuard },
  ],
})
export class AuthModule {}
