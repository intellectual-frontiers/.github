# Feature Specification: The physical schema

**Spec ID:** 0007-physical
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** The physical schema is the third layer (0001-layers): a logical schema bound to one engine. A dialect says how an engine writes what a logical schema says (its types, its quoting, its literals, what it can express), a case style says how a list of words is written as a name, and `bind` makes the statements that create the schema and load its reference data, in an order the engine accepts, each traced to the logical element it was made from. PostgreSQL, SQLite and DuckDB are dialects, and each is an extension, so that a fourth is added without changing this layer. What a dialect cannot express is an error value that names the element, never SQL that fails when it is loaded; and what the statements make, loaded into a real engine, is what the logical schema said.

## Names

- **FR-001**: A case style MUST be a value that writes a list of words as a name; `snake`, `camel` and `pascal` MUST be the library's own, snake case MUST be the default, and an extension MUST be able to add one through the engine's point `physical.caseStyle`; the words of a valid name of governance written in `camel` MUST be that name.
- **FR-002**: The stored value of a code (the code of a code table, a value of a check, a default) MUST be written by the case style of the codes, by default the style of the names, and MAY be the code's name as it is (0005-naming FR-006).
- **FR-003**: A written name longer than its dialect allows MUST be an error value naming it, and two elements whose written names are equal (two tables, two columns of a table, two constraints or indexes) MUST be an error value naming both.

## The dialect

- **FR-004**: A dialect MUST be a value that says how its engine writes: how a name is quoted, how a literal is written, the type of each logical type, how the moment of the insert is written as a default, which checks it can express (a pattern only where it has a regular expression), whether it has `COMMENT ON`, and the longest name; PostgreSQL, SQLite and DuckDB MUST be provided, each as an extension in `sql/dialects/` that contributes its dialect through the engine's point `physical.dialect`.
- **FR-005**: A logical element that a dialect cannot express MUST be returned as an error value that names the element and why, and `bind` MUST NOT write SQL that its engine would refuse at load.

## Binding

- **FR-006**: `bind` MUST make from a logical schema, a dialect and a naming the statements that create the schema, or all its errors together; a table MUST follow every table its foreign keys refer to, the indexes MUST follow the tables, and the reference data MUST follow both; a cycle of foreign keys that the dialect cannot break MUST be an error value.
- **FR-007**: A table MUST be made by `CREATE TABLE IF NOT EXISTS` with each column's type, `NOT NULL` and default, its primary key (inline where it is one column), and named constraints for its foreign keys, uniques and checks; an index MUST be made by `CREATE INDEX IF NOT EXISTS`.
- **FR-008**: The rows of a code table MUST be loaded by an upsert that, run twice, leaves the same rows, with the codes written by FR-002.
- **FR-009**: Every statement MUST carry the identities of the logical elements it was made from, so that what is in a database is traced to its logical element and, through it, to governance.
- **FR-010**: `render` MUST give the same text for the same schema, dialect and naming every time, one statement ending in `;`, and `bind` MUST keep what an extension adds apart from the core's by group, in the order the groups say.
- **FR-011**: An extension MUST be able to add statements for a bound schema through the engine's point `physical.statements`, being given the written name of every table and column, and its errors MUST be returned with `bind`'s.

## What the database holds

- **FR-012**: For each dialect, the statements `bind` makes for a schema, loaded into a real engine, MUST make the tables, columns, nullability, primary keys, foreign keys, uniques, checks and indexes of the logical schema; the engine MUST refuse what the constraints forbid (a party related to itself, a second identifier of a kind, a code that is not in its list, a reference to a row that is not there), and a load of the reference data twice MUST leave the same rows.

## Extension

- **FR-013**: The physical schema's own code MUST name no engine: the name of an engine MUST appear only in its own dialect's folder, so that a fourth dialect is added without a change to this layer, and a dialect MUST NOT name another's engine.

## Out of scope

- The descriptions of tables and columns, as `COMMENT` or as documentation tables: an extension (0008).
- Views, routines, row-level security and other features: extensions.
- A migration of a database that exists: ISLM, an extension.
- Queries and drivers: extensions.

## Edge cases

- `pattern` on SQLite: an error value naming the check, per FR-005.
- A name of 70 characters on PostgreSQL: an error value, per FR-003.
- A code `employedBy`: `employed_by` stored in snake case, `employedBy` in camel case, and as it is where the codes are kept by name, per FR-002.
- `camel` of the words of `line1`: `line1`, and `snake` of them `line_1`, per FR-001.
- A table that refers to itself: made by one statement, per FR-006.
- Two tables that refer to each other: an error value where the dialect cannot add a constraint afterwards, per FR-006.
- A fourth dialect written in a project, as an extension: `bind` takes it as it takes the three, per FR-013.
- An extension that adds a comment for a column: it is given the column's written name, per FR-011.
- A reference load of a code table run twice: the same rows, per FR-008.

## Assumptions

- Every name is quoted, so a reserved word is never a problem and the dialect has no list of them.
- A dialect that cannot add a constraint to an existing table (SQLite) cannot break a cycle of foreign keys.
- DuckDB does not enforce the length of a `VARCHAR`, and its dialect writes none, as the model it replaces did.
- Statements are text made by the dialect, in groups; no tagged template or query builder is needed until queries are built.
- PostgreSQL's engine is PGlite in the tests, DuckDB's is DuckDB's own Node client, and SQLite's is the runtime's `node:sqlite`; they are development dependencies of the tests only.

## Open questions

- **OQ-1**: Whether `bind` is to truncate a name that is too long, with a hash, where a project asks it to.

## Key entities

- **Dialect** - how one engine writes a logical schema.
- **Case style** - how words are written as a name.
- **Naming** - the case styles of the names and of the stored codes.
- **Statement** - one piece of SQL, its group, and the logical elements it was made from.
- **Physical schema** - the ordered statements `bind` makes.

## Success criteria

- **SC-001**: A governance domain becomes a database in any of three engines, by statements whose names read as that database's own and whose every object is traced to what the business said.
- **SC-002**: A dialect that cannot express something says so before anything is run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
