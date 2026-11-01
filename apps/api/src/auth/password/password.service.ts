import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const FORMAT = 'scrypt';
const FORMAT_VERSION = '1';
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derivedKey = (await scryptAsync(
      password,
      salt,
      KEY_LENGTH,
    )) as Buffer;

    return [
      FORMAT,
      FORMAT_VERSION,
      salt.toString('hex'),
      derivedKey.toString('hex'),
    ].join('$');
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [format, version, saltHex, hashHex, ...unexpected] =
      encodedHash.split('$');

    if (
      format !== FORMAT ||
      version !== FORMAT_VERSION ||
      !saltHex ||
      !hashHex ||
      unexpected.length > 0
    ) {
      return false;
    }

    const storedHash = Buffer.from(hashHex, 'hex');
    if (storedHash.length !== KEY_LENGTH) {
      return false;
    }

    const derivedKey = (await scryptAsync(
      password,
      Buffer.from(saltHex, 'hex'),
      KEY_LENGTH,
    )) as Buffer;

    return timingSafeEqual(storedHash, derivedKey);
  }
}
