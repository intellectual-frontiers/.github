# Feature Specification: Names that carry a schema

**Spec ID:** 0013-sql-qualified-names
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** A table may live somewhere other than the default place: in a schema of its own, so that what an application may touch (views) and what only the lifecycle may touch (tables) are kept apart (0014). The physical schema therefore needs names that carry a schema. A project says the schema once (`schema` of `bind`), and every table is then made, referred to, indexed, loaded, described and changed there. Where the engine has schemas (PostgreSQL, DuckDB) the names are qualified (`"data"."book"`) and the schema is made first; where it has none (SQLite) the schema's words are written before each table's own, by the case style (`data_book`, `dataBook`), so that the same separation holds as a convention. Nothing changes for a project that gives no schema.

## The schema

- **FR-001**: `bind` MUST take an optional `schema`, a name in governance's way of writing names, and where none is given the statements it makes MUST be the same as they were before this specification.
- **FR-002**: For a dialect that has the feature `schemas`, `bind` MUST make the schema first (`CREATE SCHEMA IF NOT EXISTS`, in the group of setup) and MUST write every reference to a table qualified by it: in `CREATE TABLE`, in the `REFERENCES` of a foreign key, in `ON` of an index, in `ALTER TABLE` and in an upsert.
- **FR-003**: For a dialect that lacks it, `bind` MUST write the words of the schema before the words of each table's name, with the case style, and MUST write no `CREATE SCHEMA`; the length of a name MUST be checked after the words are added.
- **FR-004**: What a statement source is given (`written`) MUST give the reference to a table by its identity (`ref`), the reference to a table of an extension by the name it is written by (`qualify`) and the name a table of an extension is written by after the schema's words are added (`tableName`), so that an extension never builds a reference by hand.

## The extensions

- **FR-005**: The comments, the documentation tables, the governance tables, the views, the access (policies and grants), the routines and the partitions MUST write every reference to a table through FR-004, and the tables that an extension makes MUST be made in the same schema as the tables they describe.

## The lifecycle

- **FR-006**: A state MUST record the schema (`qualifier`) where the dialect has schemas, so that a state of one schema is another state than that of none; and a plan MUST write the references of its statements, and the probes of its guards, qualified by it.
- **FR-007**: The steps of a plan from empty, and then from each version to the next, MUST leave on SQLite, DuckDB and PostgreSQL the database that `bind` makes for the last version in the same schema.

## What the database holds

- **FR-008**: On DuckDB and PostgreSQL the tables, their foreign keys, their indexes, their reference rows, their comments and the tables of the documentation extensions MUST be in the schema and none in the default one; on SQLite the same tables MUST be there with the schema's words before their names.

## Out of scope

- A schema for each concept, or for each version of the API: 0014 and the parallel-versions feature make views in schemas of their own with this.
- Moving a database from one schema to another: a rename of the schema is a step a person writes.
- The ledger's table: it is in the connection's default schema, until a setting names another.

## Edge cases

- No schema given: the statements are as they were, per FR-001.
- A schema named `data` on PostgreSQL: `"data"."book"`, per FR-002; on SQLite `data_book`, and in camel case `dataBook`, per FR-003.
- A table whose name with the schema's words is too long: an error value, per FR-003.
- A table of an extension named like a table of the schema once the words are added: an error value naming both (0008 FR-007).
- A policy on a table in a schema: `ON "data"."document"`, per FR-005.

## Assumptions

- An engine with schemas looks a table up by its qualified name whatever its search path.
- An index lives in its table's schema, so its name is not qualified where it is made and is qualified where it is dropped.

## Open questions

- **OQ-1**: Whether `schema` may be a list (a schema of tables and another of reference data).

## Key entities

- **Schema** - the place tables are kept, written as a qualifier or, where the engine has none, as the first words of each name.
- **Reference** - a table as a statement names it.

## Success criteria

- **SC-001**: The same governance gives the same tables in any schema, and an extension never has to know whether the engine has schemas.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
