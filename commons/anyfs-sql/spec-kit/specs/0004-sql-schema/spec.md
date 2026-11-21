# Feature Specification: AnyFS SQL: the schema

**Spec ID:** 0004-sql-schema
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The tables are made and changed by code, in order, each version inside one transaction with the version it reaches written in it.

## Requirements

- **FR-001**: `migrate` MUST bring a database to the latest version of the layout, each version in its own transaction with the version written in the same transaction, and a second run MUST change nothing; a database at version 1 MUST be brought to version 2 with its objects and their history kept.
- **FR-002**: A database at a newer version than the library knows MUST be refused and left unchanged, a migration that takes something away MUST run only where the caller says so, and a store opened to check the layout MUST refuse a database that is not at the version the library writes.
- **FR-003**: The index of search MUST be made where the engine has one (an FTS5 table for SQLite, a `tsvector` with a GIN index for PostgreSQL), MUST be said to exist or not, MUST be made with `search: require` or refused with the reason, and MUST NOT be made for DuckDB, which has no index that keeps itself current.

## Acceptance scenarios

1. **Given** an empty database, **When** it is migrated, **Then** it is at version 2 with the facts of the layout, per FR-001.
2. **Given** a database at version 99, **When** a store is opened, **Then** it is refused and nothing changes, per FR-002.
3. **Given** DuckDB and `search: require`, **When** a store is opened, **Then** it is refused with a sentence, per FR-003.

## Out of scope

- Dropping or renaming a column.

## Edge cases

- A migration is idempotent where it is run twice (FR-001).

## Assumptions

- The stores are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003); a value is only ever a parameter.
- The layout of the rows is not frozen: the library is held, and a different layout is a replacement of the layout module (the store specification, 0005-sql-store, has the requirement) and the migrations.

## Open questions

- None.

## Key entities

- **Port**, **Dialect**, **Layout**, **Revision**.

## Success criteria

- **SC-001**: Every behaviour is tested on the real engines in memory or in temporary folders, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
