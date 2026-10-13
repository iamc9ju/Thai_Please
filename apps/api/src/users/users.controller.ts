import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
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

  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  async findById(@Param('id') id: string) {
    try {
      const bigintId = BigInt(id);
      return await this.usersService.findById(bigintId);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundException') {
        throw err;
      }
      throw new BadRequestException('Invalid user ID format');
    }
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
