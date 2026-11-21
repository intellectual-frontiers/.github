# Feature Specification: Catalog Soc2 layers

**Spec ID:** 0001-catalog-soc2-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** SOC 2 Trust Services Criteria as a grc catalog package, in our own words: the criteria of security, availability, processing integrity, confidentiality and privacy, with where they came from and why the AICPA text is not carried. It is built to Kanon (commons 0033-kanon): Governance says what it is, Logical is the model it reasons with, and Physical is what touches the world.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/`, `src/logical/` and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check and the tests, and MUST fail on any finding that is not held by a baseline that only shrinks.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the package of the library, **When** its `verify` script is read, **Then** it runs every check, per FR-002.

## Out of scope

- Everything the library will do: its next specifications.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A `verify` that leaves out a check: it is a finding of the test, per FR-002.

## Assumptions

- The shared checker of Kanon and the manifest check of the libraries are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **Catalog Soc2** - the library.

## Success criteria

- **SC-001**: The layers check of Kanon finds nothing in the real tree.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
