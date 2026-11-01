import { readFile } from 'node:fs/promises';
import { MERCHANT_BUSINESS_TYPES } from '@thai-please/contracts';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../prisma/migrations/20261028003000_add_merchant_business_types/migration.sql',
  import.meta.url,
);
const normalizedCategoriesMigrationUrl = new URL(
  '../../prisma/migrations/20261030140000_normalize_merchant_categories/migration.sql',
  import.meta.url,
);

describe('FR-AUTH-02 merchant business types migration', () => {
  it('adds a non-null array column without rewriting existing merchants', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain(
      'ADD COLUMN "merchant_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]',
    );
    expect(sql).toContain(
      'VALIDATE CONSTRAINT "merchants_merchant_types_values_check"',
    );
    expect(sql).toContain('COMMIT;');

    const executableSql = sql.replace(/^\s*--.*$/gm, '');
    expect(executableSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  });

  it('keeps the database allow-list aligned with the API allow-list', async () => {
    const sql = await readFile(normalizedCategoriesMigrationUrl, 'utf8');
    const check = sql.match(/<@\s+ARRAY\[([\s\S]*?)\]::TEXT\[\]/i);
    expect(check).not.toBeNull();

    const migratedValues = [...(check?.[1] ?? '').matchAll(/'([^']+)'/g)]
      .map((match) => match[1])
      .sort();
    expect(migratedValues).toEqual([...MERCHANT_BUSINESS_TYPES].sort());
  });
});
