import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
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
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
