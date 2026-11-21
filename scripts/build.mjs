#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import process from 'node:process';
import childProcess from 'node:child_process';

const projectPath = path.dirname(
  path.dirname(url.fileURLToPath(import.meta.url)),
);

/* eslint-disable no-console */
async function main(argv = process.argv) {
  argv = argv.slice(2);
  const clean = !argv.includes('--no-clean');
  argv = argv.filter((arg) => arg !== '--no-clean');
  const compiler = url.fileURLToPath(import.meta.resolve('typescript/bin/tsc'));
  const tscArgs = [
    compiler,
    '-p',
    path.join(projectPath, 'tsconfig.build.json'),
    ...argv,
  ];
  if (clean) {
    fs.rmSync(path.join(projectPath, 'dist'), { recursive: true, force: true });
  }
  console.error('Running tsc:');
  console.error([process.execPath, ...tscArgs].join(' '));
  childProcess.execFileSync(process.execPath, tscArgs, {
    cwd: projectPath,
    stdio: ['inherit', 'inherit', 'inherit'],
    windowsHide: true,
    encoding: 'utf-8',
  });
}
/* eslint-enable no-console */

if (import.meta.url.startsWith('file:')) {
  const modulePath = url.fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath) {
    main().catch((error) => {
      process.stderr.write(`${error.stack ?? error}\n`);
      process.exitCode = 1;
    });
  }
}
