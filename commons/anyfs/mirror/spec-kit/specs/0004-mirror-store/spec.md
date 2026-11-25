# Feature Specification: AnyFS Mirror: the store

**Spec ID:** 0004-mirror-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A store that keeps a primary and one or more secondaries, of any backends, in step: the primary answers every read and decides every write, the secondaries follow, and a program can see where they differ and make them the same. A Git branch and a SQLite file are the first pair, and the proof that the mirror works is the file holding what the branch holds.

## Requirements

- **FR-001**: A mirror MUST be made from a primary store and at least one secondary store, each of the core capabilities (read, write, list, stat, delete), and MUST be refused, with the reason, where there is no secondary.
- **FR-002**: Every store of a mirror MUST have its own id, and a mirror MUST be refused, naming the id, where one is given twice, and where a secondary does not tell paths apart by case and the primary does.
- **FR-003**: A write, a delete, a rename, a batch or an append through the mirror MUST be made by the primary and then followed by every secondary at each path it changed, so that the secondary holds the object the primary holds, at the same revision, or no object where the primary has none.
- **FR-004**: Every read, stat, list, history, range read and search through the mirror MUST be answered by the primary alone, and the expectation of a write MUST be decided by the primary: a write the primary refuses or finds in conflict MUST change no secondary.
- **FR-005**: A secondary that does not take a change MUST NOT stop the primary having it: by the policy `record` the mirror answers as the primary did, by `report` it answers that the primary took the change and the secondary did not, and in both it MUST record the path as lagging until a change or a reconcile makes the secondary hold it.
- **FR-006**: `verify` MUST give the drift of each secondary from the primary by the revision of every object, after the changes in flight are done, and `reconcile` MUST copy to each secondary what it lacks or holds at another revision, remove what the primary does not hold, and leave the drift empty and the lag cleared where it can, reporting each path it could not make the same.
- **FR-007**: The capabilities of a mirror MUST be those of its primary but a merge, a watch and a lock, so that the type of the mirror says what it can do, and the mirror of a store that merges MUST have no merge.
- **FR-008**: Changes through a mirror MUST be followed in the order the primary took them, whatever callers do at once.
- **FR-009**: An object that one store of the mirror would refuse for its size MUST be refused before the primary is touched, and the traits of the mirror MUST say the narrowest of its stores.
- **FR-010**: Any backend of AnyFS MUST be usable as a primary or as a secondary, in any order, with no change to the library: it is held by the conformance of 0005-mirror-conformance with a Git branch, a SQLite file, memory and a folder.

## Acceptance scenarios

1. **Given** a Git branch and a SQLite file, **When** a file is written through the mirror, **Then** the file holds it at the same revision and a new connection to the file reads it, per FR-003.
2. **Given** an object the SQLite file was changed behind the mirror's back, **When** `verify` runs, **Then** its path is in the drift, and **When** `reconcile` runs, **Then** the file is the same as the branch, per FR-006.
3. **Given** a secondary that is down, **When** a write is made, **Then** the primary has it and the path is lagging, and a later write the secondary takes clears the lag, per FR-005.
4. **Given** a write whose expectation does not hold, **When** it is made, **Then** the primary refuses it and no secondary changes, per FR-004.

## Out of scope

- Merging two replicas, and recovering a primary from a secondary while the primary is alive: use `reconcile` with the stores the other way round.
- Writers on more than one computer: they meet in the primary, and a secondary may lag until a reconcile.

## Edge cases

- A batch the primary took in one change is followed by a secondary path by path: a failure halfway leaves some of it, records the rest as lagging, and a reconcile makes it whole (FR-005, FR-006).
- A secondary opened empty on a primary that holds objects is made whole by one reconcile (FR-006).

## Assumptions

- One process writes through a mirror at a time; every store gives an object the revision `sha256:` and the digest of its bytes, so a drift is a comparison of texts.

## Open questions

- None.

## Key entities

- **Mirror**, **Primary**, **Secondary**, **Lag**, **Drift**.

## Success criteria

- **SC-001**: After any run of writes, deletes, renames and batches through a mirror, `verify` gives an empty drift for every secondary that took them.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
