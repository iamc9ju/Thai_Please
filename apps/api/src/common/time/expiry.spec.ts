import { describe, expect, it } from 'vitest';
import { isUnexpired } from './expiry.js';

describe('exclusive expiry boundary', () => {
  it('treats the exact expiry instant as expired', () => {
    const now = new Date('2026-10-06T00:00:00.000Z');
    expect(isUnexpired(now, now)).toBe(false);
    expect(isUnexpired(new Date(now.getTime() + 1), now)).toBe(true);
  });
});
