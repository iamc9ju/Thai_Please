import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TopUpDto } from './top-up.dto.js';

async function validateTopUp(amount: number, idempotencyKey = 'valid-key-123') {
  const dto = new TopUpDto();
  dto.amount = amount;
  dto.idempotencyKey = idempotencyKey;
  return validate(dto);
}

describe('TopUpDto FR-C02 validation', () => {
  it.each([1, 50_000])('accepts integer-baht boundary %s', async (amount) => {
    await expect(validateTopUp(amount)).resolves.toHaveLength(0);
  });

  it.each([0, -1, 50_001, 1.5])('rejects invalid amount %s', async (amount) => {
    const errors = await validateTopUp(amount);

    expect(errors.some((error) => error.property === 'amount')).toBe(true);
  });

  it('requires an idempotency key of bounded length', async () => {
    const tooShort = await validateTopUp(100, 'short');
    const tooLong = await validateTopUp(100, 'x'.repeat(129));

    expect(tooShort.some((error) => error.property === 'idempotencyKey')).toBe(
      true,
    );
    expect(tooLong.some((error) => error.property === 'idempotencyKey')).toBe(
      true,
    );
  });
});
