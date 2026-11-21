# Feature Specification: AnyFS: layers

**Spec ID:** 0001-anyfs-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** AnyFS is one typed interface to the places bytes live. It is a library in the layers of Kanon (commons 0033-kanon), reserved as the family of its name: its backends are plugins named `anyfs-<noun>`, and the library itself ships the memory and the local backends with the conformance suite every backend passes.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with `src/governance/`, `src/logical/` and the physical units `src/physical/memory/`, `src/physical/local/` and `src/physical/` (the entry of the stores and the tracer made from telemetry), and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: Governance MUST import nothing but `@intellectual-frontiers/core`; Logical MUST import Governance and `core` and nothing else; the memory unit MUST import only `core` and the SHA-256 of `crypto`; the local unit MUST import only `core`, the SHA-256 of `crypto` and the files, paths, locks and errors of `system`; the physical unit MUST import only Governance, Logical, the two stores, `core` and `telemetry`; no unit MUST reach another by a relative path.
- **FR-003**: The package MUST export `.`, `./governance`, `./logical`, `./physical`, `./layers`, `./conformance`, `./memory` and `./local`.
- **FR-004**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline.
- **FR-005**: The library MUST be released as `anyfs-v<version>` (commons 0026-works-versioning) and MUST be held until the first consumer runs on it.
- **FR-006**: No source of Governance, Logical or the memory backend MUST read a file, reach the network or run a program: they MUST be functions of their arguments, with the clock, the sleep and the tracer as ports.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** it finds nothing, per FR-001 and FR-002.
2. **Given** a source of Logical that imports the file module of `system`, **When** the layers check runs, **Then** it is a finding, per FR-002.
3. **Given** a source of Logical that reads a file, **When** the sources are read, **Then** it is a finding, per FR-006.

## Out of scope

- A backend for a particular place (SSH, Git, a database, a bucket, a drive): a plugin library of its own.

## Edge cases

- The module at the top of `src/` and the one at the top of `src/physical/` that re-export the units are units of their own (FR-001).

## Assumptions

- The name of the library is reserved as the family of its plugins.

## Open questions

- None.

## Key entities

- **Store** - a typed interface to one place.

## Success criteria

- **SC-001**: A backend that reaches into another unit by a relative path cannot pass the layers check.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
