# Feature Specification: AnyFS Mirror: conformance

**Spec ID:** 0005-mirror-conformance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The mirror is held to the laws of AnyFS like every store, and to the one fact that makes it worth having: the secondary holds what the primary holds.

## Requirements

- **FR-001**: A mirror of a Git branch and a SQLite file MUST pass every case of the conformance suite of AnyFS that its capabilities name, with the branch as the primary and with the file as the primary.
- **FR-002**: A mirror of memory, a folder and a SQLite file, in every order tried, MUST keep its stores the same after a run of writes, as `verify` and a comparison of the stores say.
- **FR-003**: After a run of writes and a delete through a mirror of a Git branch and a SQLite file, a new connection to the file MUST hold the paths, the revisions and the bytes of the branch, and a file made new MUST be made the same as the branch by one reconcile.

## Acceptance scenarios

1. **Given** a Git branch and a SQLite file, **When** the conformance suite is run on their mirror, **Then** every case passes, per FR-001.
2. **Given** the file is lost, **When** a new file is reconciled with the branch, **Then** it holds the branch, per FR-003.

## Out of scope

- The run against a Git host (`tools/acceptance-github.ts`: a branch on GitHub as the primary, through its API or through Git, and a SQLite file as the secondary): it needs a network and a token, so a person or an agent runs it and keeps its result as evidence in a tenant repository; `verify` does not.

## Edge cases

- A mirror of a store with fewer capabilities passes fewer cases (FR-001).

## Assumptions

- The stores of Git and SQL are held to the same suite by their own libraries.

## Open questions

- None.

## Key entities

- **Conformance case**.

## Success criteria

- **SC-001**: The mirror passes the same number of cases as the store it mirrors from.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
