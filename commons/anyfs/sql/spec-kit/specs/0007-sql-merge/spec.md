# Feature Specification: AnyFS SQL: a database that merges

**Spec ID:** 0007-sql-merge
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Each database is a replica whose rows can be merged with those of another by taking the union, so that the store of a database is mergeable by nature.

## Requirements

- **FR-001**: A store on SQLite MUST have the capability `merge` and pass every case of the merge suite of AnyFS (a union in any order, grouping and repetition, a vector that never goes back, refusal of what is not trusted, tampered or from the future).
- **FR-002**: A database MUST hold an identity (a replica and the fingerprint of its file); where it is opened and the fingerprint is not the stored one it MUST take a new identity, keep the old one as trusted and report where it was forked from, and where it is the same it MUST keep its own.
- **FR-003**: A database MUST take rows only from replicas it trusts (itself alone where not told otherwise, an allowlist, or any), MUST refuse a delta from another with a sentence, and MUST take nothing of it.
- **FR-004**: Writes to one path on two replicas MUST leave one winner, the same on both once they have exchanged what they hold (the greatest id), and every other head MUST be kept and be given as a sibling.

## Acceptance scenarios

1. **Given** three replicas, **When** they run the merge suite, **Then** every case passes, per FR-001.
2. **Given** a file that is copied, **When** the copy is opened, **Then** it is a new replica that trusts the old one, per FR-002.
3. **Given** an allowlist of one replica, **When** a delta of another is applied, **Then** it is refused and nothing is taken, per FR-003.
4. **Given** two writes to one path, **When** the replicas exchange deltas, **Then** both give the later as the winner and keep the other as a sibling, per FR-004.

## Out of scope

- Signed deltas and the layouts of PostgreSQL and DuckDB (a later milestone).
- Compaction below a horizon.

## Edge cases

- A delta taken twice changes nothing (FR-001).
- A file copied while it has a write-ahead log not yet folded in is a copy of less than the database (FR-002).

## Assumptions

- The merge algebra is that of `@intellectual-frontiers/anyfs/merge`; this library holds the rows in tables.

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
