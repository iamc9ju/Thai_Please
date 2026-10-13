import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  private sanitizeUser<T extends { password_hash?: string }>(user: T): Omit<T, 'password_hash'> {
    const { password_hash: _password_hash, ...safeUser } = user;
    return safeUser;
  }

  async findAll() {
    const users = await this.prisma.users.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return users.map((u) => this.sanitizeUser(u));
  }

  async findById(id: bigint) {
    const user = await this.prisma.users.findUnique({
      where: { user_id: id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.sanitizeUser(user);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.users.findUnique({
      where: { citizen_id: dto.citizenId },
    });
    if (existing) {
      throw new ConflictException(`User with citizen ID ${dto.citizenId} already exists`);
    }

    const newUser = await this.prisma.users.create({
      data: {
        citizen_id: dto.citizenId,
        full_name: dto.fullName,
        phone: dto.phone ?? null,
        role: dto.role ?? 'CONSUMER',
        password_hash: this.hashPassword(dto.password),
      },
    });

    return this.sanitizeUser(newUser);
  }
}
