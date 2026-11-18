# Feature Specification: Safe migrations

**Spec ID:** 0015-sql-safety
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** A migration that is correct can still lose data, hold a lock until the application stops answering, or report success without having done what it said. Three features of the lifecycle, on by default, make a step safe in those three ways. Quarantine means a column or a table is never destroyed by the step that removes it: its values are copied to a table of their own first, or the table is renamed away, so that the step can be undone and nothing is lost until a person purges it. Lock discipline means a step that changes a table asks for its locks with a timeout, is tried again when it times out, and adds a constraint in two parts so that the part that holds the strongest lock is short. Verification means every step says what must be true after it (and what must be the same as before it, such as the number of rows) and the run checks it in the step's own transaction, so that a step that did not do what it said is rolled back and not recorded.

## The core's part

- **FR-001**: A step MAY carry a verification, queries to run before it (captures of a value) and after it (checks that a query returns a row, returns none, or returns the value captured), and `execute` MUST run the captures before the step's statements and the checks after them in the step's transaction, and a check that fails MUST roll the step back, record nothing and be returned as an error value naming the check; the verification MUST be part of the step's identifier.
- **FR-002**: `execute` MUST be able to try a step again when its error is of a kind the project names (a lock timeout), a number of times with a pause between, and MUST return the last error where it still fails.
- **FR-003**: `plan` MUST apply the transforms before it decides that a step is refused, so that a destructive step that a transform has made safe is not refused.

## Quarantine

- **FR-004**: Quarantine MUST make a step that drops a column copy the column's values with the table's key into a table of its own before the drop (`<table>_<column>_quarantine`, written by the case style and in the schema of the tables), MUST NOT run again once that table is there, and MUST make the step `data-dependent` and `quarantine`-reversible, with the statements that add the column again and restore its values as the step's down.
- **FR-005**: Quarantine MUST make a step that drops a table rename it to `<table>_quarantined` instead, MUST make the step `data-dependent` and `quarantine`-reversible, with the rename back as its down, and the step MUST say, from governance's `quality.retention` where it has one, how long it is to be kept.
- **FR-006**: A purge MUST be a step that a person asks for by name (`purge`), that drops a quarantine table, and MUST be refused unless the table is a quarantine table.
- **FR-007**: A step that drops a column or a table MUST, with quarantine off, remain destructive and be refused unless allowed.

## Lock discipline

- **FR-008**: Lock discipline MUST write, at the start of a step that changes a table that exists, the settings that make the step ask for its locks with a timeout and run with a limit (`lock_timeout`, `statement_timeout`), for a dialect that has them, and MUST give `execute` the retry for a lock timeout.
- **FR-009**: Where the dialect can add a constraint without checking the rows that are there, a foreign key or a check added to a table that exists MUST be added in two statements, the constraint not validated and then validated, and the step's verification MUST say the constraint is valid.

## Verification

- **FR-010**: Verification MUST give each step the checks that follow from its change: a table made exists with its columns; a column added exists and is as nullable as said; a column or a table dropped (or quarantined) is gone and its quarantine table is there; a rename leaves the new name and not the old; a constraint or an index made exists where the dialect can say so; and a step that changes the structure and not the data MUST find the same number of rows in the tables it touches as before.

## Settings

- **FR-011**: Each feature MUST be on by default and be switched off by a setting, and the settings (the timeouts, the number of tries, the pause, the suffixes) MUST each have a default and be changeable.

## What the database holds

- **FR-012**: On SQLite, DuckDB and PostgreSQL, dropping a column that holds values MUST leave its values in the quarantine table and, run backwards by the step's down, MUST restore them; dropping a table MUST leave it under its quarantine name with its rows and, run backwards, MUST bring it back; a step whose check fails MUST leave the database and the ledger as they were; and a lock timeout MUST be tried again and then given up as an error value.

## Out of scope

- Changing a column's type without loss (a second column, a check that every value survives the cast, a swap): a later feature, on the roadmap.
- Creating an index without blocking writes: it cannot run in a transaction, and the run has no steps outside one yet.
- When a quarantine table is purged: a person says, with a step; a schedule is the project's.
- A quarantine table's own rights: it is in the schema of the tables, where only the lifecycle's role has any.

## Edge cases

- A column dropped from a table that has no primary key: its values are copied with every column that the table has, per FR-004.
- A column dropped twice (the step run again): the quarantine table is there, so it is not made again, per FR-004.
- A table dropped whose quarantine name is taken: an error value, per FR-005.
- A purge of a table that is not a quarantine table: an error value, per FR-006.
- Quarantine off: a drop is destructive again and refused, per FR-007.
- A lock timeout three times in a row with three tries: the last error is returned, per FR-002.

## Assumptions

- A column's values are small enough to copy within the step's transaction; a big copy is a step a person splits.
- A lock timeout is reported by the engine with a message that the project can recognise.

## Open questions

- **OQ-1**: Whether the quarantine tables are also listed in the governance tables, with the step and the retention, so that the database says what it is keeping and why.

## Key entities

- **Quarantine table** - where the values of a dropped column, or the dropped table itself, are kept until purged.
- **Verification** - the checks that a step did what it said, run in its transaction.
- **Capture** - a value read before a step, to be compared after it.

## Success criteria

- **SC-001**: No step destroys data unless a person purges it, holds a lock without a limit, or is recorded without having done what it said.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
