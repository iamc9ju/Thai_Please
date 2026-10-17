import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ActiveRole } from './auth.types.js';

export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_LIMITED_CODE = 'AUTH_RATE_LIMITED';

interface AttemptBucket {
  count: number;
  windowStartedAtMs: number;
}

@Injectable()
export class LoginRateLimiterService {
  private readonly buckets = new Map<string, AttemptBucket>();

  private buildBucketKey(
    role: ActiveRole,
    citizenId: string,
    clientIp = 'unknown',
  ): string {
    const hashedSubject = createHash('sha256')
      .update(`${role}:${citizenId}:${clientIp}`)
      .digest('hex');
    return `login-attempt:${hashedSubject}`;
  }

  assertAllowed(
    role: ActiveRole,
    citizenId: string,
    clientIp?: string,
    nowMs = Date.now(),
  ): void {
    const key = this.buildBucketKey(role, citizenId, clientIp);
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return;
    }

    const elapsedMs = nowMs - bucket.windowStartedAtMs;
    if (elapsedMs >= LOGIN_LOCKOUT_WINDOW_MS) {
      this.buckets.delete(key);
      return;
    }

    if (bucket.count >= LOGIN_MAX_FAILED_ATTEMPTS) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((LOGIN_LOCKOUT_WINDOW_MS - elapsedMs) / 1000),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: AUTH_RATE_LIMITED_CODE,
          message:
            'พยายามเข้าสู่ระบบผิดพลาดเกินจำนวนครั้งที่กำหนด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(
    role: ActiveRole,
    citizenId: string,
    clientIp?: string,
    nowMs = Date.now(),
  ): void {
    const key = this.buildBucketKey(role, citizenId, clientIp);
    const existing = this.buckets.get(key);

    if (
      !existing ||
      nowMs - existing.windowStartedAtMs >= LOGIN_LOCKOUT_WINDOW_MS
    ) {
      this.buckets.set(key, {
        count: 1,
        windowStartedAtMs: nowMs,
      });
      return;
    }

    existing.count += 1;
  }

  clearFailures(role: ActiveRole, citizenId: string, clientIp?: string): void {
    const key = this.buildBucketKey(role, citizenId, clientIp);
    this.buckets.delete(key);
  }
}
