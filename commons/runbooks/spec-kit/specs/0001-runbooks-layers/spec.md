# Feature Specification: Runbooks layers

**Spec ID:** 0001-runbooks-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Runbooks: typed procedures in which a person or an agent orchestrates and every effect is a deterministic verb of the pinned packages, with effects, derived autonomy, static checks and projections for each harness and for auditors. It is built to Kanon (commons 0033-kanon): Governance says what it is, Logical is the model it reasons with, and Physical is what touches the world. It is modelled on the workbench (commons workbench 0001-workbench-layers) and reuses its governance types by package name.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/`, `src/logical/` and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-003**: The library MUST import the workbench, planning, grc and anyfs only by package name and only their governance entries (and the evaluation, the composition and the matrix of the logical entry of the workbench), never by a relative path out of its folder, and MUST add no kind of item to planning and no control vocabulary to grc.
- **FR-004**: The governance entry MUST export the types, the closed vocabularies, the registry of verbs by id, the decoder of a runbook and the starter runbooks as typed data, and the logical entry MUST export the checks, the derivations, the projections and the fold, so that a program loads a runbook by `import` and never by reading a file.
- **FR-005**: The manifest MUST declare `distribution` as `github` and `npm`, and the folder MUST have `tools/pack.ts`, which packs the library without publishing it.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the package of the library, **When** its `verify` script is read, **Then** it runs every check, per FR-002.
3. **Given** the sources of the library, **When** their imports are read, **Then** every import of another library names its package and a governance entry or the allowed logical entry, per FR-003.
4. **Given** the entries of the package, **When** they are imported by a program, **Then** the registry of verbs, the decoder and a starter runbook are values it can use, per FR-004.
5. **Given** the manifest, **When** it is read, **Then** it names `github` and `npm` and the folder holds `tools/pack.ts`, per FR-005.

## Out of scope

- Everything the library does: its next specifications.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A `verify` that leaves out a check: it is a finding of the test, per FR-002.
- An import of `@intellectual-frontiers/planning` from outside its governance entry: it is a finding of the layers check, per FR-003.

## Assumptions

- The shared checker of Kanon and the manifest check of the libraries are on the branch that holds this library.
- Nothing is published by this library's change: it adds the wiring of its distribution only (the release is a separate act of the owner).

## Open questions

- None.

## Key entities

- **Runbooks** - the library.
- **Runbook** - typed data: a procedure whose steps are an algebra (0002-runbooks-algebra).

## Standards considered

None beyond the ones this library's other specifications name: this specification is about the layout of the library. The layers are Kanon (commons 0033-kanon), read in this repository.

## Success criteria

- **SC-001**: Every requirement of 0001-runbooks-layers is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
