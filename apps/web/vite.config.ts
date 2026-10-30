import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const WEB_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const HTTPS_KEY_PATH = resolve(WEB_DIRECTORY, 'certs/dev-key.pem');
const HTTPS_CERTIFICATE_PATH = resolve(WEB_DIRECTORY, 'certs/dev-cert.pem');

function loadDevelopmentHttps() {
  const hasKey = existsSync(HTTPS_KEY_PATH);
  const hasCertificate = existsSync(HTTPS_CERTIFICATE_PATH);

  if (hasKey !== hasCertificate) {
    throw new Error(
      'Local HTTPS requires both apps/web/certs/dev-key.pem and apps/web/certs/dev-cert.pem.',
    );
  }

  if (!hasKey) return undefined;

  return {
    key: readFileSync(HTTPS_KEY_PATH),
    cert: readFileSync(HTTPS_CERTIFICATE_PATH),
  };
}

const developmentHttps = loadDevelopmentHttps();

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@thai-please/contracts': resolve(
        WEB_DIRECTORY,
        '../../packages/contracts/src/index.ts',
      ),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    ...(developmentHttps ? { https: developmentHttps } : {}),
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
