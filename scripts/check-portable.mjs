import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['node:crypto', 'node:perf_hooks']);
const builtins = new Set(
  builtinModules.map((name) => name.replace(/^node:/, '')),
);

function inspect(directory, observed) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(file, observed);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier;
      if (specifier == null || !ts.isStringLiteral(specifier)) continue;
      const name = specifier.text;
      assert.ok(
        !name.startsWith('#'),
        `Source cannot use a built-output alias: ${file}`,
      );
      if (
        builtins.has(name.replace(/^node:/, '')) ||
        name.startsWith('node:')
      ) {
        assert.ok(allowed.has(name), `Undeclared Node dependency: ${name}`);
        observed.add(name);
      }
    }
  }
}

function main() {
  const observed = new Set();
  inspect(path.join(root, 'src'), observed);
  assert.deepEqual([...observed].sort(), [...allowed].sort());
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tmp/portable-imports.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        status: 'passed',
        scope: 'declared-node-import-boundary',
        runtime: process.version,
        nodeBuiltins: [...observed].sort(),
        browserSupport: false,
        notes:
          'Node crypto, performance, and public Buffer APIs remain intentional; no browser conformance is claimed.',
      },
      null,
      2,
    ) + '\n',
  );
  process.stdout.write(
    'Declared Node import boundary passed; browser support is not claimed.\n',
  );
}

main();
