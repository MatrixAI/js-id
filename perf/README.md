# Performance evidence

This directory owns resource-behavior evidence, separate from deterministic
correctness tests. The roles mirror the neighboring async-init project:

- [benches](benches/) contains executable instruments and scenarios.
- [baselines](baselines/) identifies comparison subjects and their provenance.
- [execution profiles](execution-profiles/) describe the machine and runtime
  conditions under which observations are produced.
- [results](results/) holds only reviewed, compact retained observations and
  interpretations, not routine scratch runs.
- [profiles](profiles/) holds curated profiler output and its provenance.
- [load](load/) holds retained load, saturation, or soak evidence.
- [budgets](budgets/) holds resource-policy proposals and any accepted budgets.

These roles do not imply that all kinds of evidence or any numeric budget
already exist. Fresh local results belong under `tmp/perf/runs/`. A measurement
is not a correctness proof, and a harness-health check is not a regression gate.

## Current instrument

The sortable benchmark compares generation on the same synthetic clock using
zero-filled or Web Crypto random bytes. It also measures synchronous name-based
SHA-256 UUIDv8 generation and configurable flake allocations: 12 sequence/62
node bits, 42 sequence/32 node bits, and 12 sequence/32 node bits with a Web
Crypto tail. Flake cases are candidate-only, not historical comparisons. This is
a microbenchmark, not a correctness test or a database, browser, or deployed
Worker benchmark.

The Nix-built runner is shared by the operator app and the non-default
harness-health check. Run the app from this repository, choosing a fresh output
directory under `tmp/perf/runs/`:

```sh
nix run '.#perf-id' -- --output tmp/perf/runs/local
```

To compare with the pinned pre-hard-cut sortable source, adapted to the current
ID constructor and utilities, run:

```sh
nix run '.#perf-id' -- --output tmp/perf/runs/pinned --baseline-pinned
```

The pinned provider records the Git revision and Nix source hash. It is not a
full historical build: its shared helpers, old layout, random-byte count, and
state semantics differ from the current implementation. The baseline is an
external benchmark input only; it is not included in the library API.

For an exploratory comparison, supply a path to a local module whose default
export is a compatible sortable generator constructor. For example, after
preparing such a module under the temporary directory:

```sh
nix run '.#perf-id' -- --output tmp/perf/runs/comparison --baseline tmp/baseline/IdSortable.mjs
```

The baseline file is hashed and recorded, but its imports and dependencies are
not captured. Such a comparison is local and exploratory, not a durable source
pin. The prior implementation used a different layout, state handling and
random-byte count, so a cross-version result does not compare identical
semantics. Do not use these results as a numeric budget, regression gate, or
correctness proof. A full historical build comparison, controlled runner
profiles, repeated observations, and reviewed interpretation remain future work.

The health check emits its own report and the same generated run tree; it runs
tiny workloads without retaining timing samples or host-specific measurements.
Locally generated runs are disposable, not curated evidence. Machine scheduling,
CPU affinity, governor and boost are not controlled by the runner.
