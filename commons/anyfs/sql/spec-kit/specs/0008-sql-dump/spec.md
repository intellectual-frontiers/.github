# Feature Specification: AnyFS SQL: the dump and the union of dumps

**Spec ID:** 0008-sql-dump
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The mergeable tables of any number of database files are dumped as plain inserts by the real `sqlite3` command, replayed into a new database, and the files are merged.

## Requirements

- **FR-001**: The data of the two mergeable tables MUST be what a dump carries (`sqlite3 FILE ".dump --data-only TABLES"`, one `INSERT` for each row and no schema), the library MUST write the same text (`dumpText`) and the replay of the dumps of two to five databases into a new database MUST give the state the databases reach by exchanging deltas, whatever the order of the dumps.
- **FR-002**: A replay MUST be idempotent and independent of order: replaying a dump again, and dumps that overlap, MUST add no row and no blob and MUST leave the state as it was.
- **FR-003**: A dump MUST be readable by the real `sqlite3` into a database made by the library with no code of the library involved, and MUST give back the files, their bytes (text of any language, binary, empty) and a database that verifies.
- **FR-004**: A dump that is tampered with MUST be found by the check of the rows, a dump of a replica the database does not trust MUST be refused (by the library and by the real `sqlite3` through the trigger) with the whole replay undone, and a text that is anything but plain inserts of literals into the two tables MUST be refused and change nothing.
- **FR-005**: A dump made before a delete and replayed after it MUST bring nothing back, and a replay MUST never write a table that is local to the database (its facts, its trust, its epochs, its caches).
- **FR-006**: Ten thousand files MUST be dumped and merged in seconds, and a folder of dumps named by replica that replicas write and read, and the merge of sorted dumps by Git with the `union` driver, MUST each give the union.

## Acceptance scenarios

1. **Given** two databases with a file each, **When** their dumps are replayed into a new database, **Then** it holds both, per FR-001.
2. **Given** the same dump replayed again, **When** it ends, **Then** nothing is new, per FR-002.
3. **Given** a dump of an untrusted replica, **When** it is replayed, **Then** it is refused and nothing is taken, per FR-004.
4. **Given** two Git branches that each add rows to a sorted dump, **When** they merge, **Then** the merged dump is the union, per FR-006.

## Out of scope

- A transport for dumps through other stores of AnyFS (a later milestone).
- Compaction below a horizon.

## Edge cases

- The real `sqlite3` writes a comment at the head of a dump; it is skipped (FR-001).
- A file read while its write-ahead log is not folded in is dumped as it is on disk; the tests fold it in first (FR-001).

## Assumptions

- The command `sqlite3` is installed; the tests that use it say so in their names.

## Open questions

- None.

## Key entities

- **Version row**, **Blob**, **Replica**, **Delta**, **Dump**.

## Success criteria

- **SC-001**: Every behaviour is tested on the real engine and, where a program of the system is used (`sqlite3`, `git`), on the real program, in temporary folders, with no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
