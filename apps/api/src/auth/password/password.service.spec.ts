import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('stores a salted, versioned scrypt hash', async () => {
    const first = await passwords.hash('ThaiPlease@2026');
    const second = await passwords.hash('ThaiPlease@2026');

    expect(first).toMatch(/^scrypt\$1\$/);
    expect(second).not.toBe(first);
    await expect(passwords.verify('ThaiPlease@2026', first)).resolves.toBe(
      true,
    );
  });

  it('rejects incorrect passwords and legacy unversioned hashes', async () => {
    const encodedHash = await passwords.hash('ThaiPlease@2026');

    await expect(passwords.verify('incorrect', encodedHash)).resolves.toBe(
      false,
    );
    await expect(
      passwords.verify('ThaiPlease@2026', 'legacy-hash'),
    ).resolves.toBe(false);
  });
});
