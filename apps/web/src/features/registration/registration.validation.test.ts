import { describe, expect, it } from 'vitest';
import {
  getBangkokDateInputValue,
  isValidBirthDate,
} from './registration.validation';

describe('birth date validation', () => {
  const today = new Date('2026-10-14T03:00:00.000Z');

  it('uses the Asia/Bangkok calendar date for the picker maximum', () => {
    expect(getBangkokDateInputValue(today)).toBe('2026-10-14');
  });

  it('accepts a real date that is not in the future', () => {
    expect(isValidBirthDate('2000-02-29', today)).toBe(true);
    expect(isValidBirthDate('2026-10-14', today)).toBe(true);
  });

  it('rejects an impossible date and a future date', () => {
    expect(isValidBirthDate('2026-02-30', today)).toBe(false);
    expect(isValidBirthDate('2026-10-15', today)).toBe(false);
  });
});
