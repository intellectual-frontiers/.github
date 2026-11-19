# Feature Specification: Ephemeral targets

**Spec ID:** 0025-sql-target
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Some databases are not the system of record: a catalog an agent reads, a reference database shipped with an application, a fixture a test starts from, an osquery table. For these the source (governance, and rows written as typed values) is the record and the database is a build product. The build writes one SQL file: a header that says where it came from, the structure that `bind` makes, then the rows as `INSERT` statements, tables in the order their foreign keys give, rows in the order of their primary key, a fixed number to a statement. The file is committed and diffs in Git, so a change to a row is a line in a pull request; the same source gives the same bytes on every runtime and every run (nothing in it comes from the clock or from chance); a check finds a committed file that is no longer what the source makes; and the database is made from the file, in one transaction, whenever it is wanted. Rows are checked when the file is made, not when it is loaded: a table or column that does not exist, a column a table requires left out, and a primary key that is there twice are errors as values.

## The build

- **FR-001**: `targetBuild` MUST make, from a logical schema, a dialect, a naming, a schema qualifier, the extensions' statement sources and rows (by table and column, by the words of their names), a build that holds the statements and the text of one SQL file, and MUST give errors as values for a table or a column that the schema does not have, a column a table requires (not optional and with no default) that a row leaves out, a primary key that is in the rows twice, and a cycle among tables of the foreign keys (a table that refers to itself is allowed).
- **FR-002**: The text MUST be a header (that it is generated and from which module, the dialect, the hash of the schema's state and the hash of the rows), the statements `bind` makes, then the rows: tables in the order of their foreign keys (a table after the tables it refers to, otherwise in the order of the schema), rows in the order of their primary key (numbers as numbers, text by its code units), `batch` rows to an `INSERT` (a hundred by default), every value written by the dialect.
- **FR-003**: The text MUST be the same bytes for the same source every time: the same text where rows are given in another order, and no value in it that comes from the clock, the machine or chance.

## Making and keeping

- **FR-004**: `materialize` MUST make a database from a build, in one transaction that is rolled back where a statement fails, and give the error as a value.
- **FR-005**: `staleness` MUST compare a committed file with what the source makes now and say whether it is current, and where it is not, the first line that differs, so that a file that was edited by hand or a source that changed without the file being made again fails a check.
- **FR-006**: `sizeFindings` MUST report each table of a build with more rows than a limit, so that an ephemeral target does not grow into a system of record unnoticed.

## Out of scope

- Reading the committed file from disk: the caller reads it and writes it.
- Binary files of a database (`.sqlite`, `.duckdb`): a database is made from the text.
- Changing a durable database: that is the lifecycle.

## Edge cases

- A table with no rows: structure only, per FR-002.
- A table that refers to itself: its rows in the order of their primary key; a row must not refer to a later one, per FR-001.
- A row that gives a column twice by two spellings of its name: the later wins is not allowed; it is an error value, per FR-001.

## Assumptions

- The database that is made is empty.

## Open questions

- **OQ-1**: Whether rows of a self-referencing table are ordered so that a referenced row comes first.

## Key entities

- **Build** - the statements and the text of one SQL file.
- **Staleness** - whether a committed file is what the source makes.

## Success criteria

- **SC-001**: A database is a build product that can be thrown away and made again, and a pull request shows what changed in it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
