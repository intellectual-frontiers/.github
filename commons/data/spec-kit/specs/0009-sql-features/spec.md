# Feature Specification: SQL features as extensions

**Spec ID:** 0009-sql-features
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** What an engine can do beyond tables, keys and comments is a feature, and a feature is an extension of the physical schema (0007-physical), never part of its core. Five are built here. Views, which are derived and so not governance (0004-arca Out of scope), are made from a typed definition of tables and columns by their governance names. Access turns what governance says of who may see what (`security.scope`, `security.access`) into row-level security and grants where the engine has them. Routines are functions and procedures written with typed references to tables and columns. Partitions divide a table's rows among parts by a key. Vectors are a business datatype whose storage each dialect says. Each is switched on by composing its extension, each is checked against the dialect's features, and what an engine cannot do is an error value or, for access, is carried as data by the governance tables (0008-sql-documentation) as the setting says.

## The core's part

- **FR-001**: The groups of a statement MUST be, in the order they are run, `setup`, `table`, `constraint`, `index`, `data`, `view`, `routine`, `documentation` and `policy`, so that what a feature adds is run after what it needs and before what describes it.
- **FR-002**: A dialect's features MUST name what it can do beyond the common ground (`comment-on`, `regex-check`, `add-constraint`, `or-replace-view`, `row-security`, `grants`, `routines`, `partitions`), and a feature extension MUST ask the dialect for its feature instead of knowing the engine.
- **FR-003**: A dialect MAY refuse a logical type with a reason, which `bind` MUST return as an error value naming the column, and MAY ask for statements to run before the tables (`setup`) for the types the schema uses.
- **FR-004**: An extension MUST be able to add a clause to the end of a table's `CREATE TABLE` through the engine's point `physical.tableClauses`, being given the table and the written names, and its errors MUST be returned with `bind`'s.

## Views

- **FR-005**: The views extension MUST make a view of each definition it is given: a name, a description, the table it is drawn from, the joins to other tables (equality of columns), the columns it shows (each with the name it is shown by) and the conditions rows must meet (a column is null, is not null, or is equal to a literal); tables and columns MUST be named as governance names them (`partyId`) and written by the case style.
- **FR-006**: A view MUST be made by `CREATE OR REPLACE VIEW` where the dialect has `or-replace-view`, and by dropping it and creating it where it has not; its description MUST be its `COMMENT ON VIEW` where the dialect has `comment-on`.
- **FR-007**: A view that names a table or column the schema does not have, shows no column, or has the written name of a table MUST be returned as an error value naming it; a statement of a view MUST carry the logical elements it reads.

## Access

- **FR-008**: Where a column of a table carries `security.scope`, the access extension MUST, for a dialect with `row-security`, make the table's row-level security on and a policy that lets a row be seen only where the column equals the setting of the scope (`<prefix>.<scope name>`, the prefix `app` by default); policies MUST be made again by dropping them first, so that applying them twice leaves the same policies.
- **FR-009**: Where a table's concept carries `security.access`, the access extension MUST, for a dialect with `grants`, grant its read roles `SELECT` and its write roles `INSERT`, `UPDATE` and `DELETE` on the table, and where the table is scoped MUST give each of those roles a policy of its own for the operations it may do.
- **FR-010**: Where the dialect lacks the feature, the access extension MUST write nothing and leave the annotation to the governance tables, which carry it as data, unless its setting is `error`, in which case it MUST return an error value naming the table and the annotation.

## Routines

- **FR-011**: The routines extension MUST make a function or procedure of each definition it is given (a name, its parameters with their logical types, what a function returns, the language, the volatility, a description and a body) by `CREATE OR REPLACE`, for a dialect with `routines`; a dialect without it MUST be an error value naming the routine.
- **FR-012**: A body MUST be a list of text and typed references (to a table, to a column of a table, to a parameter), so that the written name of what it refers to is the one the case style wrote; a reference to a table or column the schema does not have MUST be returned as an error value naming it.
- **FR-013**: A routine's description MUST be its `COMMENT ON FUNCTION` or `COMMENT ON PROCEDURE`, with its parameter types, where the dialect has `comment-on`.

## Partitions

- **FR-014**: The partitions extension MUST, for a table it is given a division of (a strategy of `range`, `list` or `hash`, the key columns and the partitions with their bounds), add `PARTITION BY` to the table through FR-004 and make each partition as a table of its own that holds the rows of its bounds, for a dialect with `partitions`.
- **FR-015**: A division whose key is not a column of the table, or is not in the table's primary key (an engine needs the key to be unique within a partition), or whose dialect lacks `partitions`, MUST be returned as an error value naming the table.

## Vectors

- **FR-016**: Governance MUST have a datatype `vector` of a number of dimensions, the logical schema a type `vector` of the same, and each dialect MUST say how it is stored or refuse it (FR-003): PostgreSQL as `VECTOR(n)` of pgvector with `CREATE EXTENSION IF NOT EXISTS vector` run first, DuckDB as `FLOAT[n]`, SQLite not at all.
- **FR-017**: The dimensions of a vector MUST be a whole number of at least one, and `domain()` MUST return an error value for any other.

## What the database holds

- **FR-018**: On a real engine, each feature MUST do what it says: a view returns the rows its conditions give; a scoped table shows a role only the rows of its scope and refuses it a row of another; a routine runs and returns what its body says; a partitioned table keeps each row in the partition of its bounds and refuses one that has none; a vector is stored and read back.
- **FR-019**: Where a scope is sealed (PostgreSQL), a policy MUST trust the setting of a scope only where it carries the mark that only a holder of the key can make, so that a session that sets the scope itself, forges its mark or reuses the mark of another value sees nothing; the key MUST be kept where no role but its owner can read it and a mark MUST NOT be possible to make without it; row security MUST be forced on the owner of the table; and a guard MUST refuse to disable it, to drop a policy or to drop a table of it, for a session that does not hold the unlock secret, whose hash alone the database holds.

## Out of scope

- The old SQL Aide's generated identity keys, tables with no key and constraint names truncated with a hash: not built. Governance gives every concept an identity (0003-governance), so a key is never made up or left out; a name that is too long is an error value (0007-physical FR-003), not a hash that hides it.
- Routines written as a query algebra: a body is text and typed references; a query extension may come later.
- An index over vectors (`hnsw`, `ivfflat`) and masks (`security.mask`): later extensions; a mask is carried as data until then.
- Materialized views, triggers, sequences and domains.
- Roles themselves: the extension names roles and never creates them.

## Edge cases

- A view over a table with a column renamed in governance: the definition's name no longer exists, an error value, per FR-007.
- A scoped table on SQLite by default: no statement, and the scope in `governance_annotation`, per FR-010.
- A scoped table on SQLite with the setting `error`: an error value, per FR-010.
- A concept with `security.access` and no scope: grants and no policy, per FR-009.
- A routine on DuckDB: an error value, per FR-011.
- A partition key that is not in the primary key: an error value, per FR-015.
- A vector of 0 dimensions: an error value from `domain()`, per FR-017.
- A vector on SQLite: an error value naming the column, per FR-003.
- Two features applied twice: the same database, per FR-006, FR-008 and FR-011.

## Assumptions

- The policy reads the setting with `current_setting` and compares the column as text, which is PostgreSQL's way; no other dialect has `row-security` yet.
- A role is named by the annotation as governance gives it and is written as it is; the case style is for names the library makes.
- A routine's body is the author's SQL; the library checks the references it is given, not the SQL between them.
- PGlite, the in-process PostgreSQL of the tests, has no pgvector, so a vector is run on DuckDB and its PostgreSQL statements are checked as text (FR-018).
- The settings a policy reads (`app.tenant`) are set by the application for each session.

## Open questions

- **OQ-1**: Whether a mask (`security.mask`) becomes a view or a column policy where the engine has one, and whether an index over vectors (`hnsw`, `ivfflat`) is a feature of its own or of the dialect.

## Key entities

- **Feature** - what an engine can do beyond the common ground, named by its dialect and used by an extension of the physical schema.
- **View definition** - a typed description of a view over tables.
- **Access** - the row-level security and grants that `security.scope` and `security.access` become.
- **Routine** - a function or procedure with typed parameters and a body of text and references.
- **Partition** - a part of a table's rows, by a key.

## Success criteria

- **SC-001**: A project composes the features it wants and gets SQL for each dialect that can do them and an error value naming what a dialect cannot, never SQL an engine refuses.
- **SC-002**: Nothing governance says of who may see what is dropped on its way down: it is a policy, a grant or a row of a governance table.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
