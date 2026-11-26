import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { IdSortable, IdDeterministic, IdFlake, utils } from './candidate.mjs';

const args = process.argv.slice(2);
let output;
let baseline;
let pinned = false;
let smoke = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) {
    output = resolve(args[++i]);
  } else if (args[i] === '--baseline' && args[i + 1]) {
    baseline = resolve(args[++i]);
  } else if (args[i] === '--baseline-pinned') {
    pinned = true;
  } else if (args[i] === '--smoke') {
    smoke = true;
  } else {
    throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
}
if (output == null) throw new Error('--output is required');
if (baseline != null && pinned) throw new Error('Choose only one baseline');
if (smoke && baseline != null) {
  throw new Error('Smoke mode cannot use a local baseline');
}
if (pinned) {
  baseline = fileURLToPath(new URL('./baseline.mjs', import.meta.url));
}

async function hash(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}
const candidatePath = new URL('./candidate.mjs', import.meta.url);
const provider = pinned
  ? JSON.parse(
      await readFile(
        new URL('../baselines/sortable-git.provider.json', import.meta.url),
        'utf8',
      ),
    )
  : baseline == null
    ? {
        providerId: 'no-baseline',
        providerKind: 'none',
        source: { description: 'Candidate-only measurement' },
        caveats: ['No prior implementation is compared.'],
      }
    : {
        providerId: 'local-module',
        providerKind: 'local-worktree',
        source: {
          description:
            'Operator-supplied module; transitive inputs are not pinned',
          path: baseline,
          sha256: await hash(baseline),
        },
        caveats: [
          'Local module and dependencies are operator managed.',
          'Different versions can have different layout, randomness and state semantics.',
        ],
      };
if (pinned) {
  Object.assign(provider.source, {
    path: baseline,
    sha256: await hash(baseline),
  });
} else {
  Object.assign(provider, {
    durableBaseline: false,
    exploratoryOnly: true,
    evidenceAuthority: 'none',
    allowedResultAuthorities: ['exploratory'],
  });
}
const profile = {
  profileId: smoke ? 'nix-harness-health' : 'uncontrolled-local',
  profileKind: smoke ? 'nix-harness-health' : 'uncontrolled-local',
  machineClass: smoke
    ? 'Unspecified Nix builder'
    : (cpus()[0]?.model ?? 'unknown'),
  system: {
    os: platform(),
    architecture: arch(),
    kernel: smoke ? 'not captured' : release(),
  },
  runtime: `Node ${process.version}, V8 ${process.versions.v8}`,
  scheduler: 'Uncontrolled; no isolation or affinity policy',
  frequencyPolicy: 'Governor and boost unknown; not enforced',
  determinismClass: 'nondeterministic-timing',
  enforcementLevel: 'none',
  caveats: [
    'Host load and hardware affect timings.',
    'This profile has no performance-gate authority.',
  ],
};
const iterations = smoke ? 8 : 100_000;
const samples = smoke ? 0 : 8;
let sink = 0;
const baselineConstructor =
  baseline == null
    ? undefined
    : (await import(pathToFileURL(baseline).href)).default;
if (baseline != null && typeof baselineConstructor !== 'function') {
  throw new TypeError('Baseline module must default-export a constructor');
}

function measureSortable(generatorConstructor, secure) {
  let count = 0;
  const generator = new generatorConstructor({
    timeSource: () => () => 1_700_000_000_000 + Math.floor(count++ / 1024),
    randomSource: secure ? utils.randomBytes : (size) => new Uint8Array(size),
  });
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const id = generator.get();
    if (!smoke) sink += id[7];
  }
  return performance.now() - start;
}

function measureHash() {
  const generator = new IdDeterministic({ namespace: 'perf' });
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const id = generator.get('example-name');
    if (!smoke) sink += id[7];
  }
  return performance.now() - start;
}

function measureFlake(sequenceBits, nodeId, secure) {
  let count = 0;
  const generator = new IdFlake({
    sequenceBits,
    nodeId,
    timeSource: () => () => 1_700_000_000_000 + Math.floor(count++ / 1024),
    randomSource: secure ? utils.randomBytes : (size) => new Uint8Array(size),
  });
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const id = generator.get();
    if (!smoke) sink += id[7];
  }
  return performance.now() - start;
}

const cases = {
  'sortable-zero-candidate': () => measureSortable(IdSortable, false),
  'sortable-crypto-candidate': () => measureSortable(IdSortable, true),
  'sha256-name-candidate': measureHash,
  'flake-seq12-node62': () => measureFlake(12, new Uint8Array(8), false),
  'flake-seq42-node32': () => measureFlake(42, new Uint8Array(4), false),
  'flake-seq12-node32-crypto': () => measureFlake(12, new Uint8Array(4), true),
};
if (baselineConstructor != null) {
  cases['sortable-zero-baseline'] = () =>
    measureSortable(baselineConstructor, false);
  cases['sortable-crypto-baseline'] = () =>
    measureSortable(baselineConstructor, true);
}
const measurements = Object.fromEntries(
  Object.keys(cases).map((name) => [name, []]),
);
for (const run of Object.values(cases)) run();
for (let sample = 0; sample < samples; sample++) {
  const names = Object.keys(cases);
  if (sample % 2) names.reverse();
  for (const name of names) measurements[name].push(cases[name]());
}
const result = {
  schemaVersion: 1,
  evidenceClass: smoke ? 'harness-health' : 'exploratory',
  authority: { budget: 'none', regressionGate: 'none', correctness: 'none' },
  provider: '../provider.json',
  executionProfile: '../execution-profile.json',
  candidate: {
    path: candidatePath.pathname,
    sha256: await hash(candidatePath),
  },
  scenario: { iterations, samples, clockBatch: 1024 },
  samplesMs: measurements,
  sink,
};
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
const summaries = Object.entries(measurements).map(([name, values]) => ({
  name,
  medianMs: median(values),
}));
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
await mkdir(`${output}/runner`, { recursive: true });
await mkdir(`${output}/normalized`, { recursive: true });
await mkdir(`${output}/charts`, { recursive: true });
async function write(path, value) {
  return writeFile(`${output}/${path}`, `${JSON.stringify(value, null, 2)}\n`);
}
await write('provider.json', provider);
await write('execution-profile.json', profile);
await write('runner/result.json', result);
await write('normalized/summary.json', {
  unit: 'ms per sample',
  authority: smoke ? 'none' : 'exploratory',
  cases: summaries,
});
await write('charts/comparison.vl.json', {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  description: 'Exploratory sample medians; no budget or regression authority',
  data: { values: summaries },
  mark: 'bar',
  encoding: {
    x: { field: 'name', type: 'nominal' },
    y: {
      field: 'medianMs',
      type: 'quantitative',
      title: 'Milliseconds per sample',
    },
  },
});
if (process.env.ID_PERF_VALIDATOR == null) {
  throw new Error('Use the packaged performance runner');
}
const validation = spawnSync(process.env.ID_PERF_VALIDATOR, [output], {
  stdio: 'inherit',
});
if (validation.error != null) throw validation.error;
if (validation.status !== 0) {
  throw new Error('Performance provenance validation failed');
}
process.stdout.write(`Performance artifacts written to ${output}\n`);
