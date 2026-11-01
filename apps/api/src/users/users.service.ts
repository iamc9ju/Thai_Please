import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PasswordService } from '../auth/password/password.service.js';
import type { ConsumerProfileResponse } from '@thai-please/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async getConsumerProfile(userId: bigint): Promise<ConsumerProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        fullName: true,
        citizenId: true,
        phone: true,
        addressLine: true,
        subdistrict: true,
        district: true,
        province: true,
        postalCode: true,
      },
    });
    if (!user) throw new NotFoundException('PROFILE_NOT_FOUND');
    const address = [
      user.addressLine,
      user.subdistrict,
      user.district,
      user.province,
      user.postalCode,
    ]
      .filter((part) => part?.trim())
      .join(' ');
    return {
      fullName: user.fullName,
      maskedCitizenId: `X-XXXX-${user.citizenId.slice(-4)}`,
      role: 'CONSUMER',
      phone: user.phone,
      address: address || null,
    };
  }

  private sanitizeUser<T extends { passwordHash?: string }>(
    user: T,
  ): Omit<T, 'passwordHash'> {
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
      throw new ConflictException(
        `User with citizen ID ${dto.citizenId} already exists`,
      );
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const role = dto.role ?? 'CONSUMER';
    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          citizenId: dto.citizenId,
          fullName: dto.fullName,
          phone: dto.phone ?? null,
          role,
          passwordHash,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.userId,
          role,
          status: 'ACTIVE',
        },
      });

      return user;
    });

    return this.sanitizeUser(newUser);
  }
}
