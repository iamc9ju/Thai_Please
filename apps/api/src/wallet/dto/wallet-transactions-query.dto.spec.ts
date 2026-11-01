import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { WalletTransactionsQueryDto } from './wallet-transactions-query.dto.js';

async function validateQuery(input: Record<string, unknown>) {
  return validate(plainToInstance(WalletTransactionsQueryDto, input));
}

describe('WalletTransactionsQueryDto', () => {
  it('accepts strict dates, a bounded limit, and an opaque cursor', async () => {
    await expect(
      validateQuery({
        dateFrom: '2026-10-01',
        dateTo: '2026-10-14',
        limit: '100',
        cursor: 'YWJjLTEyMw',
      }),
    ).resolves.toHaveLength(0);
  });

  it.each([
    ['2026-2-01', '2026-10-14'],
    ['2026-02-30', '2026-10-14'],
    ['2026-10-01T00:00:00.000Z', '2026-10-14'],
    ['2026-10-15', '2026-10-14'],
  ])('rejects invalid date range %s to %s', async (dateFrom, dateTo) => {
    const errors = await validateQuery({ dateFrom, dateTo });

    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([0, 101, 1.5])('rejects invalid limit %s', async (limit) => {
    const errors = await validateQuery({ limit });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejects a non-base64url cursor', async () => {
    const errors = await validateQuery({ cursor: 'not valid!' });

    expect(errors.some((error) => error.property === 'cursor')).toBe(true);
  });
});
