# Feature Specification: sql assertions

**Spec ID:** 0049-sql-assertions
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** pgTAP and TAP assertions of SQL Aide, as an extension.

## Requirements

- **FR-001**: Structural assertions MUST be made from the state a schema has, for every dialect, and run by a driver.
- **FR-002**: A difference between a database and the state MUST be a failing line that names what is wrong.
- **FR-003**: Assertions MUST be written as pgTAP scripts and run by the pgTAP extension.
- **FR-004**: TAP version 14 MUST be values, text and readable back.
- **FR-005**: `rows` and `fails` assertions of one's own MUST run in every dialect.

## Out of scope

- A pgTAP server beyond PGlite's.

## Edge cases

- A dialect without the feature, an empty list, or a name that needs quoting: each is an error value or is quoted, never a silent omission, per FR-001.

## Assumptions

- Ported from SQL Aide, which this library replaces; the engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL), in process.

## Open questions

- None.

## Key entities

- **Assertion** - one thing held to be true of a database, run as pgTAP, as a TAP query or by a driver.

## Success criteria

- **SC-001**: Each requirement above is proved by a test that runs on real engines, and `bun run verify` is green.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
