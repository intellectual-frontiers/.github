# Feature Specification: sql-introspect

**Spec ID:** 0055-sql-introspect
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** A database that exists is read from its own catalog as a plain value, compared with what a model says, and adopted as a logical schema.

## Requirements

- **FR-001**: `introspect` MUST read, through a driver and changing nothing, the tables of a database with their columns (the type the engine reports, nullability, default), primary key, unique constraints, foreign keys (over more than one column too) and indexes, on SQLite, DuckDB and PostgreSQL, and MUST leave out the tables it is told to.
- **FR-002**: `expectedOf` MUST write what a logical schema says a database holds, as `introspect` reads it, and a database made from the schema MUST show no drift from it on each engine.
- **FR-003**: `drift` MUST name every difference: a table or column that is missing or stray, a type of another family, a nullability, a primary key, and a foreign key, unique or index that is missing; a database of another version of the model and one changed by hand MUST be told apart.
- **FR-004**: `adopt` MUST make a logical schema of what was read (names as words, logical types, keys, foreign keys, uniques, indexes, defaults), MUST report each column whose type is of no known family by its name, and the schema MUST make the same database again on its own engine and on each of the others.

## Out of scope

- Views, routines, grants, triggers and check constraints: what is read is the structure of the tables.

## Edge cases

- A column of an engine type of no known family is an error of `adopt`, per FR-004.
- Names are adopted as words, so a camel-case name is written in the case style of the naming, per FR-004.

## Assumptions

- The engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL).

## Open questions

- None.

## Key entities

- **Observed** - what a database holds: tables, columns, keys, constraints and indexes.

## Success criteria

- **SC-001**: Each requirement is proved by a test on real engines and `bun run verify` is green.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
