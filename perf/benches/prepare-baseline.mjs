import { readFile, writeFile } from 'node:fs/promises';

const [source, destination] = process.argv.slice(2);
const oldHeader = `import type { Id } from './Id.js';
import IdInternal from './Id.js';
import * as utils from './utils.js';`;
const newHeader = `import type { Id } from './candidate.mjs';
import { IdInternal, utils } from './candidate.mjs';`;
const original = await readFile(source, 'utf8');
if (!original.startsWith(oldHeader)) {
  throw new Error('Unexpected baseline imports');
}
await writeFile(destination, newHeader + original.slice(oldHeader.length));
