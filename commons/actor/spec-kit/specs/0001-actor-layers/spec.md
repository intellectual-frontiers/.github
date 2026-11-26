# Feature Specification: Actor layers

**Spec ID:** 0001-actor-layers
**Status:** Active
**Owner:** if
**Domain:** commons


**Input:** Who did what in a regulated act (commons 0048-actors). It is built to Kanon (commons 0033-kanon): Governance says what it is, Logical is the model it reasons with, Physical reads Git history.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/`, `src/logical/` and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no file outside a unit and no import outside the row of its unit.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check and the tests.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the package of the library, **When** its `verify` script is read, **Then** it runs every check, per FR-002.

## Out of scope

- Qualification and tasking certificates, the directive-first refusal of regulated verbs, the review canary and the dossier lens of commons 0048-actors: they come after the first acceptance run and are stated there.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A `verify` that leaves out a check: it is a finding of the test, per FR-002.

## Assumptions

- The first version is the simplest slice that is valuable: it records, finds and lints; it refuses nothing at a verb (commons 0048-actors FR-022 is a finding first).

## Open questions

- None.

## Key entities

- **Actor** - a person, a system or an agent. **Act** - what the six roles are held in.

## Success criteria

- **SC-001**: The tests of this specification pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
