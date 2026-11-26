# Retained results

Keep only reviewed, compact observations here. Machine-readable runner output is
validated against [the result schema](schema.json); retained interpretations
identify the question, source, provider, execution profile, samples, caveats,
and any decision supported. Fresh and throwaway runs stay under `tmp/perf/runs/`
or the Nix check artifact tree.

The [exploratory observation](2026-11-26-exploratory.md) records one
uncontrolled run and its limitations. A locally observed timing, an adapted
historical source, or a passing harness-health check is not a numeric budget,
release gate, or correctness proof.

The separate [real-clock observation](2026-11-26-real-clock-exploratory.md)
records timestamp-bucket occupancy and exhaustion in an instrumented local run.
