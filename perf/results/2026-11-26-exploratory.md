# Exploratory identifier benchmark - 2026-11-26

This is a local observation, not a performance budget, regression gate,
correctness proof, or deployed runtime measurement. Times below are milliseconds
per 100,000 IDs and are rounded to three decimals. Eight samples followed a
warmup; the benchmark alternated case order and advanced its synthetic clock
after each 1,024 IDs.

## Provenance

- Machine: Intel Core i9-13900KF, Linux x86-64, kernel 6.12.114.
- Runtime: Node 24.21.0, V8 13.6.233.17-node.53.
- Scheduling and frequency: uncontrolled; no CPU affinity or isolation.
- Candidate: dirty working tree based on commit `78438dd`, including the
  non-throwing exhaustion change. The Nix-built candidate bundle SHA-256 was
  `d1c9ffdfd0db3e9ba86704a056822abbcd0952fd6f5ee57513c6f61b4c0dd2b1`.
- Baseline: [pinned provider](../baselines/sortable-git.provider.json), adapted
  sortable source revision `865673e04f869ec930423c3f05f939e2ec1a7313`; adapted
  bundle SHA-256 was
  `d48cb6d9ce2a63bd88637e8179192bcbf2154a67f43ac6b8880b2c095ad0e337`.

The baseline uses candidate helpers and ID construction, not the historical
package closure. Layout, random-byte counts, and state ownership differ. The
flake and name cases have no baseline. A secure random tail and no random tail
are different workloads, not interchangeable security profiles.

## Samples

| Case                                            | Samples in run order                                                   |  Median |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ------: |
| Sortable, zero-filled source                    | 85.119, 73.448, 72.036, 76.869, 80.787, 80.760, 74.754, 83.729         |  78.814 |
| Sortable, Web Crypto                            | 136.126, 133.811, 133.793, 132.646, 128.747, 128.089, 126.159, 135.734 | 133.219 |
| SHA-256 name-based UUIDv8                       | 241.348, 240.551, 240.376, 224.013, 228.248, 226.628, 234.336, 239.553 | 236.945 |
| Flake, 12 sequence and 62 node bits             | 20.110, 19.644, 19.527, 19.532, 19.613, 19.567, 19.514, 19.545         |  19.556 |
| Flake, 42 sequence and 32 node bits             | 25.514, 26.603, 24.936, 24.996, 24.765, 25.302, 24.562, 24.826         |  24.966 |
| Flake, 12 sequence and 32 node bits, Web Crypto | 161.408, 147.904, 149.396, 158.476, 152.648, 148.546, 148.639, 159.022 | 151.022 |
| Adapted baseline, zero-filled source            | 188.840, 187.753, 181.524, 184.365, 187.094, 183.820, 182.271, 184.926 | 184.645 |
| Adapted baseline, Web Crypto                    | 326.269, 307.483, 307.246, 311.439, 308.750, 307.645, 304.219, 306.566 | 307.564 |

The sortable candidate's batch medians were about 2.3 times faster in this run,
but the semantic and environmental differences prevent a general speedup claim.
The synthetic clock avoids the exhausted-tick path and does not demonstrate
sustained real-clock throughput. See the [instrument guide](../README.md).
