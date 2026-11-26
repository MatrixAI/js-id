# Identifier specifications

These records describe accepted identifier contracts. Acceptance is not an
assertion that their requirements are released or verified. Records are read
latest-first, with changes made through explicit amendments or successors rather
than silent historical rewrites.

- [Identifier values and representations](0001-identifier-values-and-representations/adr.md).
- [UUIDv7 sortable generation](0002-uuidv7-sortable-generation/adr.md).
- [UUIDv8 worker-scoped flake identifiers](0003-uuidv8-worker-scoped-flakes/adr.md).
- [Typed and compact encodings](0004-typed-and-compact-encodings/adr.md).
- [Name-based UUIDv8 identifiers](0005-name-based-uuidv8/adr.md).
- [Cross-runtime identifier boundaries](0006-cross-runtime-boundaries/adr.md).

Requirements live in the records. Tests and other evidence demonstrate
implementation behavior but do not replace the requirements. A major release,
publication, production data changes, and downstream cutovers remain separate
decisions.

## Current-state reduction

Read accepted records latest-first, applying explicit record and requirement
supersession or amendment edges before treating an earlier requirement as
active. Proposed records express targets only; deprecated and superseded
requirements are not independently active. The six records are accepted and
their requirements are active; there are currently no supersession edges.
Acceptance is separate from implementation, evidence, and release. Keep
historical audit entries intact when recording later observations.

## Assurance graph

Each record owns a non-normative requirement index in `requirements.yml` and a
case registry in `cases.yml`. Requirements link to ADR anchors and cases; cases
link back to requirements and to selected assertions in the test sources. Test
names carry case IDs into runner reports. A case registry's default binding is
overridden by a case-specific binding where needed. The shared
[execution bindings](execution-bindings.yml) identify the corresponding checks.
Neither a case mapping nor a check binding is an execution receipt or proves
complete conformance.

Current indices separate decision status, requirement status, and partial or
pending evidence. No immutable revision-bound receipt is claimed for the present
worktree. Local test runs and their mutable output must not be mistaken for
release evidence. Record a dated receipt with source and artifact digests when a
specific execution needs to be retained as evidence.

The ADRs remain normative, while these indices, case mappings, execution
bindings, and any future external views are projections. Values defining wire
profiles remain in the records; implementation facts are read from linked source
rather than maintained as a second source of authority.

Validate the numbered records from the repository root with:

```sh
INPUT_PATH=specs INPUT_PATTERN='**/adr.md' structured-madr-validate
```

The Structured MADR validator checks record structure; it does not prove
conformance, validate every graph edge, or run the execution bindings.
