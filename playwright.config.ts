import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 20_000,
  outputDir: './tmp/integration-browser/artifacts/test-results',
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: './tmp/integration-browser/artifacts/playwright.json' },
    ],
  ],
  use: { browserName: 'chromium' },
});
