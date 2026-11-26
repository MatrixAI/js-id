---
title: 'Name-Based UUIDv8 Identifiers'
description:
  'Define deterministic SHA-256 identifiers without mislabeling UUIDv5.'
type: adr
category: architecture
tags:
  - uuid
  - hashing
  - deterministic
status: proposed
created: 2026-11-26
updated: 2026-11-26
author: 'Matrix AI'
project: 'js-id'
---

# ADR-0005: Name-Based UUIDv8 Identifiers

## Status

Proposed. This custom UUIDv8 profile has local implementation and selected test
evidence, but is not accepted or released.

## Context

### Background and Problem Statement

Deterministic IDs bind canonical names to namespaces. Existing UUIDv5 uses
SHA-1; RFC 9562 requires newer name-based hash profiles to use UUIDv8.

### Current Limitations

Changing hashing or namespace derivation changes identifier bytes. Deterministic
values do not by themselves provide authentication or protect low-entropy names.

## Decision Drivers

### Primary Decision Drivers

- Specify a reproducible SHA-256 name-based UUIDv8 profile.
- Avoid representing SHA-256 output as UUIDv5.

### Secondary Decision Drivers

- Support interoperable byte order and deterministic test vectors.
- Explicitly state name normalization and security limitations.

## Considered Options

### Option 1: SHA-256 UUIDv8 profile

**Description:** Hash a namespace and canonical name with SHA-256.

**Technical Characteristics:** Apply UUIDv8 and variant bits to truncated
output.

**Advantages:** Uses a modern hash and follows the RFC version boundary.

**Disadvantages:** Existing deterministic UUIDv5 values differ.

**Risk Assessment:** Name and namespace ambiguity changes the resulting
identity.

### Option 2: SHA-256 with UUIDv5 bits

**Description:** Change the hash while retaining the version-5 marker.

**Technical Characteristics:** The output appears to be standard UUIDv5.

**Advantages:** Existing version checks would see version 5.

**Disadvantages:** The output is not conforming UUIDv5.

**Risk Assessment:** Interoperating systems derive different bytes.

## Decision

Propose option 1 with an explicitly documented project profile.

<a id="REQ-ID-NAME-001"></a>

### REQ-ID-NAME-001 - Hash profile

Status: target<br> Normative Level: MUST<br> Verification Class:
hash-vectors<br> Evidence Status: unevidenced

The SHA-256 name-based profile MUST hash the 16 namespace UUID bytes in network
byte order followed by the canonical name bytes, take the first 16 digest bytes,
and set UUIDv8 and RFC variant bits. The namespace and input conversion MUST be
explicit, deterministic, and documented; UUIDv8 bits alone do not identify the
hash algorithm or namespace policy.

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        digest bits 0..31                      |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       digest bits 32..47      |  1000 |  digest bits 52..63   |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|1 0|                    digest bits 66..95                     |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       digest bits 96..127                     |
-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

The fixed version and variant replace digest bits 48 through 51 and 64 through
65, respectively. The remaining bits are taken from the first 128 digest bits.

For a byte namespace, the input MUST contain exactly 16 bytes and the generator
MUST copy it. A string namespace is first encoded as a name under the all-zero
UUID namespace using this same profile. For example, the RFC Appendix B.2 DNS
namespace and `www.example.com` produce `5c146b14-3c52-8afd-938a-375d0df1fbf6`.
This vector uses a byte namespace; it does not specify the separate
string-namespace derivation rule.

<a id="REQ-ID-NAME-002"></a>

### REQ-ID-NAME-002 - Name canonicalization

Status: target<br> Normative Level: MUST<br> Verification Class:
cross-runtime<br> Evidence Status: unevidenced

String names MUST use documented UTF-8 conversion. The API MUST specify whether
any Unicode normalization is applied and MUST NOT silently equate different
names through undocumented transformations.

The profile uses TextEncoder UTF-8 conversion without Unicode normalization;
unpaired UTF-16 surrogates are replaced as specified by that encoder. Callers
who need case folding, normalization, or structured-name canonicalization MUST
do so explicitly and consistently before invoking the generator.

<a id="REQ-ID-NAME-003"></a>

### REQ-ID-NAME-003 - Security boundary

Status: target<br> Normative Level: MUST NOT<br> Verification Class:
security-boundary<br> Evidence Status: unevidenced

The name-based UUID MUST NOT be presented as a credential, secret, password
hash, or collision-proof proof of a name. Changing namespace or name changes the
identifier and requires a consuming-domain decision.

## Consequences

### Positive

- SHA-256 output is labeled as a custom UUIDv8 profile.

### Negative

- The hard cut changes deterministic output for existing inputs.

### Neutral

- Standard UUIDv5 remains a separate standardized algorithm if offered.

## Decision Outcome

Use an explicitly specified SHA-256 UUIDv8 profile for modern name-based IDs.

## Related Decisions

- [Identifier values](../0001-identifier-values-and-representations/adr.md).
- [Cross-runtime boundaries](../0006-cross-runtime-boundaries/adr.md).

## Links

- [Current deterministic generator](../../src/IdDeterministic.ts).
- [Current deterministic tests](../../tests/IdDeterministic.test.ts).

## More Information

RFC 9562 Appendix B.2 provides an illustrative SHA-256 name-based UUIDv8 vector.
The [assurance graph](assurance.json) distinguishes the RFC vector, independent
Node hash comparisons, and selected browser execution from exhaustive proof.

## Audit

### 2026-11-26

**Status:** Pending

**Findings:**

| Finding                       | Files                                     | Lines | Assessment |
| ----------------------------- | ----------------------------------------- | ----- | ---------- |
| Current generator uses UUIDv5 | [Generator](../../src/IdDeterministic.ts) | -     | pending    |

**Summary:** The proposed SHA-256 profile is not implemented or verified.

**Action Required:** Select input APIs and prove RFC and cross-runtime vectors.

### 2026-11-26

**Status:** Partial

**Findings:**

| Finding                                                       | Files                                        | Lines | Assessment |
| ------------------------------------------------------------- | -------------------------------------------- | ----- | ---------- |
| Byte namespaces match the RFC Appendix B.2 vector             | [Tests](../../tests/IdDeterministic.test.ts) | -     | partial    |
| SHA-256 inputs are checked against Node's hash implementation | [Tests](../../tests/IdDeterministic.test.ts) | -     | partial    |
| Synchronous SHA-256 replaces the UUID package dependency      | [Generator](../../src/IdDeterministic.ts)    | -     | partial    |

**Summary:** The generator copies 16-byte namespaces and derives string
namespaces from the nil UUID using the same profile. UTF-8 conversion uses
standard replacement of unpaired surrogates without normalization. Node tests
pass; the updated browser and dedicated-worker vectors remain to be rerun.

**Action Required:** Verify cross-runtime vectors, performance, and downstream
hard-cut decisions for persisted deterministic IDs.

### 2026-11-26

**Status:** Partial

**Findings:**

| Finding                                                       | Files                                                | Lines | Assessment |
| ------------------------------------------------------------- | ---------------------------------------------------- | ----- | ---------- |
| The RFC vector runs in Chromium document and dedicated worker | [Browser scenario](../../tests/browser/scenarios.ts) | -     | partial    |
| Historical deterministic IDs require consumer decisions       | [Assurance](assurance.json)                          | -     | pending    |

**Summary:** Local Node and selected Chromium executions passed; earlier audit
entries record historical implementation and verification state.

**Action Required:** Review cutover and verify any additional claimed runtime.
