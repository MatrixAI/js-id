#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = { cwd: root, stdio: 'inherit', windowsHide: true };
const args = process.argv.slice(2);
if (!args.includes('--prebuilt')) {
  execFileSync(
    process.execPath,
    [path.join(root, 'scripts/build.mjs'), '--no-clean'],
    options,
  );
}
execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    ...args.filter((arg) => arg !== '--prebuilt'),
  ],
  options,
);
