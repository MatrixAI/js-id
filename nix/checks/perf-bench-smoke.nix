{
  pkgs,
  system,
  perfRunner,
}:
pkgs.runCommand "id-perf-bench-smoke" { nativeBuildInputs = [ perfRunner ]; } ''
  mkdir -p "$out/artifacts/perf/runs"
  id-perf --smoke --output "$out/artifacts/perf/runs/smoke"
  id-perf --smoke --baseline-pinned --output "$out/artifacts/perf/runs/pinned-smoke"
  cat > "$out/report.json" <<EOF
  {
    "schemaVersion": 1,
    "name": "perf-bench-smoke",
    "kind": "harness-health",
    "status": "passed",
    "system": "${system}",
    "summary": "Bounded benchmark and provenance validation passed; no budget, regression-gate, or correctness authority",
    "artifacts": {
      "provider": "artifacts/perf/runs/smoke/provider.json",
      "execution-profile": "artifacts/perf/runs/smoke/execution-profile.json",
      "runner": "artifacts/perf/runs/smoke/runner/result.json",
      "summary": "artifacts/perf/runs/smoke/normalized/summary.json",
      "chart": "artifacts/perf/runs/smoke/charts/comparison.vl.json",
      "pinned-provider": "artifacts/perf/runs/pinned-smoke/provider.json",
      "pinned-runner": "artifacts/perf/runs/pinned-smoke/runner/result.json"
    }
  }
  EOF
''
