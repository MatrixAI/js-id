#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const specs = path.join(root, 'specs');
const seen = new Set();
let requirementCount = 0;
let caseCount = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRelative(bundle, relativePath) {
  assert(typeof relativePath === 'string', 'Expected a relative path');
  const resolved = path.resolve(bundle, relativePath);
  const relative = path.relative(root, resolved);
  assert(
    relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative),
    `Path escapes repository: ${relativePath}`,
  );
  return readFileSync(resolved, 'utf8');
}

function register(id, prefix) {
  assert(
    typeof id === 'string' && id.startsWith(prefix),
    `Invalid ${prefix} ID`,
  );
  assert(!seen.has(id), `Duplicate ID: ${id}`);
  seen.add(id);
}

const bundles = readdirSync(specs, { withFileTypes: true }).filter(
  (entry) => entry.isDirectory() && /^\d{4}-/.test(entry.name),
);
assert(bundles.length > 0, 'No numbered specification bundles found');

for (const entry of bundles) {
  const bundle = path.join(specs, entry.name);
  const adr = readRelative(bundle, 'adr.md');
  const graph = JSON.parse(readRelative(bundle, 'assurance.json'));
  assert(graph.version === 1, `${entry.name}: unsupported graph version`);
  const status = /^status: (proposed|accepted)$/m.exec(adr)?.[1];
  assert(
    graph.role === 'non-normative-traceability' && status != null,
    `${entry.name}: graph role and record status must agree`,
  );
  assert(
    Array.isArray(graph.requirements) &&
      Array.isArray(graph.cases) &&
      Array.isArray(graph.evidence),
    `${entry.name}: missing graph collections`,
  );
  const anchors = [...adr.matchAll(/<a id="(REQ-[A-Z0-9-]+)"><\/a>/g)].map(
    (match) => match[1],
  );
  assert(
    new Set(anchors).size === anchors.length,
    `${entry.name}: duplicate anchors`,
  );
  const caseIds = new Set(graph.cases.map((item) => item.id));
  const evidenceIds = new Set(graph.evidence.map((item) => item.id));
  const usedCases = new Set();
  const usedEvidence = new Set();

  for (const requirement of graph.requirements) {
    register(requirement.id, 'REQ-');
    assert(
      anchors.includes(requirement.id),
      `Missing anchor: ${requirement.id}`,
    );
    const section = adr
      .split(`### ${requirement.id} - `)[1]
      ?.split('\n### ')[0];
    const expectedStatus = status === 'accepted' ? 'active' : 'target';
    assert(
      section != null && section.includes(`Status: ${expectedStatus}<br>`),
      `${requirement.id}: lifecycle status does not match its decision`,
    );
    assert(
      Array.isArray(requirement.cases),
      `Missing cases: ${requirement.id}`,
    );
    assert(
      typeof requirement.gap === 'string' && requirement.gap.length > 0,
      `Missing gap: ${requirement.id}`,
    );
    for (const id of requirement.cases) {
      assert(caseIds.has(id), `${requirement.id}: unknown case ${id}`);
      usedCases.add(id);
    }
    requirementCount++;
  }
  assert(
    anchors.length === graph.requirements.length,
    `${entry.name}: unindexed requirement anchor`,
  );

  for (const item of graph.cases) {
    register(item.id, 'CASE-');
    assert(usedCases.has(item.id), `Unreferenced case: ${item.id}`);
    assert(
      typeof item.limit === 'string' && item.limit.length > 0,
      `Missing limit: ${item.id}`,
    );
    assert(
      Array.isArray(item.assertions) && item.assertions.length > 0,
      `Missing assertions: ${item.id}`,
    );
    assert(
      Array.isArray(item.evidence) && item.evidence.length > 0,
      `Missing binding: ${item.id}`,
    );
    for (const assertion of item.assertions) {
      assert(
        typeof assertion.text === 'string' && assertion.text.length > 0,
        `Missing assertion text: ${item.id}`,
      );
      assert(
        readRelative(bundle, assertion.path).includes(assertion.text),
        `${item.id}: assertion text not found`,
      );
    }
    for (const id of item.evidence) {
      assert(evidenceIds.has(id), `${item.id}: unknown evidence ${id}`);
      usedEvidence.add(id);
    }
    caseCount++;
  }
  for (const item of graph.evidence) {
    register(item.id, 'EVID-');
    assert(usedEvidence.has(item.id), `Unreferenced evidence: ${item.id}`);
    assert(
      item.kind === 'execution-binding' && item.outcome === 'not-recorded',
      `Invalid binding: ${item.id}`,
    );
    assert(
      typeof item.limit === 'string' && item.limit.length > 0,
      `Missing limit: ${item.id}`,
    );
    readRelative(bundle, item.path);
  }
}

process.stdout.write(
  `Checked ${bundles.length} bundles, ${requirementCount} requirement anchors, and ${caseCount} cases. No execution or semantic coverage was verified.\n`,
);
