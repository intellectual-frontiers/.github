# Feature Specification: Protected access

**Spec ID:** 0014-sql-protected-access
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Nothing should reach a table except through a layer that can be changed without changing the table, and nothing should change a table except the lifecycle. The protection layer keeps the tables in a schema of their own (0013-sql-qualified-names), makes a view of each in a schema that applications use, and gives roles rights on the views and none on the tables. Where the engine can enforce it (PostgreSQL) the tables are owned by the lifecycle, the roles that governance names (`security.access`) are granted on the views, the rows each may see are filtered by the scope governance names (`security.scope`) even for the views' owner, and a guard refuses to alter or drop a table or a column except in a migration; where it cannot (SQLite, DuckDB) the same schemas and views are a convention, and a project that asks for enforcement there is told it cannot have it. The views are also what keeps consumers working while tables change: a column that was renamed stays in its view under its old name for as long as governance says so, and a view is dropped and made again around any step that would otherwise be blocked by it. The views carry what governance says must be hidden (`security.mask`). Every name, schema, role and switch is a setting with a default.

## The layer and its settings

- **FR-001**: The settings MUST be a typed value, each with a default: the schema of the tables (`data`), the schema of the views (`api`), the enforcement (`auto`, the default: enforced where the dialect can, a convention where it cannot; `enforced`; or `convention`), the guard (`on`, the default, or `off`), the masks (`on`, the default, or `off`), the roles that see a masked value as it is (none by default) and the name of the setting a migration sets (`lifecycle.migrating`); and a project MUST be able to change each.
- **FR-002**: The tables MUST be in the schema of the tables, and for each table of the logical schema there MUST be a view of the same name and columns in the schema of the views (written without the schema's words, where the dialect has no schemas and the words are in the table's name); a table of an extension (the documentation tables) MUST NOT have a view.
- **FR-003**: A view MUST be made by dropping it and making it again, together with its comment where the dialect has `COMMENT ON` (the table's description), as one unit that the lifecycle applies again when its text changes or a step changes the table; on PostgreSQL it MUST be a security barrier.

## Writing through the views

- **FR-004**: A row MUST be able to be inserted, updated and deleted through the view on PostgreSQL (the view is updatable) and on SQLite (instead-of triggers that the layer makes), and on DuckDB, whose views are read-only, the layer MUST say so and make no trigger.

## Enforcement

- **FR-005**: Where the layer is enforced, the roles `security.access` names MUST be granted on the views only (`SELECT` for those that read, `INSERT`, `UPDATE` and `DELETE` for those that write) and `USAGE` on the schema of the views; every right on the schema of the tables and on its tables MUST be taken from `PUBLIC`; and a table that has a scope MUST have row-level security forced, with one policy that does not name a role, so that the rows a role sees through a view are those of its scope.
- **FR-006**: Where the layer is enforced and the guard is on, the layer MUST make a guard that refuses to alter or drop a table or a column of the schema of the tables unless the session has said that a migration is running, and the lifecycle's run MUST say so for the transactions of its steps (`before`); a table of another schema MUST be free to change.
- **FR-007**: The layer asked for enforcement on a dialect that cannot enforce it (`enforced` on SQLite or DuckDB) MUST be returned as an error value naming what the dialect lacks; `convention` MUST make the schemas and the views and none of the grants, the policies or the guard on any dialect.

## Consumers while tables change

- **FR-008**: An attribute that carries `lifecycle.renamedFrom` MUST stay in its view under the old name as well as the new, for as long as the annotation is there, and MUST leave the view when it is taken out.
- **FR-009**: The layer's transform of the lifecycle MUST, for a step that renames, alters or drops a table or a column, drop the views of the table before the step's statements and make them again after them, in the same transaction, so that a step is never blocked by the view it changes; the views made again MUST be those of the state after the step.
- **FR-010**: The lifecycle MUST give a transform the states before and after a step, MUST apply as one unit the statements of a group that are made from the same elements, and MUST apply again a unit made from an element a step changed.

## Masks

- **FR-011**: Where the masks are on, a column that carries `security.mask` MUST be hidden in its view: `hash` as the hash of its text (`md5`, on PostgreSQL and DuckDB), `redact` as a constant for text and null for any other type, `partial` as its first two characters and `***`; on PostgreSQL a role that the settings name MUST see the value as it is; and a mask the dialect cannot write (`hash` on SQLite) MUST be an error value naming the column.

## What the database holds

- **FR-012**: On PostgreSQL with roles that own nothing, a role that governance lets read MUST see through the view only the rows of its scope and MUST NOT be able to read the table; a role that governance lets write MUST be able to insert through the view in its scope and MUST NOT be able to outside it; and the guard MUST refuse `ALTER TABLE` and `DROP TABLE` in the schema of the tables outside a migration and allow them in one. Where a project gives a secret that seals the flag (`migratingSecret`), the guard MUST hold only its hash, a session that says `on` or guesses MUST NOT be taken for a migration, and one that holds the secret MUST be.
- **FR-013**: On SQLite, DuckDB and PostgreSQL, the plans from empty and from each version of a domain to the next, run with the layer, MUST leave the tables in their schema, a view of each with the columns of the last version, the reference rows and no table of the views' schema.

## Out of scope

- Views that leave out the rows marked as removed (Arca's `deleted_at`): a later extension, on the roadmap.
- A schema for each version of an API (parallel versions): the layer's views in a schema of their own are what they are made of, and the feature is its own specification.
- A column that is dropped staying in its view: the safety features (quarantine) make the drop a rename away first.
- Creating the roles themselves: the layer names roles and never creates them.

## Edge cases

- A concept with `security.access` and no scope: grants on the view and no policy, per FR-005.
- A role in `security.access` of a concept and the schema of the views not granted to it: it is granted `USAGE`, per FR-005.
- A renamed attribute whose annotation is then taken out: the next plan makes its view again without the old name, per FR-008.
- A step that drops a column the view shows: the view is dropped, the column dropped, the view made again without it, per FR-009.
- SQLite with `enforced`: an error value, per FR-007.
- A masked column that is part of the key: shown masked; the key columns of a write are matched on the table's own, per FR-004.
- No `lifecycle.migrating` set by a session that alters a table: refused, per FR-006.

## Assumptions

- The guard stops accidents of a privileged session; what stops a role is what it has been granted.
- A view in PostgreSQL runs with the rights of its owner, and `current_user` in it is the role that reads.
- The roles exist.

## Open questions

- **OQ-1**: Whether the guard may be told, by the lifecycle's run, which role may migrate, so that the flag alone is not enough.

## Key entities

- **Protection** - the schema of the tables, the schema of the views, the views and, where enforced, the grants, the policies and the guard.
- **View unit** - a view with its comment and its triggers, applied together.
- **Shim** - the old name of a renamed column, kept in its view.
- **Migration flag** - the setting that tells the guard a migration is running.

## Success criteria

- **SC-001**: An application that uses only the views keeps working when tables are renamed, widened or reorganised, and cannot change them.
- **SC-002**: On an engine that cannot enforce, the layer says so and is a convention, never a promise.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
