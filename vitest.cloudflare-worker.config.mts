import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
  cacheDir: './tmp/vitest/cloudflare-worker',
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      miniflare: { compatibilityDate: '2026-10-19' },
    }),
  ],
  test: {
    include: ['tests/cloudflare-worker/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: ['default', 'junit'],
    outputFile: { junit: './tmp/junit/cloudflare-worker.xml' },
  },
});

export default config;
