# Real-clock tick occupancy observation

This exploratory observation asks whether one Node process exhausted a UUIDv7
counter while generating identifiers against its actual default clock. It is not
a capacity guarantee, correctness proof, performance budget, or regression gate.

## Method and environment

On 2026-11-26, Node 24.21.0 and V8 13.6 ran on Linux 6.12.114 x86-64 on an Intel
Core i9-13900KF. Scheduler load, frequency, and CPU isolation were not
controlled. The candidate was a dirty working tree based on commit `bc3ef98`,
compiled with the changed clock sampler; it was not an immutable release build.

Each sample created one default `IdSortable` generator, using its default real
epoch clock and Web Crypto randomness. It attempted up to 100,000 IDs, stopping
at the first `tryGet()` exhaustion. Each emitted UUID timestamp was extracted
and counted in a map; the maximum count for any observed timestamp is reported.
One warmup preceded eight measured samples in the same process. Instrumentation
adds work per ID and can reduce observed tick occupancy. Counts are bucketed by
the encoded timestamp, not an independently measured physical clock.

The SHA-256 values of selected compiled candidate files were:

| File                 | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `dist/clock.js`      | `35473555cdbb9b7e861eabf620f4f7a798cf7085dc2e491b91a28c6d8d35b1f9` |
| `dist/IdSortable.js` | `f9ae62b9e73b8116928fd46722aa7b468b921303acf7e65d45b4982216b62b88` |
| `dist/utils.js`      | `9a67bffc6e2f2d88338d7b4396eddd982176d8928d18033ecf4f3dae845152d1` |

These file hashes do not identify all transitive dependencies or prove the
behavior of a subsequently released artifact.

## Observations

| Sample |     IDs | Exhausted | Observed timestamp buckets | Largest bucket | Elapsed ms |
| -----: | ------: | --------- | -------------------------: | -------------: | ---------: |
|      1 | 100,000 | no        |                        153 |            913 |    156.651 |
|      2 | 100,000 | no        |                        157 |            912 |    157.441 |
|      3 | 100,000 | no        |                        150 |            918 |    149.005 |
|      4 | 100,000 | no        |                        150 |            915 |    148.478 |
|      5 | 100,000 | no        |                        149 |            914 |    148.327 |
|      6 | 100,000 | no        |                        148 |            909 |    146.889 |
|      7 | 100,000 | no        |                        146 |            910 |    146.583 |
|      8 | 100,000 | no        |                        149 |            919 |    149.062 |

No sample exhausted; the largest observed bucket was 919 IDs, below the minimum
fresh-tick capacity of 2,049. This does not measure an uninstrumented peak, a
frozen or coarse clock, different random sources, other hardware, concurrent
processes, browsers, or deployed Workers. Clock stalls, rollback, restored
state, and different workloads can still exhaust a generator.
