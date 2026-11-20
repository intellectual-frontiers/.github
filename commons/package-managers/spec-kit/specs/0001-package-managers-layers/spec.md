# Feature Specification: The shared kit of the dialects that drive a package manager for Archon (commons archon 0004-archon-dialects) and Toolchain (commons toolchain 0003-toolchain-logical): it is a library in the layers of Kanon, and the dialects of Homebrew, apt, WinGet and mise are packages of their own that hold only the data of a manager. Kanon lets a dialect reach its host and no other member of the family, so the code the dialects share lives in a library that is no member.

**Spec ID:** 0001-package-managers-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** 

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with `src/governance/`, `src/logical/` and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: Governance MUST import nothing but `@intellectual-frontiers/core`; Logical MUST import Governance, `core`, and the governance and dialect port of Archon and the governance and logical of Toolchain; Physical MUST import Governance, Logical, `core`, the process module of `@intellectual-frontiers/system`, and Archon and Toolchain by their exports; no unit MUST import a dialect package.
- **FR-003**: The package MUST export `.`, `./governance`, `./logical` and `./physical`.
- **FR-004**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The library MUST be released as `package-managers-v<version>` (commons 0026-works-versioning).
- **FR-006**: Governance and Logical MUST do no input or output: they MUST NOT read a file, reach the network or run a program; only the runner of Physical runs one.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001 and FR-002.
2. **Given** a file of Logical that imports the process module, **When** the layers check runs, **Then** it is a finding, per FR-002 and FR-006.

## Out of scope

- The dialects of the managers: packages of their own.
- Reading the commands from the ontology: the reader of the ontology (`supply-chain/commands`) is a source this kit takes as a function.

## Edge cases

- The module at the top of `src/` that re-exports the layers is in a unit of its own and reaches them by relative path, per FR-001.

## Assumptions

- The layers check of Kanon is the one place the import rules are held.

## Open questions

- None.

## Key entities

- **Kit** - this library: the code the dialects of the managers share.

## Success criteria

- **SC-001**: A manager dialect is data and a few lines, and holds no logic of its own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
