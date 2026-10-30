import { defineConfig } from 'vitest/config';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('../../.env');
  } catch {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Ignore if env file does not exist
    }
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
