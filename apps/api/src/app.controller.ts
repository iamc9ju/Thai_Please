import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  getLiveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async getReadiness(): Promise<{ status: string; database: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  }
}
