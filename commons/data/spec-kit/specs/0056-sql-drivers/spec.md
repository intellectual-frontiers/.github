# Feature Specification: sql-drivers

**Spec ID:** 0056-sql-drivers
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The Driver of the library made from the client a caller already has, typed by its shape, with no dependency on any client.

## Requirements

- **FR-001**: An adapter MUST make a `Driver` from `node:sqlite` or `bun:sqlite`, a `pg` client or pool, PGlite, DuckDB's `node-api` connection and Bun's `SQL`, each typed by the shape of the client and not by its package, so that the library depends on none.
- **FR-002**: The same script MUST give the same rows through every adapter on the real client, a wide integer MUST be a number, a row a plain object, and a refusal or a failing query a rejection; `driverFor` MUST pick the adapter from the shape of the client.
- **FR-003**: A client of no known shape MUST be refused with a message that says what is looked for.

## Out of scope

- Connection pools, transactions across calls and parameters: the driver takes text.

## Edge cases

- Rows that a client gives with a null prototype are made plain, per FR-002.

## Assumptions

- The engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL).

## Open questions

- None.

## Key entities

- **Adapter** - a function from a client of a known shape to a `Driver`.

## Success criteria

- **SC-001**: Each requirement is proved by a test on real engines and `bun run verify` is green.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
