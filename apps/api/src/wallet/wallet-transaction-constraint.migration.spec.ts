import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { LegacyTransactionType, TransactionType } from './wallet.constants.js';

const migrationUrl = new URL(
  '../../prisma/migrations/20261015090000_allow_personal_topup_transaction_type/migration.sql',
  import.meta.url,
);

describe('FR-C02 wallet transaction type constraint migration', () => {
  it('replaces and validates the named constraint in an atomic migration', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS "wallet_transactions_transaction_type_check"',
    );
    expect(sql).toMatch(
      /ADD CONSTRAINT "wallet_transactions_transaction_type_check"[\s\S]*?NOT VALID;/,
    );
    expect(sql).toContain(
      'VALIDATE CONSTRAINT "wallet_transactions_transaction_type_check"',
    );
    expect(sql).toContain('COMMIT;');

    const addPosition = sql.indexOf('ADD CONSTRAINT');
    const validatePosition = sql.indexOf('VALIDATE CONSTRAINT');
    expect(addPosition).toBeGreaterThan(-1);
    expect(validatePosition).toBeGreaterThan(addPosition);
  });

  it('allows exactly all current transaction types and the legacy TOPUP value', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    const check = sql.match(
      /CHECK\s*\(\s*"transaction_type"\s+IN\s*\(([\s\S]*?)\)\s*\)\s*NOT VALID/i,
    );

    expect(check).not.toBeNull();

    const migratedValues = [...(check?.[1] ?? '').matchAll(/'([^']+)'/g)]
      .map((match) => match[1])
      .sort();
    const expectedValues = [
      ...Object.values(TransactionType),
      ...Object.values(LegacyTransactionType),
    ].sort();

    expect(migratedValues).toEqual(expectedValues);
  });

  it('does not rewrite ledger data', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    const executableSql = sql.replace(/^\s*--.*$/gm, '');

    expect(executableSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  });
});
