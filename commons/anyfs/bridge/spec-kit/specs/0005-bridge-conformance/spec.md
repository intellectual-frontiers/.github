# Feature Specification: AnyFS Bridge: conformance

**Spec ID:** 0005-bridge-conformance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The laws every pair of stores keeps under these transfers, run by a backend's tests against stores it makes.

## Requirements

- **FR-001**: The library MUST give a suite of laws that a backend runs with a function that makes a pair of empty stores: a plan changes neither store, a plan is deterministic, a copy makes the destination hold the source and a check then finds nothing, a copy never deletes, a sync is idempotent, a sync over its allowance is refused, a plan whose source changed is refused, and an update does not replace a file that changed after the plan where the destination can tell; and every law MUST hold between stores in memory and in a folder in every pairing and for a destination with no `cas`.
- **FR-002**: A pair that breaks a law MUST fail that law with a sentence that names what differed, and a store that cannot be listed MUST fail the laws that list and MUST NOT make the suite throw.

## Acceptance scenarios

1. **Given** two stores in memory, **When** the suite runs, **Then** every law passes, per FR-001.
2. **Given** a destination that says it deleted and did not, **When** the suite runs, **Then** the law of the idempotent sync fails with its name, per FR-002.

## Out of scope

- Laws of a transfer between three stores or of a mirror: they are held by the tests of the library (0004-bridge-twoway).

## Edge cases

- A law that needs `cas` returns where the destination has none (FR-001).

## Assumptions

- The function that makes a pair makes new, empty stores for each law.

## Open questions

- None.

## Key entities

- **BridgeCase**, **Pair**, **MakePair**.

## Success criteria

- **SC-001**: Every behaviour is tested over stores in memory and, where it touches a file system, stores in a folder, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
