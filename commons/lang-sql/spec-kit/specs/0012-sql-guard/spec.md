# Feature Specification: The guard of a query that only reads

**Spec ID:** 0012-sql-guard
**Status:** Active
**Owner:** if
**Domain:** lang-sql

**Input:** Programs that take SQL from a person, a file or a request and run it on a connection (a compliance check, a probe that answers one question on a machine, a catalog of named queries) must refuse what writes before it reaches the connection. A pattern over the text cannot tell a word in a string from a statement, so this feature reads the query with the parser and judges the tree. It is one module of aide, with a profile of the language that only reads, and it can bind the query to a catalog of the tables a connection has.

## The guard

- **FR-001**: `guard(text, dialect, options?)` MUST give an `ok` value of the parse where the text is exactly one statement that only reads, and an `err` value of every violation (a span of the text and one sentence) where it is not; a statement only reads where it is a query (`SELECT`, a set operation, `VALUES`, or `WITH` whose body and common table expressions are queries), holds no data change, no definition, no `SELECT ... INTO`, no locking clause (`FOR UPDATE`, `FOR SHARE`), and calls no function of the denied list; a word of a write inside a string, an identifier or a comment MUST NOT be a violation, and a text that does not read in the dialect MUST be a violation with the parser's sentence.
- **FR-002**: More than one statement, no statement and a statement that could not be read MUST each be a violation; a trailing `;` MUST NOT be one.
- **FR-003**: The denied functions MUST be, by default, those that sleep, read or write files, take locks, change a sequence or a setting, load code or reach another host (`pg_sleep`, `pg_read_file`, `pg_read_binary_file`, `pg_ls_dir`, `pg_stat_file`, `lo_import`, `lo_export`, `lo_unlink`, `dblink`, `dblink_exec`, `pg_advisory_lock`, `pg_terminate_backend`, `pg_cancel_backend`, `set_config`, `nextval`, `setval`, `load_extension`, `readfile`, `writefile`, `load_file`, `sleep`, `benchmark`, `xp_cmdshell`, `sys_exec`), compared without regard to case and to a schema before the name, and `options.deniedFunctions` MUST replace the list.
- **FR-004**: `options.allowPragma` MUST allow a `PRAGMA` that reads (no `=` and no parenthesis after its name) and nothing else of the kind `command`; where it is not given, a `PRAGMA` MUST be a violation.
- **FR-005**: Where `options.catalog` is given and the statement is a plain `SELECT`, the guard MUST bind it to the catalog and give every unknown table and unknown column as a violation with the sentence and the suggestion of `bind`; `options.tables` MUST restrict the tables that may be read, whatever the catalog; and `options.maxNodes` MUST limit the size of the statement.
- **FR-006**: `refusal(text, dialect, options?)` MUST give the sentence of the first violation, with its place (`line L, column C`), or `undefined` where the text is allowed; and none of these functions MUST throw for any text.

## Catalogs from tables

- **FR-007**: `catalogFromTables(tables, types?)` MUST make a catalog of the tables from a list of tables with the columns' names and the types of their own system (`{ name, columns: [{ name, type }] }`) and a map from those types to the types of a catalog (a type not in the map is `unknown`, and a map need not be given for the types of a catalog), so that a library whose schema is data makes its catalog in one call.
- **FR-008**: The guard MUST allow a query that uses set operations, window functions, any join, `NULLS FIRST` and `LAST`, `FETCH FIRST` and a recursive common table expression where nothing in it writes, and MUST still refuse the same query where a data change stands in it (a `WITH` that holds an `INSERT`, `UPDATE` or `DELETE`, a `SELECT ... INTO` in a side of a set operation).

## Out of scope

- A cost limit or a timeout of a running query (the connection's), and the rewriting of a query that is refused.

## Edge cases

- `SELECT 'DELETE FROM t'`, `SELECT "insert"`, `SELECT 1 -- ; DROP TABLE t`: allowed, per FR-001.
- `WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x`: a violation, per FR-001.
- `SELECT pg_catalog.pg_sleep(1)`: a violation, per FR-003.

## Assumptions

- The dialect given is the one the connection speaks; a query that is valid for the connection and not for the dialect is refused, which is the safe error.

## Open questions

- None.

## Key entities

- **Guard** - the judgment of a query by its tree.
- **Denied function** - a function whose call changes or leaves the database.

## Success criteria

- **SC-001**: No query that writes reaches a connection that is behind the guard, and no query that reads is refused for a word in a string.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
