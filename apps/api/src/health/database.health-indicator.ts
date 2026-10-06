import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { HEALTH_KEYS } from './health.constants.js';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async check() {
    const indicator = this.healthIndicatorService.check(HEALTH_KEYS.database);

    try {
      await this.prisma.ping();
      return indicator.up();
    } catch {
      return indicator.down();
    }
  }
}
