# AGENTS

- Begin with the [repository profile selector](.matrixai/repo-profile.yml). This
  repository uses the library-js profile.
- Standards are pinned in the private
  [standards submodule](.matrixai/matrixai-standards). If access fails, report
  the blocker; do not substitute an untracked copy or silently skip its
  requirements.
- Enforce the
  [universal hotset](.matrixai/matrixai-standards/standards/HOTSET.md),
  [library profile](.matrixai/matrixai-standards/standards/profiles/library-js.md),
  [TypeScript hotset](.matrixai/matrixai-standards/standards/coding/typescript/HOTSET.md),
  and
  [tooling contract](.matrixai/matrixai-standards/standards/coding/tooling/tooling-contract.md).
- Apply the
  [prose rules](.matrixai/matrixai-standards/standards/prose-markdown.md) when
  editing Markdown, and respect [.editorconfig](.editorconfig).
- Materialize profile and ecosystem defaults from the standards checkout into
  [runtime skills](.agents/skills). Inspect provenance, preserve intentional
  additions, rematerialize after standards updates, and load applicable skills.
  The default command is
  `nix run './.matrixai/matrixai-standards#skills-materializer' -- --standards-root ./.matrixai/matrixai-standards`.
- Preserve unrelated work and existing index entries. Before Nix evaluation,
  review Git status and stage only exact required new inputs. Prefer Git-backed
  refs; do not use path acquisition or impure evaluation to bypass visibility.
- Run commands directly when this repository's environment is already active. Do
  not wrap an inherited environment in another direnv activation.
- Do not load credentials, install dependencies, or change persistent shell
  options implicitly during environment activation.
- Keep authored prose ASCII where an equivalent exists. Do not encode line
  numbers in repository path text or Markdown destinations; prefer heading
  anchors or a file link followed by the line number in prose.

## Project configuration and overrides

- Require Node.js 24 or newer. Build one ES2022/NodeNext ESM package with
  declarations in [dist](dist); retain existing public import compatibility.
- Preserve identifier encodings, generation behavior, parsing, and
  serialization. Keep unrelated runtime dependency major upgrades out of
  modernization work.
- Source imports are relative. Tests use the package's compiled-output mapping
  and execute through the package test script after its build step.
- Keep Jest/SWC, a 20-second default test timeout, and explicit type imports.
  Any decorators must use standard-track semantics, never legacy metadata.
- Documentation is handwritten Markdown; generated API documentation is not
  maintained. This overrides the generic profile's documentation-generator rule.
- Obtain MatrixAI lint from the selected nixpkgs-matrixai package set. Do not
  add the npm lint package or redundant dependencies already bundled with that
  tool. Keep the consumer TypeScript compiler required by the lint parser.
- Configure one Nix lint environment with explicit backend tools. Reuse it in
  development, hermetic checks, and the formatter output. Nix formatting invokes
  this same MatrixAI lint authority, not a separate underlying formatter. This
  explicitly replaces the older npm-provider/no-formatter workflow.
- Package lint scripts remain thin wrappers around the Nix-provided executable.
  Start development formatting with the lintfix script; use lint for nonmutating
  verification. The Nix formatter is the equivalent formatting entrypoint.
- Use integrated flake-parts/devenv/direnv development and independently
  runnable hermetic checks. Do not make checks consume ambient developer state.
- Keep package manifests canonical, use a package file allowlist, and select
  released runtime dependencies with exact lockfile resolutions. Do not replace
  production dependencies with unpublished sibling checkouts.
- Do not commit, publish, tag, or add publication automation without approval.
  Provide scoped conventional commit commands for completed implementation
  slices.

## Golden commands

- Build: `npm run build`.
- Types: `npm run typecheck`.
- Tests: `npm test -- --runInBand`.
- Development formatting: `npm run lintfix` or `nix fmt`.
- Lint verification: `npm run lint`.
- Package verification: `npm run check:package`.
- Portable imports: `npm run check:portable`.
- Aggregate local checks: `npm run check`.
- Hermetic checks: `nix flake check`.
- Documentation and benchmarks: no generated-documentation or benchmark command
  is required for this repository.
