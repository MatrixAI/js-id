import type { Page } from '@playwright/test';

type BrowserRealm = 'document' | 'worker';

const browserRealms: ReadonlyArray<BrowserRealm> = ['document', 'worker'];

/**
 * Run a self-contained scenario against the browser bundle in an isolated realm.
 * The scenario cannot capture local variables, and its result must be cloneable.
 */
async function runBrowserScenario<Library, Result>(
  page: Page,
  bundle: string,
  realm: BrowserRealm,
  scenario: (library: Library) => Promise<Result>,
): Promise<Result> {
  const result = await page.evaluate(
    async ({ bundle, realm, scenario }) => {
      const browser = globalThis as unknown as {
        Worker: new (
          url: string,
          options: { type: 'module' },
        ) => {
          onmessage: (event: {
            data: { ok: true; value: unknown } | { ok: false; error: string };
          }) => void;
          onerror: (event: { message: string }) => void;
          terminate: () => void;
        };
        URL: {
          createObjectURL: (blob: Blob) => string;
          revokeObjectURL: (url: string) => void;
        };
        Blob: typeof Blob;
      };
      const libraryUrl = browser.URL.createObjectURL(
        new browser.Blob([bundle], { type: 'text/javascript' }),
      );
      try {
        if (realm === 'document') {
          const source =
            `import * as library from ${JSON.stringify(libraryUrl)};\n` +
            `export default (${scenario})(library);`;
          const moduleUrl = browser.URL.createObjectURL(
            new browser.Blob([source], { type: 'text/javascript' }),
          );
          try {
            const loaded = (await import(moduleUrl)) as {
              default: Promise<unknown>;
            };
            return await loaded.default;
          } finally {
            browser.URL.revokeObjectURL(moduleUrl);
          }
        }
        const source = `import * as library from ${JSON.stringify(libraryUrl)};
            Promise.resolve().then(() => (${scenario})(library))
              .then((value) => postMessage({ ok: true, value }))
              .catch((error) => postMessage({ ok: false, error: String(error) }));`;
        const workerUrl = browser.URL.createObjectURL(
          new browser.Blob([source], { type: 'text/javascript' }),
        );
        try {
          const worker = new browser.Worker(workerUrl, { type: 'module' });
          try {
            return await new Promise<unknown>((resolve, reject) => {
              worker.onmessage = ({ data }) => {
                if (data.ok) resolve(data.value);
                else reject(new Error(data.error));
              };
              worker.onerror = (event) =>
                reject(new Error(event.message || 'Browser worker failed'));
            });
          } finally {
            worker.terminate();
          }
        } finally {
          browser.URL.revokeObjectURL(workerUrl);
        }
      } finally {
        browser.URL.revokeObjectURL(libraryUrl);
      }
    },
    { bundle, realm, scenario: scenario.toString() },
  );
  return result as Result;
}

export { browserRealms, runBrowserScenario };
export type { BrowserRealm };
