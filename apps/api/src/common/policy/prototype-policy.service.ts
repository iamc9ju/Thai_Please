import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.js';

export const PROTOTYPE_MONEY = {
  currency: 'THB',
  unit: 'INTEGER_BAHT',
} as const;

@Injectable()
export class PrototypePolicyService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get authSessionTtlSeconds(): number {
    return this.config.get('AUTH_SESSION_TTL_SECONDS', { infer: true });
  }
  get couponTtlDays(): number {
    return this.config.get('COUPON_TTL_DAYS', { infer: true });
  }
  get dailySubsidyCap(): number {
    return this.config.get('DAILY_SUBSIDY_CAP_BAHT', { infer: true });
  }
  get initialSubsidy(): number {
    return this.config.get('INITIAL_SUBSIDY_BAHT', { infer: true });
  }
  get maxTopup(): number {
    return this.config.get('MAX_TOPUP_BAHT', { infer: true });
  }
  get pointTtlDays(): number {
    return this.config.get('POINT_TTL_DAYS', { infer: true });
  }
  get qrTtlSeconds(): number {
    return this.config.get('QR_TTL_SECONDS', { infer: true });
  }
  get questTtlDays(): number {
    return this.config.get('QUEST_TTL_DAYS', { infer: true });
  }
  get subsidyPercent(): number {
    return this.config.get('SUBSIDY_PERCENT', { infer: true });
  }

  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86_400_000);
  }

  addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1_000);
  }

  bangkokDayBounds(date: Date): { start: Date; end: Date } {
    const bangkokOffsetMs = 7 * 60 * 60 * 1_000;
    const shifted = date.getTime() + bangkokOffsetMs;
    const startShifted = Math.floor(shifted / 86_400_000) * 86_400_000;
    return {
      start: new Date(startShifted - bangkokOffsetMs),
      end: new Date(startShifted + 86_400_000 - bangkokOffsetMs),
    };
  }
}
