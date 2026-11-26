# Feature Specification: AnyFS SQL: the schema

**Spec ID:** 0004-sql-schema
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The tables are made by code where the database has none, inside one transaction with the facts of the copy written in it.

## Requirements

- **FR-001**: `makeLayout` MUST bring an empty database to the layout of a store that merges in one transaction with the facts of the copy written in it (the layout, the trust mode `allowlist` and whether search is on), and a second run MUST change nothing.
- **FR-002**: The version rows and the blobs MUST have no row id and a key whose conflict rule ignores a second row (`PRIMARY KEY (id, sum) ON CONFLICT IGNORE` and the digest as the key of the blobs, both `WITHOUT ROWID`), MUST have no unique column, auto-increment or foreign key, and the heads, the names, the siblings and the vector MUST be views; a trigger MUST refuse a row of a replica the database does not trust.
- **FR-004**: The index of search MUST be made where the engine has one and `search` is not off (an FTS5 table for SQLite), MUST be said to exist or not (a `tsvector` with a GIN index for PostgreSQL; DuckDB has none, and where `search` is `require` that is an error with a sentence).

## Acceptance scenarios

1. **Given** an empty database, **When** the layout is made, **Then** it has the facts of the layout, per FR-001.
2. **Given** a dump of the version rows, **When** a row is replayed twice, **Then** the second is ignored by the key, per FR-002.
3. **Given** DuckDB and `search` required, **When** the layout is made, **Then** it fails with a sentence, per FR-004.

## Out of scope

- Dropping or renaming a column.
- The layouts of PostgreSQL and DuckDB.

## Edge cases

- Making the layout is idempotent where it is run twice (FR-001).

## Assumptions

- The stores are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003); a value is only ever a parameter.
- The layout of the rows is the one the merge of replicas works on (0007-sql-merge); a different layout is a replacement of the layout module (0005-sql-store FR-008) and of the making of the layout.

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
