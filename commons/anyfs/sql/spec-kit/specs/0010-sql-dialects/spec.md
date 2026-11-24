# Feature Specification: SQL dialects: PostgreSQL and DuckDB layouts

**Spec ID:** 0010-sql-dialects
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The merge layout of the SQL store is written for SQLite, PostgreSQL and DuckDB, each in the way its engine holds the same laws, and replicas of the three exchange rows and dumps with one another. What an engine cannot enforce itself is held by the library's import and said.

## Requirements

- **FR-001**: On each of SQLite, PostgreSQL (PGlite and a real server) and DuckDB the store MUST pass every case of the suite its capabilities name and the merge suite of AnyFS.
- **FR-002**: Search MUST be offered where the engine has full-text search (SQLite FTS5, PostgreSQL tsvector with an inverted index), the caller MUST NOT be able to write an operator of the engine's query language, and an engine with no search (DuckDB) MUST say so and offer none.
- **FR-003**: Replicas of SQLite, PostgreSQL and DuckDB that edit the same paths MUST exchange rows through a medium and merge pairwise, and all MUST end with the same files and the same siblings.
- **FR-004**: The dumps the library writes for PostgreSQL (`INSERT ... ON CONFLICT DO NOTHING`) and for DuckDB (`INSERT OR IGNORE`), replayed in any order, twice and overlapping, MUST give the union of the rows, the same files as the merge by deltas.
- **FR-005**: A dump MUST be written again for another engine from its text (`redump`), and the dump of the real `sqlite3` written for PostgreSQL or DuckDB and the dump the library writes for each MUST give the same files in the other engine.
- **FR-006**: A DuckDB database has no trigger: the import of the library MUST hold what a trigger holds elsewhere, so that a replica the database does not trust refuses the whole replay and a row an epoch collected is not written; what a raw import into DuckDB cannot be made to hold MUST be said.
- **FR-007**: On a real PostgreSQL server (made for the run, or named by `ANYFS_SQL_TEST_PG`) the store MUST pass the suites too, writers on pooled connections MUST be serialised so that a check and its write are one step, and where no server can be made the test MUST be skipped with a sentence that says what is missing.
- **FR-008**: The dumps of the real `pg_dump` (`--data-only --inserts --on-conflict-do-nothing`) of several real databases, replayed by the real `psql` and by the library in any order, twice and overlapping, MUST be the union of the rows, and a dump of the real `sqlite3` written for PostgreSQL and replayed by `psql` MUST give the same files.

## Acceptance scenarios

1. **Given** three real PostgreSQL databases that each took different rows, **When** their `pg_dump` outputs are replayed by `psql` into a fourth in any order, **Then** it holds the union, per FR-008.
2. **Given** replicas on SQLite, PostgreSQL and DuckDB with edits to one path, **When** they merge pairwise, **Then** all show the same winner and the same siblings, per FR-003.

## Out of scope

- Search on DuckDB, and the enforcement by the database itself of what a trigger holds on DuckDB.

## Edge cases

- A schema the connection does not start in: the functions of PostgreSQL name their schema, so that a dump replayed with an empty search path still finds its tables (FR-008).

## Assumptions

- PostgreSQL 16 client and server programs are on the computer where the real tests run; PGlite and DuckDB are libraries.

## Open questions

- None.

## Key entities

- **Dialect** - the way an engine states the layout: tables, views, triggers or their absence, bytes, search.
- **Redump** - a dump read and written again for another engine.

## Success criteria

- **SC-001**: A fleet that keeps a database in each of three engines can be brought to the same files by dumps alone, and a real `pg_dump` is a valid input.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
