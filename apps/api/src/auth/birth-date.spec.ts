import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseValidBirthDate } from './birth-date.js';

describe('parseValidBirthDate', () => {
  const now = new Date('2026-10-14T03:00:00.000Z');

  it('parses a valid calendar date', () => {
    expect(parseValidBirthDate('2000-02-29', now).toISOString()).toBe(
      '2000-02-29T00:00:00.000Z',
    );
  });

  it.each(['2026-02-30', '2026-10-15', '14-10-2000'])(
    '%s is rejected',
    (value) => {
      expect(() => parseValidBirthDate(value, now)).toThrow(
        BadRequestException,
      );
    },
  );
});
