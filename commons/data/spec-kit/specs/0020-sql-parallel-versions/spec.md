# Feature Specification: Parallel versions

**Spec ID:** 0020-sql-parallel-versions
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** The application and the database are never released at the same instant, so for a while two versions of the application meet one database. This feature lets both work. The tables hold what every live version needs (the latest version's, with the columns and tables an older version still uses kept, and what only the latest needs made optional, so that an older version's writes are not refused). Each live version has a schema of its own (`api_v2`, `api_v3`) of views with that version's own table and column names over those tables, so that a column that was renamed is read and written under its old name by the older version and its new name by the newer, with nothing copied and nothing to keep in step. The change to the tables is the expand (renames in place and additions: nothing that destroys), made by the ordinary plan to the schema that holds what every live version needs; when the older version is retired, the contract is the ordinary plan to the latest schema (which drops what only the older used, into quarantine, and makes the optional required) and the dropping of the older version's schema. Both steps are plans like any other, so every strategy and every feature applies to them.

## What the tables hold

- **FR-001**: `expandSchema` MUST give, from the latest version's logical schema and those of the older live versions, the logical schema the tables are made to during the overlap: the latest's, with each column and table of an older version that the latest does not have (matched by words, and for a column that governance says was renamed, by the name it had) added as an optional column or table with no default, and each column the latest has and an older version lacks made optional.
- **FR-002**: The plan from the tables as they are to that schema MUST be an expand: it MUST contain no step that drops a column, a table or rows, and a column renamed by governance MUST be a rename in place.

## What each version sees

- **FR-003**: For each live version `versionViews` MUST make a schema `api_<label>` (the pattern is a setting) and in it a view of each table of that version with that version's names for the table and its columns, over the tables of FR-001, where a column the version knows by another name than the tables use is selected under the version's name; it MUST be made as a unit that the lifecycle applies again when the tables change.
- **FR-004**: A version's view MUST show a column of its version and no other: not what only a newer version added, not what is kept for an older one.
- **FR-005**: A row written through the view of any live version MUST be read through the view of every other under that version's names, with no copy and no trigger, on PostgreSQL where its views are updatable; and an older version's insert MUST NOT be refused for a column it does not know.

## Retiring a version

- **FR-006**: Retiring a version MUST be the statements that drop its schema, and the contract MUST be the ordinary plan from the tables to the latest schema; after both, the older version's schema MUST be gone, what only it used MUST be in quarantine and what only the latest needed MUST be required.

## Settings

- **FR-007**: The pattern of a version's schema, the label of the version whose views the protection layer makes (so that they are not made twice), and the roles that may use each version's views (from governance's `security.access`) MUST each have a default and be changeable.

## What the database holds

- **FR-008**: On PostgreSQL, a database at the older version, expanded, MUST serve both versions at once (FR-005), contracted MUST serve the latest alone and keep what the older used in quarantine; on DuckDB the views MUST read (they are read-only) and on SQLite the views MUST read under the version's label in their names.

## Out of scope

- A change of a column's type, or a split or a merge of columns, which needs the old and the new column kept in step by a trigger: a later specification; the plan says it needs a step.
- Choosing when to retire a version: the project's, from what it knows of its clients.
- Routing a client to a version: its connection's search path or its schema name.

## Edge cases

- A table that a newer version added: not in the older version's schema, per FR-004.
- A column an older version used that the latest dropped: kept optional until the contract, per FR-001.
- DuckDB cannot alter a table that other tables reference, so an in-place expand of such a table is the rewrite's work; its views are created after the expand, per FR-008.
- The older version's views must be retired before the contract, since a view holds the column the contract quarantines, per FR-006.
- An older version that inserts without a column the latest requires: the column is optional during the overlap, per FR-001 and FR-005.
- A version retired twice: the drop is `IF EXISTS`, per FR-006.
- Only one live version: the views of that version and no retained columns, per FR-001.

## Assumptions

- Versions are given oldest first, each with the logical schema it was made from.
- The retained columns are the older version's, as it knew them.

## Open questions

- **OQ-1**: Whether the overlap's tables are also described in the governance tables, with the version that still needs each retained column.

## Key entities

- **Live version** - a version of the application that is still in use, with its schema.
- **Expanded schema** - what the tables hold while versions overlap.
- **Version schema** - the views one version uses.

## Success criteria

- **SC-001**: A release of the application and a release of the database need not happen together, and nothing is lost at either.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
