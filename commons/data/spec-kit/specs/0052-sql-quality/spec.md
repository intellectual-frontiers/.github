# Feature Specification: sql quality (SQL-DQ)

**Spec ID:** 0052-sql-quality
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** SQL-DQ: the data tests of dbt as an algebra of typed values, in a unit of its own, sql/quality.

## Requirements

- **FR-001**: A generic test MUST be a value with the level it is written at (a column or a model) and the type of its arguments; a test of one level MUST NOT compile on the other, and a test whose arguments are missing MUST NOT compile.
- **FR-002**: A test MUST take the name dbt gives it (the test, the relation, the column, the arguments), a long name MUST be made short, and a selection MUST pick by tag, relation, test and kind and leave out what it excludes.
- **FR-003**: A use MUST be configured by severity, `warnIf`, `errorIf`, `where`, `limit`, `failCalc`, stored failures, schema, alias, tags, meta, enabled and name.
- **FR-004**: The status of a count MUST be judged as dbt does: with severity error a count that meets `errorIf` fails and below it one that meets `warnIf` warns; with severity warn either threshold warns.
- **FR-005**: The built-in tests (`not_null`, `unique`, `accepted_values`, `relationships`) and the package tests (`expression_is_true`, `unique_combination_of_columns`, `not_empty_string`, `accepted_range`, `at_least_one`, `not_constant`, `equal_rowcount`, `equality`) MUST give the rows that are wrong, and singular tests MUST be SQL of one's own.
- **FR-006**: Tests MUST run through a driver on SQLite, DuckDB and PostgreSQL and count the rows that are wrong, and a test that cannot run MUST be an `error`.
- **FR-007**: `where`, `limit` and `failCalc` MUST apply, failures MUST be stored as a table or a view that a later run replaces, and a disabled test MUST be skipped.
- **FR-008**: Results MUST be counted (a warning is not a failure) and told as TAP.
- **FR-009**: The tests a schema's state asks for (not null, keys, codes) MUST be made from it and pass on a database that holds the schema.
- **FR-010**: A test MUST be able to expect an exact number of failing rows (`exactly(n)`): it MUST fail where the count is any other, fewer or more, and MUST never be a warning; `exactly(0)` is the ordinary test.
- **FR-011**: `preview` MUST run a set of proposed tests on the data that is already in a database and report, for each, its status, how many rows would be wrong and up to a given number of them, MUST report a test that cannot run as an error, and MUST change nothing.

## Out of scope

- dbt's unit tests of models and its freshness checks of sources (a later part); the load of data (ETL and ELT) is the integration part that follows. A test is not a model build: tests of transforms stay as they are (0023).

## Edge cases

- A dialect without the feature, an empty list, or a name that needs quoting: each is an error value or is quoted, never a silent omission, per FR-001.

## Assumptions

- The engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL), in process.

## Open questions

- None.

## Key entities

- **Data test** - SQL that gives the rows that are wrong, with a level, typed arguments and a configuration; a run gives an outcome of pass, warn, fail, error or skipped.

## Success criteria

- **SC-001**: Each requirement above is proved by a test that runs on real engines, and `bun run verify` is green.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
