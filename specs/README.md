# Identifier specifications

These records describe proposed identifier contracts. A proposed record is not
an assertion that its requirements are implemented, released, or verified.
Records are read latest-first, with changes made through explicit amendments or
successors rather than silent historical rewrites.

- [Identifier values and representations](0001-identifier-values-and-representations/adr.md).
- [UUIDv7 sortable generation](0002-uuidv7-sortable-generation/adr.md).
- [UUIDv8 worker-scoped flake identifiers](0003-uuidv8-worker-scoped-flakes/adr.md).
- [Typed and compact encodings](0004-typed-and-compact-encodings/adr.md).
- [Name-based UUIDv8 identifiers](0005-name-based-uuidv8/adr.md).
- [Cross-runtime identifier boundaries](0006-cross-runtime-boundaries/adr.md).

Requirements live in the records. Tests and other evidence demonstrate
implementation behavior but do not replace the requirements. A major release,
publication, production data changes, and downstream cutovers require separate
approval.

## Current-state reduction

Read accepted records latest-first, applying explicit record and requirement
supersession or amendment edges before treating an earlier requirement as
active. Proposed records express targets only; deprecated and superseded
requirements are not independently active. No record in this directory is
currently accepted, and there are no supersession edges, so this directory
currently asserts no binding requirements. Acceptance is separate from
implementation and release. Keep historical audit entries intact when recording
later observations.

## Assurance graph

Each record owns an `assurance.json` projection. Its requirement entries point
to inline ADR anchors and list cases; cases point to named source assertions and
execution bindings; bindings identify the runner or check. Empty case lists and
case limitations expose obligations that local tests cannot establish. The graph
is non-normative: it does not define requirements, change record status, or
prove that an execution passed. Bindings are not execution receipts. Local
successful runs described in audits concern the then-current uncommitted working
tree, not a reproducible committed revision. Retained check reports can be
associated with a future reviewed revision; the graph does not claim such a
receipt exists.

The checker below verifies selected structural links, anchors, file existence,
and assertion-name text, not semantic coverage, execution, acceptance, runtime
availability, or all Markdown links. Values that define wire profiles are
normative in the records; implementation facts are read from the linked source,
not maintained as a second source of authority. External assurance views, if
introduced, are projections over these records and their evidence.

```sh
npm run specs:assurance
```

Validate the numbered records from the repository root with:

```sh
INPUT_PATH=specs INPUT_PATTERN='**/adr.md' structured-madr-validate
```

The Structured MADR validator and the assurance checker have separate scopes;
neither by itself proves conformance or performs browser or package testing.
