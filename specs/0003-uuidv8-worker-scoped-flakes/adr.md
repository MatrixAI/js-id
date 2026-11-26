---
title: 'Configurable UUIDv8 Flake Identifiers'
description: 'Define configurable time-sortable node-aware UUIDv8 profiles.'
type: adr
category: architecture
tags:
  - uuid
  - flake
  - workers
status: proposed
created: 2026-11-26
updated: 2026-11-26
author: 'Matrix AI'
project: 'js-id'
---

# ADR-0003: Configurable UUIDv8 Flake Identifiers

## Status

Proposed. The profile is project-specific and does not imply a universal UUIDv8
format.

## Context

### Background and Problem Statement

Some consumers need an explicit worker component rather than UUIDv7's random
tail. Worker identity, ownership, and durable sequence state require
coordination.

### Current Limitations

A truncated node identifier cannot safely be assumed unique. UUID version bits
cannot identify a custom UUIDv8 profile or its field widths.

## Decision Drivers

### Primary Decision Drivers

- Separate worker-scoped allocation from standard UUIDv7.
- Make worker ownership, counter exhaustion, and crash safety explicit.

### Secondary Decision Drivers

- Keep a 128-bit value usable in UUID-oriented databases.
- Avoid a separate 64-bit numeric protocol without a demonstrated requirement.

## Considered Options

### Option 1: Worker-scoped UUIDv8 profile

**Description:** Encode time, a caller-sized sequence, node prefix, and random
tail in UUIDv8.

**Technical Characteristics:** The caller coordinates worker and durable state.

**Advantages:** The value fits UUID and byte-oriented storage boundaries.

**Disadvantages:** The format is custom and exposes time and worker information.

**Risk Assessment:** Worker reuse or unsafe restart can generate duplicates.

### Option 2: Use only random UUIDv7

**Description:** Do not expose a worker-scoped generation profile.

**Technical Characteristics:** Independent generators rely on random entropy.

**Advantages:** Standard UUIDv7 interoperability without worker allocation.

**Disadvantages:** Explicit worker-scoped allocation is unavailable.

**Risk Assessment:** Consumers may invent incompatible ad hoc node layouts.

### Option 3: Worker-prefixed UUIDv7 tail

**Description:** Retain a caller-selected worker prefix within the UUIDv7 tail.

**Technical Characteristics:** The standard timestamp and version remain, but
worker width, remaining entropy, and allocation policy must be defined
separately. The old generator exposed variable-length node bytes in this part of
its tail.

**Advantages:** Retains a UUIDv7 representation and a recognizable node-prefix
capability without introducing a separate UUIDv8 layout.

**Disadvantages:** Reserving tail bits reduces the random space and does not by
itself coordinate worker ownership or durable restart state. It also keeps the
UUIDv7 counter capacity rather than allowing a configurable wider sequence.

**Risk Assessment:** Different prefix widths or allocation assumptions can
interoperate syntactically while colliding semantically.

### Option 4: Fixed 42-bit sequence and 32-bit worker

**Description:** Allocate one unchanging layout to all flake callers.

**Technical Characteristics:** A 42-bit sequence and 32-bit worker consume the
entire payload, with no random tail.

**Advantages:** One simple profile with a large per-timestamp sequence space.

**Disadvantages:** It cannot retain the former wider variable node prefix or let
callers trade worker width for random bits.

**Risk Assessment:** Truncating arbitrary node identifiers to 32 bits can cause
collisions, and a large counter does not eliminate allocation or restart risks.

## Decision

Propose option 1 as an explicit alternative to the default UUIDv7 generator. RFC
9562 recommends UUIDv8 for embedded node IDs but does not require a separate
class. This proposal preserves the former variable-width node-prefix capability
without retaining the old nonstandard timestamp layout. It replaces the earlier
fixed 42/32 proposal with caller-selected allocation, not a universal UUIDv8
interpretation.

<a id="REQ-ID-FLAKE-001"></a>

### REQ-ID-FLAKE-001 - Layout

Status: target<br> Normative Level: MUST<br> Verification Class:
binary-profile<br> Evidence Status: partial

The profile MUST encode a 48-bit big-endian Unix millisecond timestamp and a
74-bit payload in network order, with UUIDv8 version and RFC variant bits in
their mandated positions. The payload MUST contain a sequence, leading node
bits, and random tail in that order. The version occupies the high nibble of
byte 6; the variant occupies the high two bits of byte 8; the payload fills the
other bits after the timestamp in order, including across those reserved fields.

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         unix_ts_ms                            |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          unix_ts_ms           |  1000 |    payload bits 0..11 |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|1 0|                    payload bits 12..41                    |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       payload bits 42..73                     |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

Payload bits are numbered in logical order, excluding version and variant bits.
The sequence, node prefix, or random tail can cross the variant gap.

The sequence width MUST be an integer from 1 through 74; the node width MUST be
a nonnegative integer such that their sum is at most 74 and the input supplies
that many bits. Remaining payload bits are random. The default sequence width is
12; the default node width is the input length in bits capped at 62. The node
prefix is read most-significant bit first, and longer input is truncated, not
hashed. Extracted partial bytes MUST be left-aligned and zero-padded. A caller
may specify larger node widths when they fit and are present in the supplied
input.

For example, 42 sequence bits and 32 node bits leave no random tail. Timestamp
1645557742000, sequence 0, and node bytes 0x12345678 encode as
`017f22e2-79b0-8000-8000-000012345678`. A 12-bit sequence and 62 node bits also
leave no random tail; with 32 node bits, 30 bits remain random. UUIDv8 only
signals a custom layout; another UUIDv8 is not thereby this flake profile.

<a id="REQ-ID-FLAKE-002"></a>

### REQ-ID-FLAKE-002 - Allocation and state

Status: target<br> Normative Level: MUST<br> Verification Class:
coordination<br> Evidence Status: partial

The caller MUST establish a shared allocation, allocate non-overlapping node
prefixes, ensure exclusive state ownership, and persist or reserve state before
exposing IDs when crash-safe uniqueness is required. Different node widths can
overlap, and different profiles may produce the same bytes. Truncating a key is
not an allocation scheme and MUST NOT be claimed to establish node uniqueness.

Allocation must cover the lifetime and reuse of a node's persisted sequence
space, not just concurrent processes. Persisting only after publishing an ID can
reissue it after a crash. A reservation scheme or durable high-water mark is a
consumer decision and is not implemented by the generator. If no random bits are
allocated, the generator MUST NOT require or call the random source.

<a id="REQ-ID-FLAKE-003"></a>

### REQ-ID-FLAKE-003 - Counter exhaustion

Status: target<br> Normative Level: MUST<br> Verification Class:
monotonicity<br> Evidence Status: partial

The generator MUST reset the sequence only when its timestamp advances, hold the
prior timestamp on rollback, and throw a RangeError before the configured
sequence wraps. It MUST reject a restart ID whose node bits do not match.

At a new timestamp the sequence begins at zero; at the same or an earlier
observed timestamp it increments while holding the prior timestamp. Invalid
timestamps, a mismatched node, invalid source results, and exhausted state raise
RangeError; a thrown source error propagates. Failures MUST NOT commit partial
generator state. Returned and supplied mutable values MUST NOT change its state.
Sequence extraction MUST preserve precision for widths above 53 bits. The
last-generated accessor is unavailable before this instance produces an ID.

<a id="REQ-ID-FLAKE-004"></a>

### REQ-ID-FLAKE-004 - Provenance and secrecy

Status: target<br> Normative Level: MUST<br> Verification Class:
profile-boundary<br> Evidence Status: unevidenced

Consumers MUST establish profile provenance outside UUIDv8 version bits and MUST
NOT treat a flake ID as a secret, capability, or globally ordered timestamp. The
agreed sequence and node widths are required for interpretation and restart;
validation of the version, variant, and node bits cannot prove those widths or
distinguish this profile from other UUIDv8 profiles. Sequence precedes node
bits, so distinct nodes do not establish global issuance order within one
millisecond.

## Consequences

### Positive

- Worker-scoped values have an explicit binary profile and failure boundary.

### Negative

- Correctness depends on external worker and durable-state coordination.

### Neutral

- Native 64-bit Snowflake formats remain outside this decision.

## Decision Outcome

Provide an opt-in configurable node-aware UUIDv8 profile alongside UUIDv7.

## Related Decisions

- [UUIDv7 sortable generation](../0002-uuidv7-sortable-generation/adr.md).

## Links

- [Flake generator](../../src/IdFlake.ts).
- [Flake tests](../../tests/IdFlake.test.ts).

## More Information

RFC 9562 reserves UUIDv8 for explicitly defined custom formats. The
[assurance graph](assurance.json) distinguishes local layout tests from the
unverified external coordination and persistence obligations.

## Audit

### 2026-11-26

**Status:** Partial

**Findings:**

| Finding                                                                 | Files                             | Lines | Assessment |
| ----------------------------------------------------------------------- | --------------------------------- | ----- | ---------- |
| Local layout and targeted tests exist                                   | [Generator](../../src/IdFlake.ts) | -     | partial    |
| Distributed ownership and crash persistence are caller responsibilities | -                                 | -     | pending    |

**Summary:** The targeted tests do not prove distributed worker allocation.

**Action Required:** Verify binary vectors, runtime boundaries, and caller
guidance.

### 2026-11-26

**Status:** Partial

**Findings:**

| Finding                              | Files                                | Lines | Assessment |
| ------------------------------------ | ------------------------------------ | ----- | ---------- |
| Exhaustion uses a generic RangeError | [Generator](../../src/IdFlake.ts)    | -     | partial    |
| Coordination remains caller-owned    | [Tests](../../tests/IdFlake.test.ts) | -     | partial    |

**Summary:** The proposed error requirement now names the native error type; no
custom error class or error-package dependency is required.

**Action Required:** Review the proposed record and its coordination guidance
before release.

### 2026-11-26

**Status:** Partial

**Findings:**

| Finding                                                               | Files                                | Lines | Assessment |
| --------------------------------------------------------------------- | ------------------------------------ | ----- | ---------- |
| Local layout, worker boundary, and exhaustion cases exist             | [Tests](../../tests/IdFlake.test.ts) | -     | partial    |
| Durable reservation and exclusive allocation are not implemented here | [Assurance](assurance.json)          | -     | pending    |

**Summary:** The flake is a new optional profile, not a replacement for random,
name-based, or standard UUIDv7 generation.

**Action Required:** Consumers must design and verify coordination before
relying on uniqueness.

### 2026-11-26

**Status:** Partial

**Findings:**

| Finding                                                         | Files                                | Lines | Assessment |
| --------------------------------------------------------------- | ------------------------------------ | ----- | ---------- |
| Configurable allocation replaces the earlier fixed 42/32 target | [Generator](../../src/IdFlake.ts)    | -     | partial    |
| Local cases compare field layouts and counter boundaries        | [Tests](../../tests/IdFlake.test.ts) | -     | partial    |
| Shared profile allocation and durable state remain external     | [Assurance](assurance.json)          | -     | pending    |

**Summary:** The earlier fixed-width findings describe the prior proposal, not
the current configurable target. Local tests cannot prove distributed ownership.

**Action Required:** Review allocation policy, profile provenance, performance,
and deployed runtimes before release.
