# Feature Specification: SQL compaction

**Spec ID:** 0009-sql-compaction
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Rows are only ever added, so a database grows with every write and delete; they can be collected only when every replica that matters holds them, which is known only from what each has said it holds. The collection is written down as an epoch that keeps an old dump from raising what was collected, that can be published and adopted by another replica, and a replica that will not return is retired.

## Requirements

- **FR-001**: A port of an engine that keeps a log (SQLite in write-ahead mode) MUST be able to fold the log into the file (`checkpoint`), the store MUST offer it and say `done` or `not-needed`, and closing the port MUST do it, so that a file copied after either is the whole database.
- **FR-002**: Rows MUST be collected only against a roster of replicas that is known to be complete: the replica that collects MUST be on the roster, every other replica of the roster MUST have reported what it holds (the refusal names who has not), and the horizon MUST be for each replica the least number of its rows that any replica of the roster holds.
- **FR-003**: A row whose number the horizon covers MUST be collected unless it is a head of its path (what the files are made of), except that a path whose only head is a delete MUST be kept by nothing; the epoch MUST be written down with its horizon, its roster, the heads it keeps and the greatest id it collected, and a SQL import that brings back a row the epoch collected, whether by the library or by the real `sqlite3`, MUST write nothing, so that a file deleted and collected stays gone.
- **FR-004**: What an epoch covers MUST count as held: the version vector MUST start from the horizon of each replica and walk the rows above it, a row made after the horizon MUST still count, and a replica that has not collected MUST still exchange with one that has.
- **FR-005**: A delta whose parent is a row the epoch collected (its id is not above the greatest id collected) MUST NOT wait for it, and a check of the rows MUST NOT report such a parent as missing.
- **FR-006**: An epoch MUST be a record that can be published once to a medium (named by its identity, so that it is one file wherever it is published) and adopted by another replica that takes changes from its proposer and holds every row it covers (or, for a database made from a dump of a collected one, every row it keeps); a replica that is not caught up MUST wait, one whose proposer it does not trust MUST refuse, and adopting twice MUST do nothing.
- **FR-007**: A replica that will not return MUST be retired by an explicit call that needs a reason and is never of the replica itself: it MUST no longer be trusted (its rows are refused, in a delta and by the trigger of an import), and who retired it, when and why MUST be written down and readable.
- **FR-008**: A collected database MUST be dumped and replayed into a new one with the same files, a second collection with a newer horizon MUST collect the rows the first kept, and the epoch (a local table) MUST never be part of a dump.

## Acceptance scenarios

1. **Given** a file deleted and collected under an epoch and an old dump of it replayed by the real `sqlite3`, **When** the files are read, **Then** the file stays gone, per FR-003.
2. **Given** a roster in which a replica has not reported, **When** a collection is asked for, **Then** it is refused and names that replica, per FR-002.

## Out of scope

- A collection that runs by a timer, and the collection of the rows of a replica that is not on the roster (a retired replica's rows stay).

## Edge cases

- A replica that took an epoch and has rows made after it: they count, per FR-004.
- A database made from a dump of a collected one: it is caught up for what the epoch keeps, per FR-006.

## Assumptions

- The replica that collects has the report of each replica of the roster from the medium (`vectors/<replica>.json`) or from the replica itself.

## Open questions

- None.

## Key entities

- **Epoch** - how far rows are collected, against which roster, what is kept and the greatest id collected.
- **Horizon** - for each replica, the least number of its rows any replica of the roster holds.

## Success criteria

- **SC-001**: A fleet database that deleted a file, collected it and was then given an old dump does not bring the file back.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
