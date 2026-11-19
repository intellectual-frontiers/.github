# Feature Specification: Documentation in the database

**Spec ID:** 0008-sql-documentation
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Governance is the documentation of everything below it, so what it says must reach the database where a person or a program will look. Three extensions do that, and a project's composition says which. The first writes the human description of each table and column as `COMMENT ON` where the engine has it. The second makes a table of those descriptions where the engine has no `COMMENT` (SQLite), by default, or wherever a project asks. The third makes tables of what governance says in a form a program reads: every annotation as a row of JSON, and a trace from each table and column to the governance element it was made from. A comment holds a human description and nothing else; what a program reads is in tables. All three are on by default, and each is switched off by leaving its extension out or by a setting.

## The three extensions

- **FR-001**: The comments extension MUST, for a dialect that has `COMMENT ON`, make a `COMMENT ON TABLE` of each table and a `COMMENT ON COLUMN` of each column that has a description, with the description as it is, in the group of documentation; for a dialect that has none it MUST make nothing.
- **FR-002**: The documentation tables extension MUST make a table `documentation` of each table's and each column's description (`table_name`, `column_name` where the empty text names the table itself, `description`), keyed by the first two, and load it, where the dialect has no `COMMENT ON` (its default), or in every dialect, or in none, as its setting says.
- **FR-003**: The governance tables extension MUST make the tables `governance_annotation` (the element, the position of the annotation among the element's, its kind and its value as JSON) and `governance_trace` (each table and column, as written in the database, with the governance element and the logical element it was made from), and load them, in every dialect, unless its setting is off.
- **FR-004**: A comment MUST hold the human description of what it is on and no machine-readable governance: its text is the definition, as it is.

## Settings and composition

- **FR-005**: The settings MUST be a typed value: the comments (`dialect`, the default, or `never`), the documentation tables (`when-no-comment`, the default, `always` or `never`) and the governance tables (`on`, the default, or `off`), with the names of the tables; a setting that is not given MUST be its default.
- **FR-006**: Each extension MUST be an extension of the engine that contributes a statement source to `physical.statements`, and the defaults MUST be a list of the three, so that a project drops one by leaving it out and replaces one by its own; `documentationSources` MUST give the same sources without the engine.

## What the database holds

- **FR-007**: The tables of FR-002 and FR-003 MUST be made by the physical schema's own machinery from a logical schema of their own, so that their names are written by the case style, their types are the dialect's and their statements are `CREATE TABLE IF NOT EXISTS` and upserts; a table of the schema that has one of their names MUST be returned as an error value that names both.
- **FR-008**: Loading the statements twice MUST leave the same rows in each table, and loading them after a description or an annotation changed MUST update the row and leave no row of what is gone to be read as current.
- **FR-009**: Where the governance tables are on, every annotation of the domain MUST be a row of `governance_annotation`, and every table and column of the schema a row of `governance_trace`; this is where an annotation that the schema cannot express itself is carried as data, which the flow report says (0006-logical FR-011).

## Out of scope

- The descriptions of views and routines: they are built with them.
- A description in another language, and the history of a description: a later extension.
- Row-level security and the other things a governance annotation may become: their own extensions.
- Reading the tables back as a governance domain: a later extension.

## Edge cases

- PostgreSQL by default: `COMMENT ON` for every table and column, no `documentation` table, and the governance tables, per FR-001, FR-002 and FR-003.
- SQLite by default: no comment (it has none), a `documentation` table, and the governance tables, per FR-001 to FR-003.
- PostgreSQL with the documentation tables `always`: both the comments and the table, per FR-002.
- A project that leaves the governance extension out: no governance table, per FR-006.
- A description with a quote in it: written with the quote doubled, per FR-001 and FR-007.
- A concept named `documentation`: an error value naming it and the table of the extension, per FR-007.
- A column with no description: no comment and no row, per FR-001 and FR-002.
- An annotation of a kind no vocabulary knows: a row like any other, its value as JSON, per FR-009.
- A closed code list, which has no table: its annotations are rows of `governance_annotation` and it has no trace, per FR-009.

## Assumptions

- A governance element's identity is its text (`arcaParty/person.givenName`), which is what the tables hold.
- The value of an annotation is JSON; where a value cannot be (it holds a function), it is not a governance annotation, and the projection would not carry it.
- `COMMENT ON` in PostgreSQL and in DuckDB means the same: a description kept with the object.
- The governance tables are small and are loaded whole: a project that wants a history keeps one of its own.

## Open questions

- **OQ-1**: Whether the governance tables are also to carry the code lists' codes and the definitions of the elements, so that a program may read the whole of governance from the database.

## Key entities

- **Comments extension**, **documentation tables extension**, **governance tables extension** - the three.
- **Settings** - the typed values that say which are on and how.
- **`documentation`**, **`governance_annotation`**, **`governance_trace`** - the tables.

## Success criteria

- **SC-001**: A person who opens a database made from governance finds what each table and column is, in the way their engine shows it, and a program finds what governance says of each in a table.
- **SC-002**: What governance said of the data is in the database, or the report says where it is not.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
