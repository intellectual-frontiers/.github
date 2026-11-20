# Feature Specification: Repoctl layers

**Spec ID:** 0001-repoctl-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Repoctl is the operations program of this repository: the one command, `repoctl`, that makes the generated files, merges, checks, tells the versions, releases, scaffolds a library, commits and says what is wrong with a checkout. It is a headless program (commons headless) built to Kanon (commons 0033-kanon): Governance says what it is, Logical is what each verb reasons with, and Physical is what touches the world. It calls the existing programs of commons as functions or through the process port and does not make their logic again.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/` (Governance), `src/logical/` (Logical) and `src/physical/` (Physical), and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: Governance MUST import no unit of the library and no package but `@intellectual-frontiers/core` and the governance of `@intellectual-frontiers/headless`; Logical MUST import Governance, `@intellectual-frontiers/core` and the governance and logical layers of `@intellectual-frontiers/headless`; and Physical MUST import Governance, Logical and the packages its row names, and no other unit, each unit reaching another only through the package's exports.
- **FR-003**: The package MUST export `.`, `./governance`, `./logical` and `./physical`, and a consumer MUST reach the library only through them.
- **FR-004**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check and the tests, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The version the program says (`REPOCTL_VERSION`) MUST be the version of the library, and the manifest MUST name that constant in `versionConstants` so that the release writes it and `repoctl check` finds it where it disagrees.
- **FR-006**: Governance and Logical MUST do no input or output: they MUST NOT import a module of Node, the system or the network, and every effect (running a program, reading or writing a file, asking the registry of npm, reading a credential) MUST go through a port of Logical that Physical fills.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001 and FR-002.
2. **Given** a file of Governance that imports Logical, **When** the layers check runs, **Then** it is a finding, per FR-002.
3. **Given** the package, **When** its exports are read, **Then** they are the four entries, per FR-003.
4. **Given** the `verify` script, **When** it is read, **Then** it runs every check, per FR-004.
5. **Given** the manifest, the package, the record and the constant, **When** they are read, **Then** they say one version, per FR-005.
6. **Given** the sources of Governance and Logical, **When** they are read, **Then** none imports a module of Node or of the system, per FR-006.

## Out of scope

- The verbs themselves: the next specifications.
- The packing of the library for npm: the packer of commons.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A source of Logical that imports `node:fs`: it is a finding, per FR-002 and FR-006.
- A release that raises the manifest and the package and leaves `REPOCTL_VERSION` behind: `repoctl check` finds it, per FR-005.

## Assumptions

- The libraries of commons that Repoctl calls (`libraries`, the tools of commons) are on the branch that holds it, and `git`, `bun` and `node` are installed.

## Open questions

- None.

## Key entities

- **Repoctl** - the library and its command.
- **Layer** - Governance, Logical or Physical.

## Success criteria

- **SC-001**: The layers check of Kanon finds nothing in the real tree, and a deliberate breach of a row is found by its code.
- **SC-002**: No effect of a verb is outside Physical.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
