# Feature Specification: AnyFS Serve layers

**Spec ID:** 0001-anyfs-serve-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** AnyFS over HTTP: any AnyFS store served as WebDAV, class 1 and 2, on the POSIX view, so that an operating system mounts it with no kernel module and every answer says whether it was native, emulated or refused.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/`, `src/logical/` and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find nothing in the real tree.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check and the tests, and MUST fail on any finding that is not held by a baseline.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is run, **Then** the requirement holds, per FR-001.
2. **Given** the case of FR-002, **When** it is run, **Then** the requirement holds, per FR-002.

## Out of scope

- Properties stored by the server, shared locks and NFS: later specifications.

## Edge cases

- A file in no unit of the table is a finding of the layers check, per FR-001.

## Assumptions

- The library `@intellectual-frontiers/anyfs` is the host of the family and `@intellectual-frontiers/anyfs-posix` gives the view that every method is carried out on.

## Open questions

- None.

## Key entities

- **Handler** - a function from a Request to a Response that serves one store.
- **Exposure** - where the server may listen and which hosts it may be asked for.

## Success criteria

- **SC-001**: The tests of every requirement of the library pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
