import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import {
  RegisterConsumerDto,
  RegisterMerchantDto,
} from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register/consumer')
  @HttpCode(HttpStatus.CREATED)
  async registerConsumer(@Body() dto: RegisterConsumerDto) {
    return this.authService.registerConsumer(dto);
  }

  @Post('register/merchant')
  @HttpCode(HttpStatus.CREATED)
  async registerMerchant(@Body() dto: RegisterMerchantDto) {
    return this.authService.registerMerchant(dto);
  }

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

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Req() req: Request) {
    const user = req.user!;
    return {
      user: {
        userId: user.userId.toString(),
        citizenId: user.citizenId,
        fullName: user.fullName,
        role: user.role,
        activeMerchantId: user.activeMerchantId?.toString() ?? null,
      },
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.user!.sessionId;
    await this.authService.logout(sessionId);
    this.clearAuthCookie(res);
    return { success: true };
  }

  private setAuthCookie(res: Response, token: string): void {
    const maxAge =
      this.config.getOrThrow<number>('AUTH_SESSION_TTL_SECONDS') * 1000;
    const isProduction =
      this.config.getOrThrow<string>('NODE_ENV') === 'production';

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge,
      path: '/',
    });
  }

  private clearAuthCookie(res: Response): void {
    const isProduction =
      this.config.getOrThrow<string>('NODE_ENV') === 'production';

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }
}
