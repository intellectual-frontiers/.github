# Feature Specification: Making a table again

**Spec ID:** 0017-sql-rewrite
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** SQLite and DuckDB cannot change a column's nullability or default, a primary key or a constraint of a table that exists, and SQLite cannot add a column that is required and has no default; PostgreSQL can, but will not change a column's type without being told how to cast its values. The lifecycle (0011-sql-lifecycle) says these are steps a person must write. This feature writes them: a table is made again from the state after the change (a new table, the rows copied, the old one dropped, the new one renamed, the indexes made) in the step's own transaction, so that either all of it happens or none. A change of type is made in place with a cast where the engine can and by making the table again where it cannot, when the project says that its values may be cast. What it cannot do safely it leaves to a person, and says why.

## The core's part

- **FR-001**: `plan` MUST offer a change that the core cannot make in place to a fallback its options give (and a composition's extensions contribute through the engine's point `lifecycle.fallback`) before it is an error value that asks for a person's step; the step the fallback makes MUST go through the transforms like any other step, and a step a person wrote for the change MUST take its place.

## Making a table again

- **FR-002**: For a dialect that says how a table is made again, a change of whether a column may be null, of a default, of the primary key, of a constraint that is not an index, or a column that is required and has no default, MUST be made by making the table again: the statements the dialect needs first, a table of the state after the change under a name of its own, the rows of the columns the two tables have in common copied into it, the old table dropped, the new one renamed to the old name, and the indexes made.
- **FR-003**: The step MUST say that it makes the table again, MUST be `data-dependent` where the change may be refused by the rows (a constraint added, a column made required) and `safe` where it may not, MUST be `lossless`-reversible with the statements that make the table again as it was, and MUST be only as safe to run twice as the ledger makes it.
- **FR-004**: The feature MUST leave the change to a person, and the error value MUST remain, where a column of the table after the change is required, has no default and is not in the table before; where the dialect stops a table that other tables' foreign keys refer to from being dropped and one does; or where a column's type changes and casts are not allowed.
- **FR-005**: The statements MUST be written from the state, with names and types as written, and MUST be the same for the same states every time.

## Changing a type

- **FR-006**: Where the settings allow casts, a change of a column's type MUST be made in place with `SET DATA TYPE ... USING CAST` for a dialect that can alter a column, and by making the table again with `CAST` of the column for one that cannot; the step MUST be `data-dependent` and say that values may change or be refused, and where casts are not allowed (the default) it MUST remain an error value that asks for a person.

## Settings

- **FR-007**: The feature MUST be on by default and be switched off by a setting, and whether casts are allowed and the last word of the new table's temporary name MUST each have a default and be changeable.

## What the database holds

- **FR-008**: On SQLite and DuckDB, a constraint added to or taken from a table, a column made required and a type cast, each by making the table again, MUST leave the table with its rows, its indexes, its new definition enforced and the tables that refer to it still referring to it (where the dialect lets the table be dropped), and a step whose rows do not meet the change MUST be rolled back whole, leaving the old table; and the protection layer's views MUST be dropped before and made again after.
- **FR-009**: A step that makes a table again on an engine that drops a table's triggers with it MUST say, in its verification, that the number of the table's triggers is the same after as before, so that a table that has triggers is not made again without them: the step fails, is rolled back whole, and the triggers are as they were.

## Out of scope

- Changing a type without loss (checking that every value survives the cast, then swapping): a later feature, on the roadmap.
- Making a table again in PostgreSQL where it can alter in place: it never does.
- A table made again while the application writes to it: a step takes the table's lock for its length.

## Edge cases

- A foreign key added on SQLite: the table is made again with the key, per FR-002.
- A required column with no default added on SQLite: left to a person, per FR-004.
- A table that other tables refer to on DuckDB: left to a person, per FR-004.
- A type changed with casts refused: an error value that says casts are not allowed, per FR-006.
- A column made required where a row has no value: the step fails and is rolled back, per FR-008.
- The feature off: the error values of the core, per FR-007.

## Assumptions

- A transaction can make a table, copy rows, drop a table and rename one: it can in all three engines.
- SQLite checks foreign keys at the end of the transaction when `PRAGMA defer_foreign_keys` is on.

## Open questions

- **OQ-1**: Whether a table made again keeps the grants and the policies made on the old one, which the protection layer makes again after the step but a project's own do not.

## Key entities

- **Rebuild** - the statements that make a table again as another.
- **Fallback** - what makes a change the core cannot make in place.

## Success criteria

- **SC-001**: A change to the schema that governance asks for is a step the lifecycle can make on every engine, or an error value that says what a person must write and why.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
