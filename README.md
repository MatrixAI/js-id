# js-id

ID generation for JavaScript & TypeScript applications.

Example Usage:

```ts
import { IdRandom, IdDeterministic, IdSortable, utils } from '@matrixai/id';

// Random ids, equivalent to UUIDv4

const randGen = new IdRandom();

const randIds = [...utils.take(randGen, 3)];
console.log(randIds.map((b) => utils.toUUID(b)));

// Deterministic ids, equivalent to UUIDv5

const deteGen = new IdDeterministic({
  namespace: 'foo',
});

const deteId1 = deteGen.get();
const deteId2 = deteGen.get('bar');
const deteId3 = deteGen.get('bar');

console.log(utils.toUUID(deteId1));
console.log(utils.toMultibase(deteId2, 'base32hex'));

// Will be cast to string index
const recordOfDeteIds = {};
recordOfDeteIds[deteId1] = 1;
recordOfDeteIds[deteId2] = 1;
console.log(recordOfDeteIds[deteId1]);

// Can be checked for equality
console.log(deteId2.equals(deteId3));
// Binary string form can be checked for equality
console.log(deteId2.toString() === deteId3.toString());

// Strictly monotonic sortable ids, equivalent to UUIDv7

let lastId = new Uint8Array([
  0x06, 0x16, 0x3e, 0xf5, 0x6d, 0x8d, 0x70, 0x00, 0x87, 0xc4, 0x65, 0xd5, 0x21,
  0x9b, 0x03, 0xd4,
]);

const sortGen = new IdSortable({ lastId });

const sortId1 = sortGen.get();
const sortId2 = sortGen.get();
const sortId3 = sortGen.get();

const sortIds = [
  utils.toBuffer(sortId2),
  utils.toBuffer(sortId3),
  utils.toBuffer(sortId1),
];

sortIds.sort(Buffer.compare);

console.log(sortIds);

// Save the last id to ensure strict monotonicity across process restarts
lastId = sortGen.lastId;

// Ids can also be compared in order
console.log(sortId1 < sortId2);
console.log(sortId2 < sortId3);
```

**Base Encoding and Lexicographic Order**

It is important to realise that not all base-encodings preserve lexicographic
sort order. The UUID (hex-encoding) and `base32hex` does, but `base58btc` and
`base64` does not. Make sure to pick an appropriate base encoding if you are
expecting to compare the `IdSortable` as base-encoded strings.

Out of all the multibase encodings, the only ones that preserve sort order are:

```
base2
base8
base16
base16upper
base32hex
base32hexupper
base32hexpad
base32hexpadupper
```

In addition to this, JS binary string encoding through `id.toString()` also
preserves sort order.

## Installation

```sh
npm install --save @matrixai/id
```

## Development

Node.js 24 or newer is required. Enter the integrated environment with
`nix develop`, or review and allow [.envrc](.envrc) for automatic direnv
activation. Activation does not load credentials, install dependencies, or
change persistent shell options. Install project dependencies explicitly:

```sh
npm ci --ignore-scripts
npm run build
npm test
```

Vitest compiles the package incrementally first and imports built modules
through the package mapping. A matching build may be supplied with
`npm test -- --prebuilt`. JUnit results are written under
[tmp/junit](tmp/junit), and optional coverage results under
[tmp/coverage](tmp/coverage).

### Lint and formatting

MatrixAI lint comes from the selected nixpkgs-matrixai package set, not an npm
dependency or a separate lint flake input. One configured tool environment is
shared by the development shell, hermetic lint check, and Nix formatter. The
repository's TypeScript compiler remains a project dependency.

```sh
nix fmt
npm run lintfix
npm run lint
```

The first two commands run the same formatting authority across applicable
domains, including TypeScript, Markdown, shell, and Nix. The last command is
nonmutating verification. No global npm lint installation is required.

### Package and hermetic checks

The [manifest](package.json) allowlists emitted code and declarations, excluding
development artifacts and compiler cache metadata. The tests exercise identifier
compatibility vectors through the compiled package.

The default Nix check aggregates unit tests, typechecking, and the shared lint
check. Both checks run independently of an activated development shell:

```sh
nix flake check
nix build '.#npm-package'
```

The package output is a prepared npm archive, with a separate unpacked output
and dependency metadata for downstream Nix consumption. It preserves the
canonical manifest and does not substitute unpublished sibling checkouts.

### Runtime boundary

This modernization preserves the existing Node runtime boundary: cryptographic
randomness, the performance clock, and public Buffer conversions. These checks
do not demonstrate browser or worker support.

### Repository standards

Start from [repository guidance](AGENTS.md), the
[profile selector](.matrixai/repo-profile.yml), and the pinned private
[standards submodule](.matrixai/matrixai-standards). Materialized skills are
derived from that checkout's profile and ecosystem collections. Private
acquisition failures are blockers, not permission to bypass checks.

Documentation is handwritten Markdown; generated API documentation is not
maintained. Unit and hermetic checks provide the executable validation gates.

## Release policy

There is no automatic npm publication workflow. Existing published releases
remain available, but this modernization does not publish a new one. Family
integration uses released dependencies with exact lockfile resolutions.
Committing, tagging, and publishing require separate approval.
