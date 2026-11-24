# Feature Specification: AnyFS POSIX: conformance

**Spec ID:** 0005-anyfs-posix-conformance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** One suite that every view of a store passes, chosen by the capabilities of the store, with a reference model the answers are compared with, so that a view that pretends is found.

## Requirements

- **FR-001**: The suite MUST be exported as cases, each with the capabilities the store must have and must not have, and whether it needs a trace of the operations of the store; `casesFor` MUST choose the cases a store is held to, and `runPosixConformance` MUST run them against worlds made by a function and report, for each case, a sentence that says what differed where it failed.
- **FR-002**: The suite MUST pass for a store in memory, for a store in a folder and for a store of the core capabilities alone, each under the policy that keeps no marker and the policy that keeps them, and MUST read the fidelity of what it does.
- **FR-003**: The model cases MUST run a seeded sequence of operations on a small set of names against the view and against the reference model, MUST compare the answers at every step and the two trees at the end, and MUST name the seed, the step and the operation of a difference; the same seed MUST give the same sequence on every run.
- **FR-004**: The suite MUST find a view that pretends: a view that gives a fidelity other than the one `explain` gives, a view that loses bytes and a view that uses an operation its plan does not name MUST each fail a case with a sentence.

## Acceptance scenarios

1. **Given** the store in memory, **When** the suite runs, **Then** every case it is held to passes, per FR-002.
2. **Given** a view that reports `native` for a copy and a delete, **When** the suite runs, **Then** a case fails and says which fidelity differed, per FR-004.
3. **Given** the seed 3, **When** the model case runs twice, **Then** it gives the same operations, per FR-003.

## Out of scope

- A suite for the servers and the command line over the view: their own.

## Edge cases

- A case that needs a trace is run only for a world that gives one (FR-001).
- A case that needs `cas` is not run for a store without it, and a case that lacks it is not run for a store with it (FR-001).

## Assumptions

- The library `@intellectual-frontiers/anyfs` is the host of the family and gives the store, its capabilities and its problems.

## Open questions

- None.

## Key entities

- **Case** - one thing every view does, with what the store must and must not have.
- **World** - a view and, where recorded, the operations of its store.
- **PosixModel** - the reference the answers are compared with.

## Success criteria

- **SC-001**: A view over any store that passes the suite gives the answers of a file system as this library states them, and says where it does not.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
