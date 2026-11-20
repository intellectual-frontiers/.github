# Feature Specification: Archon layers

**Spec ID:** 0001-archon-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Archon is a library of commons built to Kanon (commons 0033-kanon): what a subject (a machine, a device, a workstation or a cloud account) must be is stated once in Governance, an order and a plan are made from it in Logical, and what carries it out is Physical, a port that a package for each tool implements. This specification is the table of the layers of the library, the public surface of its package and the checks that hold both. The decisions that made it are commons 0034-archon.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/` (Governance), `src/logical/` (Logical) and `src/physical/dialect/` (Physical, the port of the dialects), and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: Governance MUST import no unit of the library and no package but `@intellectual-frontiers/core`; Logical MUST import Governance, `@intellectual-frontiers/core` and `@intellectual-frontiers/crypto`; the dialect port MUST import Governance, Logical, `@intellectual-frontiers/core` and the governance and logical parts of `@intellectual-frontiers/headless`, and no other unit.
- **FR-003**: The package MUST export `.`, `./governance`, `./logical`, `./dialect` and `./cli`, and a dialect package or a plugin of the command MUST reach the library only through them.
- **FR-004**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the trace check, the layers check of Kanon, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The library MUST be released as `archon-v<version>` (commons 0026-works-versioning) with its release record `release.ts`, and MUST be published to the registries its manifest names.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001 and FR-002.
2. **Given** a file of Governance that imports Logical, **When** the layers check runs, **Then** it is a finding, per FR-002.
3. **Given** the manifest of the library, **When** its exports are read, **Then** they are `.`, `./governance`, `./logical`, `./dialect` and `./cli`, per FR-003.

## Out of scope

- The command line assembler, the tool server and the forced commands of the Physical layer: specified when they are built, in this kit.
- The dialects themselves: each is a package of its own (commons 0034-archon FR-005) with its own specification kit.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- An import of a private file of the library by a dialect package: it is a finding, per FR-003.

## Assumptions

- The shared checker of Kanon and the manifest check of the libraries are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **Archon** - the library.
- **Unit** - a folder of the library in one layer.

## Success criteria

- **SC-001**: The layers check of Kanon finds nothing in the real tree, and a deliberate breach of a row is found by its code.
- **SC-002**: A package for a dialect or a plugin needs only the public exports named here.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
