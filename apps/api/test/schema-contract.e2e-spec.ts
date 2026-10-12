import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PostgreSQL schema contract (NFR-DATA-01, NFR-DATA-02)', () => {
  const schema = readFileSync(
    join(process.cwd(), 'prisma/schema.prisma'),
    'utf8',
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20261006170000_backend_prototype/migration.sql',
    ),
    'utf8',
  );
  const seed = readFileSync(join(process.cwd(), 'prisma/seed.ts'), 'utf8');

  it('uses integer auto-increment IDs and enforces one wallet per user', () => {
    expect(schema).toMatch(/id\s+Int\s+@id @default\(autoincrement\(\)\)/);
    expect(schema).toMatch(/userId\s+Int\s+@unique @map\("user_id"\)/);
    expect(migration).toContain('"id" SERIAL NOT NULL');
  });

  it('creates the 1,000-baht demo subsidy grant through one wallet provisioning path', () => {
    expect(seed).toContain('await ensureWallet(consumer.id, 1_000)');
    expect(seed).toContain('businessRef: `subsidy-grant:user:${userId}`');
  });

  it('enforces non-negative projections and immutable receipt/value facts', () => {
    expect(migration).toContain('wallets_non_negative_check');
    expect(migration).toContain('wallet_ledger_immutable');
    expect(migration).toContain('point_ledger_immutable');
    expect(migration).toContain('receipt_immutable');
    expect(migration).toContain('paid_order_immutable');
  });
});
