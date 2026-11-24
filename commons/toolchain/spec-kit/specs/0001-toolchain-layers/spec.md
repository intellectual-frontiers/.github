# Feature Specification: Toolchain layers

**Spec ID:** 0001-toolchain-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Toolchain is the library of commons that says which programs a computer needs to do its work (a workstation, a build host, a runner, an agent's sandbox), once, and resolves each to the way it is carried out. It is built to Kanon (commons 0033-kanon) on the public port of the dialects of Archon (commons archon 0004-archon-dialects): Governance is the declaration of a tool, Logical is the resolution of a tool to a dialect and the plan that follows, and what carries it out is a dialect package (`archon-dialect-native-pinned` by default, and one for each package manager a fleet prefers). The library holds no network, file or process code: that is the dialects'. Its one adapter reads the packaging ontology, where every version and hash is written once. It has no backward compatibility to keep: it is the first of its kind, and the toolchain of `agora` adopts it.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/` (Governance), `src/logical/` (Logical) and `src/physical/ontology/` (Physical, the one adapter), and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: Governance MUST import no unit of the library and no package but `@intellectual-frontiers/core`, the digest type of `@intellectual-frontiers/crypto` and the governance of `@intellectual-frontiers/archon`; Logical MUST import Governance, `@intellectual-frontiers/core` and the governance of `@intellectual-frontiers/archon`, and the adapter MUST import Governance, Logical, `@intellectual-frontiers/core` and the downloads of `@intellectual-frontiers/ontology`, and no other unit.
- **FR-003**: The package MUST export `.`, `./governance`, `./logical` and `./ontology`, and a dialect package or a consumer MUST reach the library only through them.
- **FR-004**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The library MUST be released as `toolchain-v<version>` (commons 0026-works-versioning), and its name MUST be one that `commons/libraries` holds for it.
- **FR-006**: The library MUST do no input or output: it MUST NOT read a file, reach the network or run a program, so that every function of it is pure and the dialects are the only place a tool is obtained.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001 and FR-002.
2. **Given** a file of Governance that imports Logical, **When** the layers check runs, **Then** it is a finding, per FR-002.
3. **Given** the sources of the library, **When** they are read, **Then** none imports a module of Node for files, the network or processes, per FR-006.

## Out of scope

- Obtaining a tool: the dialect packages, each with its own specification kit.
- The command a person types (`archon tool ...`): a plugin of the command, a package of its own.
- Reading what is installed on a computer: the dialects and the estate library.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A source that imports `node:fs`: it is a finding, per FR-002 and FR-006.

## Assumptions

- The shared checker of Kanon and the manifest check of the libraries are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **Toolchain** - the library.
- **Tool** - a program a computer needs, declared once.

## Success criteria

- **SC-001**: The layers check of Kanon finds nothing in the real tree, and a deliberate breach of a row is found by its code.
- **SC-002**: A dialect package needs only the public exports named here.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
