# Feature Specification: Queries

**Spec ID:** 0024-sql-queries
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** An application's reads are a catalog of named queries over a model's tables. A query is SQL that a person writes, but the names in it are a schema's: it asks for tables and columns by the words of their names (0007-physical FR-014) and its values come in only as typed parameters, so that a name that does not exist is found when the catalog is made, and a value can never become SQL. A query is read-only by construction: one `SELECT` (or `WITH ... SELECT`), no statement stacking, nothing that writes, and it is run in a transaction that is rolled back. A catalog can be verified against a real database (each query is prepared with sample values and the engine's own errors are findings), and compared with another version of the schema, so that the queries a change would break are known before it is applied: the check that a migration needs and a type system gives for free to code that is typed, given to SQL that is not.

## The catalog

- **FR-001**: `queries` MUST make a catalog from a logical schema, a dialect, a naming and query specs (a name, parameters each with a type and whether it may be null, and a function from references and parameters to SQL) and MUST give errors as values for a table or column the schema does not have, two queries with one name, and a query that is not read-only (FR-003).
- **FR-002**: A parameter MUST be `text`, `integer`, `number` or `boolean`, and a value MUST enter a query only as a literal that the dialect writes for it; `render` MUST refuse, as errors as values, a value of another type, a missing value, a null for a parameter that may not be null, and a value for a parameter that was not declared.
- **FR-003**: A query MUST be a single `SELECT` or `WITH` statement; with the text of string literals, quoted names, dollar-quoted strings and comments left out (the query read once from its start, so that a comment marker in a string and a quote in a comment are read as what they are), a query that holds `;` or any of `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`, `ATTACH`, `COPY`, `PRAGMA`, `INTO`, `MERGE`, `CALL`, `INSTALL`, `EXPORT`, `VACUUM` or `REINDEX` as a word MUST be refused as an error value.

## Running

- **FR-004**: `run` MUST render a query and run it in a transaction that is rolled back, and give the rows (a bigint as a number), or the errors of rendering, or the database's error, as a value.
- **FR-005**: `verify` MUST prepare every query of a catalog against a database with sample values (the ones given, else one for each type) as `SELECT * FROM (query) LIMIT 0`, in a transaction that is rolled back, and give, for each query the engine refuses, a finding with the query and the engine's message.

## Change

- **FR-006**: `impact` MUST make the catalog for two versions of a schema and say, for each query, whether it is fine in both, fine in the first and broken in the second (with the errors), broken in both, or fine only in the second, so that the queries a change breaks are known before it is applied.

## Out of scope

- Writes: integrations and transforms write.
- The types of result rows: the driver gives values.
- A query builder: the SQL is written by a person.

## Edge cases

- A query with a word such as `delete` in a string literal: allowed, per FR-003.
- A parameter used twice: the same literal twice, per FR-002.
- A null for a nullable parameter: written as `NULL`, per FR-002.

## Assumptions

- The dialect writes literals safely (`dialect.literal`).

## Open questions

- **OQ-1**: Whether the names of the result columns can be had where a query returns no rows.

## Key entities

- **Query** - a name, parameters and SQL over the names of a schema.
- **Catalog** - the queries of an application.
- **Impact** - what a change to a schema does to each query.

## Success criteria

- **SC-001**: A query that a change would break is found before the change is made, and no value is ever SQL.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
