# Feature Specification: AnyFS: merge, physical layout and conformance

**Spec ID:** 0009-anyfs-merge-physical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A SQL database that holds files must merge with another by replaying a dump of its rows into it: the rows of any number of databases, dumped and replayed in any order, any number of times and overlapping, give the merged file system with no conflict and no merge step. This specification gives the layout laws that make that so, the procedure, the checks a raw import is held to, the identity of a copy, the epoch that lets rows be collected, and the store in memory and the suite every store that merges is held to.

## Requirements

- **FR-001**: The tables of a merge database MUST be of three kinds named in code: the mergeable set (`anyfs_versions` and `anyfs_blobs`), the derived tables (`anyfs_heads`, `anyfs_names`, `anyfs_siblings`, `anyfs_vector`) and the local tables (`anyfs_meta`, `anyfs_trust`, `anyfs_epochs`, `anyfs_cache`); no table MUST be of two kinds.
- **FR-002**: The source of truth MUST be the mergeable set alone, whose rows are immutable; every derived table MUST be made only from it, by a view or by statements that are idempotent and commutative, and MUST never be dumped as a source; a local table MUST never be part of a dump and an import MUST never write it.
- **FR-003**: The version table MUST have the primary key `(id, sum)` with the conflict rule `ON CONFLICT IGNORE` and no row id (`WITHOUT ROWID` in SQLite), with the columns `id`, `sum`, `replica`, `seq`, `path`, `parent`, `merged`, `kind`, `blob`; the blob table MUST have the primary key `sha` with the same rule and the columns `sha`, `bytes`; there MUST be no autoincrement, no dependence on a row id, no unique constraint but the primary key and no foreign key whose check depends on the order of an import.
- **FR-004**: The dump of a database MUST be the data of the mergeable tables alone, `sqlite3 <database> ".dump --data-only anyfs_versions anyfs_blobs"`, which gives one `INSERT` for each row and no schema; a dump MUST be taken into a database by the steps `create-schema`, `replay-in-one-transaction` and `verify`, because a dump replayed into a database with no schema fails, a full dump with its schema cannot be replayed twice, and a replay of many rows is far faster in one transaction; replaying dumps in any order, twice, or overlapping, MUST give the union of their rows, which is the merged file system; and a delta MUST have a dump in this encoding, one `INSERT` for each row and blob of it, so that a SQL dump is a valid delta for a SQL backend.
- **FR-005**: A raw import passes through no check of ours, so a replica MUST hold the checks a raw import is held to in two places: a trigger before the insert MUST refuse a row of a replica that is not in the trust table, and `verify` MUST find the rest (the sum, the id, the digest of a blob, an id from the future, an id on two rows, a parent that is not held and a blob that is not held); the identity of a replica MUST be stored with a fingerprint of the host, and a database opened where the fingerprint is not the stored one is a copy and MUST take a new replica identity and say which it was copied from.
- **FR-006**: Rows MUST be collected only against a roster of replicas that is known to be complete: the horizon of a roster MUST be, for each replica, the least number of its rows that any replica of the roster holds, and MUST be refused where a replica of the roster has not reported what it holds.
- **FR-007**: A row whose number the horizon of an epoch covers MUST be dead unless the epoch retains its key, so that replaying an old dump after a collection does not bring back a file that was deleted and collected, and a row made after the horizon MUST still count.
- **FR-008**: The store in memory that merges MUST have the capabilities of the store in memory (`read`, `write`, `list`, `stat`, `delete`, `cas`, `batch`, `rename`, `history`) and `merge`, MUST declare the consistency `eventual-merge`, MUST name its revision `sha256:` and the digest of the bytes as every store does, and MUST pass every case of the conformance suite of a store.
- **FR-009**: A write MUST be a new row that replaces the heads of its path the replica sees, with the expectation of a revision decided locally against the winner; a write of the bytes the path holds MUST make no row; a delete MUST be a tombstone; a batch MUST be applied to a copy and committed whole; a rename MUST be a put at the new path and a tombstone at the old in one transaction that leaves nothing at the new path to be overwritten; a history MUST list the revisions of the puts of the path, newest first; and the siblings of a path MUST be readable.
- **FR-010**: The store MUST let rows be put in with no check, as a SQL import puts them, and `verify` MUST then report what a check of ours would have refused (FR-005).
- **FR-011**: The conformance suite of merging MUST run against replicas a backend makes, which trust one another or, for the case of refusal, do not, and MUST hold them to: convergence whichever replica took which first, the same files from a chain, a star and all pairs, commutativity of two deltas, idempotence (the second taking is a duplicate and changes nothing), a vector that never goes back, a delete and a write at the same time, siblings that are kept, deferral, refusal of a delta from a replica not trusted, refusal of a row that is not its sum, bytes that are not their digest and an id from the future, a held id with another sum that is kept and reported, and one identity for a delta.
- **FR-012**: The suite MUST be held by a test that runs it against replicas with a deliberate fault each, a delta that drops deletes, a delta that drops blobs, a vector that goes back, a delta that is never a duplicate, a trust that takes anyone, and a row repaired on the way in, and the suite MUST fail for each with a sentence.

## Acceptance scenarios

1. **Given** two SQLite files with some rows in common, **When** the data-only dump of each is replayed, in either order or twice, into a new database with the schema made, **Then** it holds the union of their rows and the files of that union, per FR-004.
2. **Given** a database copied to another place, **When** it is opened there, **Then** it takes a new identity and names the one it was copied from, per FR-005.
3. **Given** a file deleted, collected under an epoch and an old dump of it replayed, **When** the rows are read, **Then** the file stays gone, per FR-007.
4. **Given** replicas whose delta drops tombstones, **When** the suite runs, **Then** the case of a delete and a write at the same time fails with a sentence, per FR-012.

## Out of scope

- The SQL backend that keeps these tables (`anyfs-sql`) and its tests against the real `sqlite3` command: the next task. This specification states the laws that backend must keep and that its dump-union tests rely on.
- The delta exchange through other stores, and the `merge` mode of the bridge.

## Edge cases

- A trust check by a trigger cannot hash a row (SQLite has no SHA-256 function): the hash is checked by `verify` (FR-005).
- A dump replayed into a database whose schema is not made fails: the schema is made first (FR-004).

## Assumptions

- The dump command is the one of `sqlite3` 3.45 and later, which has `.dump --data-only`.

## Open questions

- None.

## Key entities

- **Mergeable table**, **Derived table**, **Local table**, **Epoch**, **Horizon**, **Identity**, **Fingerprint**, **MergeFace**.

## Success criteria

- **SC-001**: Every law is held by a test, and the suite by a test that breaks it on purpose, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
