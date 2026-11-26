import type { Route } from '@playwright/test';
import type { BrowserRealm } from './utils.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import { runBrowserScenario } from './utils.js';

type BrowserScenario = <Library, Result>(
  realm: BrowserRealm,
  scenario: (library: Library) => Promise<Result>,
) => Promise<Result>;

const root = fileURLToPath(new URL('../../', import.meta.url));
const pageUrl = 'http://browser.test/';

const test = base.extend<{ browserScenario: BrowserScenario }>({
  browserScenario: async ({ page }, provide) => {
    const bundle = await readFile(
      process.env.LIBRARY_BUNDLE ??
        path.join(root, 'tmp/integration-browser/browser.js'),
      'utf8',
    );
    const servePage = async (route: Route): Promise<void> => {
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html>',
      });
    };
    await page.route(pageUrl, servePage);
    try {
      await page.goto(pageUrl);
      await provide((realm, scenario) =>
        runBrowserScenario(page, bundle, realm, scenario),
      );
    } finally {
      await page.unroute(pageUrl, servePage);
    }
  },
});

export { expect, test };
