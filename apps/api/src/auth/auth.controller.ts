import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto, LoginResponseDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with an existing 13-digit citizen ID only' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(body.citizen_id);
  }
}
