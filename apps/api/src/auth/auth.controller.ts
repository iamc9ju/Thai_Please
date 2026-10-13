import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('consumer/login')
  @HttpCode(HttpStatus.OK)
  async loginConsumer(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, 'CONSUMER');
    this.setAuthCookie(res, result.token);
    return { user: result.user };
  }

  @Post('merchant/login')
  @HttpCode(HttpStatus.OK)
  async loginMerchant(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, 'MERCHANT');
    this.setAuthCookie(res, result.token);
    return { user: result.user };
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async loginAdmin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, 'ADMIN');
    this.setAuthCookie(res, result.token);
    return { user: result.user };
  }

  private setAuthCookie(res: Response, token: string): void {
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }
}
