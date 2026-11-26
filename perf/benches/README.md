# Benchmark instruments

The [runner](run.mjs) measures candidate UUIDv7 generation with zero-filled or
Web Crypto bytes, SHA-256 name IDs, and selected configurable UUIDv8 flake
allocations. The optional historical sortable baseline is acquired and adapted
separately. Cases use a synthetic clock and are microbenchmarks, not
correctness, database, browser, or deployed Worker tests.

The Nix-built runner is shared by the operator app and the non-default
harness-health check. The check executes tiny workloads without retaining timing
samples. Normal runs emit raw samples, a normalized summary, and a Vega-Lite
specification under the caller-selected temporary run directory. Interpret
differences only with the provider, execution profile, and semantic caveats.
