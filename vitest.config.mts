import { configDefaults, defineConfig } from 'vitest/config';

const config = defineConfig({
  cacheDir: './tmp/vitest',
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: [
      ...configDefaults.exclude,
      'tests/browser/**',
      'tests/cloudflare-worker/**',
    ],
    typecheck: {
      enabled: true,
      include: ['tests/**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
    },
    pool: 'forks',
    maxWorkers: 4,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: ['default', 'junit'],
    outputFile: { junit: './tmp/junit/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['dist/**/*.js'],
      reportsDirectory: './tmp/coverage',
      reporter: ['text', 'cobertura'],
    },
  },
});

export default config;
