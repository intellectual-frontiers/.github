# Feature Specification: History

**Spec ID:** 0018-sql-history
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** The first of the two strategies. A plan (0011-sql-lifecycle) is computed once, from the state a database is in to the state wanted, and frozen into files that never change: one file for each step, its statements to do it and to undo it, what must be true after it, and a manifest that chains them by hash. Every environment, whatever state governance has moved on to since, replays the same files in the same order and ends in the same state, which it can prove by the hash. The files are the history; the schema is what the history adds up to. A person may read, review and sign the files; a change to a file that has been frozen is found, never silently applied. How the files are delivered is a feature of the strategy and not another strategy: through the pipeline of the team that owns the application (the files and a replay), as one release package for a DBA to run with nothing but a SQL client (an installer, a preflight, a verification, a back-out and a runbook), or as a procedure inside the database that applies its own history, keeps its own ledger and refuses what does not follow.

## The frozen history

- **FR-001**: A step MUST be written as a file whose name has its number and a slug of its name, whose header holds, as JSON, its identifier, the hashes of the state it needs and leaves, its key, kind, class, reversibility and idempotency and the elements it is made from, and whose body holds its statements to do it, each with its group, its origin, the elements it is made from and its guard, its statements to undo it, and what must be true after it; and the file MUST be the same for the same step every time, and parsing it MUST give the step back.
- **FR-002**: A manifest MUST list the files in order with the hash of each file's text and a chain hash of the entry before it, so that a file that is changed, taken out, put in or moved is found; and the identifier in a file's header MUST be the one its content makes, so that a file edited with its manifest entry is found too.
- **FR-003**: `freeze` MUST give only files that are new: the steps of a plan that the history does not hold, after the history's last state, and MUST NOT rewrite a file that is there; a plan that does not start where the history ends MUST be an error value naming both states; freezing what is frozen already MUST give nothing new.
- **FR-004**: The repeatable objects of the plan and the state it ends in MUST be frozen beside the steps, replaced by each freeze, so that a replay applies what extensions add and a person can see the state the history adds up to.

## Replaying

- **FR-005**: `replay` MUST check the manifest and every file before it runs, MUST refuse with an error value a history that does not check, and MUST then run what the files say through the lifecycle's run (with its ledger, its transactions, its checks, its guards and its base), so that replaying the files is running the plan they were frozen from.
- **FR-006**: The same files MUST leave SQLite, DuckDB and PostgreSQL each in the state they name, with the ledger holding the same step identifiers and state hashes, and a second replay MUST do nothing.

## Delivery

- **FR-007**: The delivery through the pipeline MUST be the files, the manifest, the repeatable objects and the state, as files of the physical schema's own file type, and a replay.
- **FR-008**: The delivery as a release package MUST give an installer that runs the steps in one transaction with the guards written in the SQL itself (where the dialect has a procedural block), a preflight that returns a row only if the database is in the state the release needs, a verification of what must be true after it, a back-out that undoes the steps that can be undone in the opposite order, a runbook, and a manifest; and where a guard cannot be written in the dialect's SQL the package MUST be an error value that says so, unless the project allows it to be left out.
- **FR-009**: The delivery as a procedure in the database (PostgreSQL) MUST give an installer that makes a schema, a table that is its ledger (each entry chained to the one before it by hash) and a procedure `migrate` that takes a lock, checks the ledger's chain, finds where the database is, refuses one that is not in the state the next step needs, runs each step not yet applied with its guards and its verification, writes its entry, and applies what extensions add; and `migrate` run again MUST do nothing, and a ledger entry that was changed MUST make it refuse.

## Settings

- **FR-010**: The delivery, the folder the files are in (`migrations` by default), the release's label, and whether a guard that cannot be written is left out MUST each have a default and be changeable.

## Out of scope

- The interchange formats of other migration tools (Flyway, Liquibase, Atlas): on the roadmap, as exports of these files.
- Writing the files to disk and reading them back: the command line's; the strategy gives and takes files as text.
- Merging two histories that grew apart: the states are addresses, so the divergence is found, and joining them is a plan from one to the other.

## Edge cases

- A plan that starts at a state the history does not end in: an error value naming both, per FR-003.
- A file whose statements were edited and whose manifest entry was edited to match: its identifier no longer matches its content, per FR-002.
- A file taken out of the middle: the chain breaks, per FR-002.
- A step written by a person: a file like any other, its header says so, per FR-001.
- A release package for SQLite: guarded statements cannot be written in its SQL, so an error value, per FR-008.
- A procedure run on a database that is two steps behind: both steps are run in order, per FR-009.
- A procedure run on a database in a state no step starts from: refused, per FR-009.

## Assumptions

- A file's text is UTF-8 with Unix line ends and is hashed as it is.
- The in-database ledger is its own table, made by the installer, and not the external run's.

## Open questions

- **OQ-1**: Whether a frozen history is also kept as a single archive with the manifest's head hash signed, so that what a pipeline deploys can be attested.

## Key entities

- **History** - the frozen files of the steps, the manifest, the repeatable objects and the state.
- **Release package** - the files a DBA runs with a SQL client.
- **In-database runner** - a procedure and a ledger inside the database.

## Success criteria

- **SC-001**: A database is brought to a state by replaying files, and the files are the proof of how.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
