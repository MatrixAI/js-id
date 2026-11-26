import { expect, test } from './fixture.js';
import { verifyRuntime } from './scenarios.js';
import { browserRealms } from './utils.js';

for (const realm of browserRealms) {
  test(`CASE-ID-UUID7-BROWSER CASE-ID-FLAKE-BROWSER CASE-ID-NAME-BROWSER CASE-ID-RUNTIME-CHROMIUM CASE-ID-RUNTIME-FROZEN CASE-ID-RUNTIME-CLOCK-FALLBACK: runs identifier scenarios in a ${realm}`, async ({
    browserScenario,
  }) => {
    expect(await browserScenario(realm, verifyRuntime)).toBe(true);
  });
}
