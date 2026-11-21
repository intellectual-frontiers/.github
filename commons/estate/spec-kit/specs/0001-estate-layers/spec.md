# Feature Specification: Estate: layers

**Spec ID:** 0001-estate-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Estate holds the assets of an organization: what state each is in, what that state offers, what is declared of each against what is observed, and which system owns each capability. It is a library in the layers of Kanon (commons 0033-kanon), reserved as the family of its name, with no input or output of its own: the observation of a real machine is a dialect or a connector, which gives the library what it saw.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with `src/governance/` and `src/logical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: Governance MUST import nothing but `@intellectual-frontiers/core` and the governance of `@intellectual-frontiers/grc` (for durations); Logical MUST import Governance, `core` and the governance and logical of `@intellectual-frontiers/grc`; no unit MUST reach another by a relative path.
- **FR-003**: The package MUST export `.`, `./governance` and `./logical`.
- **FR-004**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The library MUST be released as `estate-v<version>` (commons 0026-works-versioning) and MUST be held until the owner says it is ready.
- **FR-006**: No source of the library MUST read a file, reach the network or run a program.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** it finds nothing, per FR-001 and FR-002.
2. **Given** a source that imports the process module, **When** the sources are read, **Then** it is a finding, per FR-006.

## Out of scope

- Observing a machine: a dialect or a connector.
- Storing an estate: it is typed data in files, kept by Git.

## Edge cases

- The module at the top of `src/` that re-exports the layers is in a unit of its own, per FR-001.

## Assumptions

- The reserved name of the library makes it the host of a family of its own, declared in its manifest.

## Open questions

- None.

## Key entities

- **Estate** - the assets of an organization.

## Success criteria

- **SC-001**: The library does no input or output, so every function of it is a pure function a test can run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
