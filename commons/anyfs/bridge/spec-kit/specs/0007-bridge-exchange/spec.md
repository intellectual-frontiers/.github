# Feature Specification: Bridge exchange

**Spec ID:** 0007-bridge-exchange
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Replicas that merge exchange what they made through a medium: any store that can read, write and list, with nothing more asked of it. A replica publishes its own rows as delta files that are written once and never change, takes the files the others published, and is the same as they are when all have taken all, whatever the order, the repeats and the partitions, with no server and no lock.

## Requirements

- **FR-001**: The exchange MUST do nothing but through two stores, the replica (which has `merge`) and the medium (which has `read`, `write` and `list` and nothing more), and MUST ask the medium for no compare-and-swap and no transaction.
- **FR-002**: A medium MUST hold nothing of an exchange but delta files at `deltas/<replica>/<from>-<to>-<id>.delta`, where the numbers are the first and the last of the replica's own rows the delta holds, in twelve digits, and the identity is the SHA-256 of the delta, and one vector file at `vectors/<replica>.json` for each replica; a path that is not of one of these two forms MUST be ignored by the exchange.
- **FR-003**: A replica MUST publish the rows of its own that it has not published as delta files of at most the rows its options allow, in the order of their numbers, each written with the expectation that nothing is there, so that a file already there (the same file, since its name is its identity) is not an error, and the cursor MUST move only after every file is written.
- **FR-004**: What a replica keeps of its exchange (the number of its last published row, the delta files taken and the delta files put aside) MUST be a cursor on the replica's own side and MUST never be written to the medium; a cursor that is lost MUST cost time and nothing else.
- **FR-005**: A replica MUST take the delta files of the others that its cursor does not hold, in the order of the replica, the first number and the path; each MUST be checked before it is judged (it is a delta, its name is the identity of its text, the directory is the replica that made it, and every row in it is of that replica), and MUST then be judged by the replica's own trust and checks and taken whole or not at all.
- **FR-006**: A file that waits for rows the replica does not hold MUST be counted as deferred and MUST NOT be a failure; a file that is refused for a reason that does not change (it is malformed, too large, has a row that is not its sum or a blob that is not its digest, or is forged) or that fails the checks of FR-005 MUST be put aside and not tried again, and a file refused for a trust that may change or an id from a time that will come MUST be reported and tried again at the next synchronization; a file that cannot be read MUST be reported and left for the next synchronization.
- **FR-007**: A synchronization MUST give a typed report of the files it published, the files it took (applied, duplicates, deferred), the rows and blobs it brought in, the files put aside or refused and why, the findings, and the vector the replica holds; a second synchronization when nothing has changed MUST publish nothing and take nothing.
- **FR-008**: Replicas that synchronize through a medium, whatever the order of their synchronizations, however many times each file is taken and whichever replica is away for a time, MUST end with the same files, the same history and the same siblings as the merge of all of them taken together.
- **FR-009**: A replica MUST be able to publish the vector it holds, a reader MUST be able to read the vectors of the replicas that have published one, and the delta files that every replica of a roster has taken MUST be removable by pruning, only where every replica of the roster has published its vector, and only those files whose rows are all within the horizon of the roster; a file outside the horizon MUST be kept.
- **FR-010**: A delta file MUST be written whole through the medium's own write, so that a synchronization that is interrupted in the middle of publishing leaves files that are complete or not there, and a file that is not complete, if a medium shows one, MUST be put aside by FR-006 and MUST NOT be taken.
- **FR-011**: The checks of FR-005 MUST be held by a test that runs the exchange with its own checks off and with a replica that trusts everyone, and the suite MUST fail for each with a sentence.

## Acceptance scenarios

1. **Given** two replicas that each made rows, **When** each synchronizes through a medium twice, **Then** they hold the same files and the second round changes nothing, per FR-007 and FR-008.
2. **Given** a delta file whose name is not its identity, **When** a replica synchronizes, **Then** the file is put aside and nothing of it is taken, per FR-005.

## Out of scope

- Signing of deltas (M4), a medium that is not a store, and the compaction of the rows of a replica (0010 of anyfs-sql).

## Edge cases

- A delta whose parent is in a file not yet taken: it waits in the replica and is counted as deferred, per FR-006.

## Assumptions

- The replica keeps the deltas that wait for rows it does not hold, as every store that merges does.

## Open questions

- None.

## Key entities

- **Medium** - a store that reads, writes and lists.
- **Cursor** - what a replica keeps of its exchange.
- **Delta file** - a delta written once under the name that says whose and which.

## Success criteria

- **SC-001**: Three replicas that synchronize through a folder, a Git branch and an SSH host end with the same files.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
