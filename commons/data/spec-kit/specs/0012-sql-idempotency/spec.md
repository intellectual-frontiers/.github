# Feature Specification: Idempotent migrations

**Spec ID:** 0012-sql-idempotency
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** A step that is run twice must do no harm, because a step is run twice more often than anyone plans: a deploy is retried after a timeout, a database is restored from a backup taken in the middle of a release, a script is run by hand to see if it worked. Idempotency is a feature of the lifecycle (0011-sql-lifecycle), on by default, that makes every generated step safe to repeat. It does so in three ways, and says which it used. Where the engine has a natural form (`IF NOT EXISTS`, `IF EXISTS`, an upsert) the statement is written in it. Where it has none (a constraint that is added, a column that is renamed) the statement carries a guard, a query on the engine's catalog that says whether the statement's work is already done, which a runner honours and which plain SQL can carry as a block where the engine has one. Where neither is possible the step is marked as relying on the ledger alone. Every step names which it is.

## Making a step safe to repeat

- **FR-001**: A dialect MUST be able to say which of its `DROP` and `ADD COLUMN` forms have an `IF [NOT] EXISTS` (`ifExists`) and to give, for a table, a column, a constraint and an index, a query that returns a row if and only if it exists (`probes`), or no probe where the engine cannot say it.
- **FR-002**: A statement of a step MAY carry a guard, a query and the answer that means the statement is to be skipped; a run MUST honour it, so that a guarded statement is not run when its work is done; and the guard MUST be part of the step's identifier, so that two steps that differ only in their guards are two steps.
- **FR-003**: The idempotency transform MUST write a statement in its natural form where the dialect has one (`ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF EXISTS`, `DROP TABLE IF EXISTS`, `DROP INDEX IF EXISTS`, `DROP CONSTRAINT IF EXISTS`); MUST guard it by a probe where it has none (adding a constraint, renaming a table, a column, a constraint or an index, dropping a constraint or a column the dialect cannot drop in the natural form); and MUST leave a statement that is idempotent already (`CREATE TABLE IF NOT EXISTS`, an upsert, a delete by key, `SET NOT NULL`, `SET DEFAULT`) as it is.
- **FR-004**: Each step MUST say how it is idempotent: `natural` where every statement is, `guarded` where some are guarded and none is left, and `ledger-only` where some statement can be made neither, so that it is safe only because the ledger runs it at most once; the same MUST hold for the statements that undo it.
- **FR-005**: A step written by a person MUST be `ledger-only` unless the person gives its statements guards.

## On by default

- **FR-006**: The idempotency transform MUST be an extension of the lifecycle that contributes through the engine's point `lifecycle.transform`, and its default composition (`defaultIdempotency`), which the strategies include, MUST have it on; a project MUST be able to leave it out, or to set it to `off`, for plain, unguarded statements.
- **FR-007**: A project MUST be able to set that a step that is `ledger-only` is refused, as an error value naming the step, instead of allowed.

## Carrying a guard in plain SQL

- **FR-008**: Where the dialect has a procedural block (PostgreSQL's `DO`), a guarded statement MUST be able to be written as one block that runs the statement only if the guard says so, so that a script that no runner reads still does no harm run twice; where it has none, the guarded statement MUST NOT be written as plain SQL, and the answer MUST say so.

## What the database holds

- **FR-009**: On SQLite, DuckDB and PostgreSQL, running each step of a plan twice in a row, without the ledger, MUST leave the database as running it once did and MUST raise no error, for the steps that are `natural` or `guarded`; and running a whole plan again from its start, without the ledger, MUST do the same.

## Out of scope

- A step the engine cannot repeat and that has no probe (a constraint of SQLite): it is `ledger-only`, and FR-007 can refuse it.
- A data migration written by a person: FR-005.
- Making a long step resumable half-way: the safety features (0015).

## Edge cases

- A column added on PostgreSQL: `ADD COLUMN IF NOT EXISTS`, `natural`, per FR-003.
- A column added on SQLite: guarded by `pragma_table_info`, per FR-003.
- A column renamed on any engine: guarded by the old column's probe, per FR-003.
- A foreign key added on PostgreSQL: guarded by `pg_constraint`, per FR-003; on SQLite it cannot be added at all (0011-sql-lifecycle FR-008).
- A step a person wrote: `ledger-only`, per FR-005; with `refuse`, an error value, per FR-007.
- The feature left out: the statements are the core's and no step says how it is idempotent, per FR-006.

## Assumptions

- A probe reads the catalog of the connection's current schema.
- A guard is a read; it does not change the database.

## Open questions

- **OQ-1**: Whether a guard may be a list of conditions (a column exists and has this type), for the steps of the safety features that check a column's shape before a swap.

## Key entities

- **Natural form** - a statement written with `IF [NOT] EXISTS` or as an upsert.
- **Guard** - a catalog query and the answer that means a statement's work is done.
- **Idempotency level** - `natural`, `guarded` or `ledger-only`.

## Success criteria

- **SC-001**: Any step the lifecycle makes can be run twice, by a runner or by hand, with the same result as once, or says plainly that it cannot.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
