# Feature Specification: sql plpgsql

**Spec ID:** 0050-sql-plpgsql
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The typed PL-body DSL, in the routines extension.

## Requirements

- **FR-001**: A block of typed statements MUST be the body of a routine made with the names the case style writes.
- **FR-002**: It MUST run on PostgreSQL: loops, conditions, handlers, errors with a state, rows returned.
- **FR-003**: What is wrong with a block MUST be an error value before anything is made.

## Out of scope

- Other procedural languages.

## Edge cases

- A dialect without the feature, an empty list, or a name that needs quoting: each is an error value or is quoted, never a silent omission, per FR-001.

## Assumptions

- The engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL), in process.

## Open questions

- None.

## Key entities

- **Block** - a typed body of statements for a routine, checked before anything is made.

## Success criteria

- **SC-001**: Each requirement above is proved by a test that runs on real engines, and `bun run verify` is green.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
