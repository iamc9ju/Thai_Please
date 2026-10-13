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

  private sanitizeUser<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return users.map((u) => this.sanitizeUser(u));
  }

  async findById(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { userId: id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.sanitizeUser(user);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { citizenId: dto.citizenId },
    });
    if (existing) {
      throw new ConflictException(`User with citizen ID ${dto.citizenId} already exists`);
    }

    const newUser = await this.prisma.user.create({
      data: {
        citizenId: dto.citizenId,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        role: dto.role,
        passwordHash: this.hashPassword(dto.password),
      },
    });

    return this.sanitizeUser(newUser);
  }
}
