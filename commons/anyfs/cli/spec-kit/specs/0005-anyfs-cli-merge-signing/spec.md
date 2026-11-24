# Feature Specification: Trust and keys in merge and sync-medium

**Spec ID:** 0005-anyfs-cli-merge-signing
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `merge` and `sync-medium` take `--trust open|allowlist|signed`, `--replicas`, `--roster` and `--sign-key`; a key or a roster is named by a file or by `env:NAME` and never by its text, a mount may say the trust and the keys, and a tool makes a key.

## Requirements

- **FR-001**: `merge` under `--trust signed --roster FILE` MUST refuse deltas that are not signed and say so by kind, and MUST take them when each is signed with the key of its origin (`--sign-key FILE[,FILE]`); `--trust allowlist --replicas ID[,ID]` and `--trust open` MUST do what they say.
- **FR-002**: A key and a roster MUST be named by a file or by `env:NAME`; an unset variable, text that is not a key and a roster that cannot be read MUST each be a usage error, and the private key MUST NOT appear in any answer.
- **FR-003**: `sync-medium` MUST sign what it publishes with the key of the replica of the store, MUST take only what the trust takes and say what it refused (`refused (unknown-key)`, with the problem `E-FILES-ASIDE`), and a key that is of another replica than the store's MUST be a usage error.
- **FR-004**: A mount MAY say `trust: { mode, roster, replicas, signKeys }`; the command line MUST override it, a mode with what it needs left out (signed with no roster, allowlist with no replicas, a roster with no mode) MUST be a usage error, and a mode that is not one of the three MUST be refused when the configuration is read.
- **FR-005**: A tool (`tools/keygen.ts`) MUST write a key for a replica to a file readable by its owner only, print the entry for the roster and never the private key, and never write over a file.

## Acceptance scenarios

1. **Given** a roster and two stores whose deltas are unsigned, **When** `merge --trust signed` is applied, **Then** each is refused as unsigned and the command ends with `E-MERGE-REFUSED`, per FR-001.

## Out of scope

- Trust for the mount of a medium. A verb that makes keys, and the distribution of rosters and the rotation of keys, are 0007-anyfs-cli-keys.

## Edge cases

- The usage errors are found before a plan is shown with `--dry-run`, so that a bad key is never first found when applying, per FR-002.

## Assumptions

- A key is of a replica and the replica is the one the store is.

## Open questions

- None.

## Key entities

- **Trust flags** - `--trust`, `--replicas`, `--roster`, `--sign-key`.

## Success criteria

- **SC-001**: A person can require signatures between fleets from the command line without a secret on it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
