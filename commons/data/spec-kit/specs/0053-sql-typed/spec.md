# Feature Specification: sql-typed

**Spec ID:** 0053-sql-typed
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** A typed table, column and row algebra and a query builder are a unit of their own, `sql/typed`, and each model gets its own generated file of typed tables (`sql/typed/models/<model>.auto.ts`), made from governance and the logical schema, so that a program that reads and writes the tables of a model is checked against the model by the compiler.

## Requirements

- **FR-001**: A value of SQL MUST be an `Expr<T>` that gives the TypeScript type of what it computes, nullable where it may be null; comparison, arithmetic, logic, text, `in`, `between`, `like`, `case` and the aggregates MUST take expressions of one type, so that a number compared with a text, a name summed, a text added to or `null` compared with `=` does not compile.
- **FR-002**: An expression MUST be data (a tree) that a dialect writes, and an operand MUST be an expression or a plain value of the type.
- **FR-003**: A table MUST be a value with the type of its rows, the type of what an insert takes and the name by which it is known in a query, with a typed column for each key of the row; the keys are the names a program writes and the names in SQL are those the table says; a table MUST be able to be known by another name (a self-join) and be put in another schema; a key that the row does not have MUST NOT compile.
- **FR-004**: A query MUST be built from a table and joins (inner, left, right, full, cross) into a scope of typed columns by the names of the tables; a left, right or full join MUST make the columns of the other side nullable; a name used twice in a query MUST be refused; `select` MUST give the type of the row from the expressions it names.
- **FR-005**: A query MUST have where, group by, having, order by (by a column or by a key of the row), limit, offset and distinct, union, union all, intersect and except of selects of one row type, `in`, `not in`, `exists` and value subqueries, derived tables and common table expressions, and MUST run on SQLite, DuckDB and PostgreSQL through a driver, giving rows of the type named, with the counts and sums that a driver gives as text read as numbers.
- **FR-006**: Every value MUST be written by the dialect as a literal, so that a quote in a text cannot become SQL; a date MUST be written as text; a number that is not finite and bytes MUST be an error value that says so; an empty `in` MUST be false and an empty `and` true.
- **FR-007**: `insertInto` MUST take the rows of the table's insert type (what the database fills may be left out; an unknown key or a value of another type MUST NOT compile) and refuse rows of other columns than the first; it MUST have `onConflictDoNothing` and `onConflictDoUpdate` (with the proposed value `excluded`); `update` MUST take values or expressions of the table's columns; an update and a delete MUST NOT be runnable until they say `where` or `all`; `returning` MUST give the rows changed, typed as a select's.
- **FR-008**: Each model (module of governance) that owns a table MUST get its own file `<model>.auto.ts`, made from the logical schema and governance by `tools/typed.ts` and never by hand: for each table a row type, an insert type, a key type and a typed table, with a closed list of codes as a union of its names and what the database fills (a default, a null) optional in the insert; `mod.ts` MUST name the files; and a file that is missing, stale or stray MUST fail `bun run verify`.
- **FR-009**: Every table of every model MUST be owned by exactly one model, and the typed columns of a table MUST be the columns that a database made from the models has: each table is read through its typed columns on each engine.

## Out of scope

- Typed access to views, routines and the tables of a project's own models; a project makes them with `typedFiles` from its own modules.
- Bytes as literals, and prepared statements with parameters: the driver of this library takes text, and every value is a literal.
- Decoding of every driver's types (decimals, dates, wide integers) into one: values are as a driver gives them, except the counts, sums and averages (FR-005).
- A `DEFAULT VALUES` insert, which dialects do not share.

## Edge cases

- Rows of one insert with other columns than the first are refused, per FR-007: insert them apart.
- A column that a model gives a default is optional in the insert and still present in the row, per FR-008.
- A table that is in no model's concept or code list is an error of the generation, per FR-009.
- A key of a table that a language reserves (`default`, `class`) is written with an underscore after it, per FR-008.

## Assumptions

- The typed algebra is built on the logical schema and governance, with the engines of the tests SQLite, DuckDB and PGlite (PostgreSQL).
- The generated files are committed and are in the package; a project that composes other models generates its own.

## Open questions

- **OQ-1**: Whether `arcactl generate` should also write a project's typed tables; now `tools/typed.ts` does it for this library's models.

## Key entities

- **Expr** - a typed value of SQL, as a tree.
- **Table** - a typed table: the row, the insert and the name in a query, with a typed column for each key.
- **Select** - a query that says what it wants, with the type of its row.

## Success criteria

- **SC-001**: A program that reads and writes the tables of a model does so with the types the model gives; a change of the model that the program does not follow fails to compile.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
