import { describe, expect, it } from 'vitest';
import { parseCorsOrigins, validateEnvironment } from './environment.js';

const requiredEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/thai_please',
  JWT_SECRET: 'a-development-secret-with-at-least-32-characters',
};

describe('environment configuration', () => {
  it('applies safe local defaults to non-secret configuration', () => {
    const environment = validateEnvironment(requiredEnvironment);

    expect(environment.API_PREFIX).toBe('api/v1');
    expect(environment.AUTH_SESSION_TTL_SECONDS).toBe(28_800);
    expect(environment.PORT).toBe(4000);
  });

  it('rejects a missing JWT secret', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: requiredEnvironment.DATABASE_URL }),
    ).toThrow();
  });

  it('normalizes configured CORS origins', () => {
    expect(
      parseCorsOrigins('http://localhost:5173, https://example.test '),
    ).toEqual(['http://localhost:5173', 'https://example.test']);
  });
  it('requires Gemini credentials and model together while allowing it disabled', () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        GEMINI_API_KEY: 'test-key',
      }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        GEMINI_MODEL: 'test-model',
      }),
    ).toThrow();
    expect(
      validateEnvironment({
        ...requiredEnvironment,
        GEMINI_API_KEY: '',
        GEMINI_MODEL: '',
      }).GEMINI_MODEL,
    ).toBeUndefined();
  });
});
