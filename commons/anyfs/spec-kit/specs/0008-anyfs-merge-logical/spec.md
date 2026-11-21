# Feature Specification: AnyFS: merge, logical

**Spec ID:** 0008-anyfs-merge-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a replica holds is a set of version rows and blobs and nothing derived. What a path holds is a view of the rows. Two replicas merge by taking the union of their rows, which is the same in any order, however grouped and however often. This specification gives the laws and the functions that keep them.

## Requirements

- **FR-001**: The state of a replica MUST be its set of rows, keyed by id and sum, and its set of blobs, keyed by digest, and nothing else MUST be part of what two replicas agree on: the indexes it keeps MUST be made again from the rows.
- **FR-002**: The heads of a path MUST be its rows that no other row of the store replaced (as parent or among `merged`); the winner MUST be the head with the greatest id and then the greatest sum; the other heads MUST be its siblings, greatest first; a path whose winner is a tombstone MUST be absent, and a path with no row MUST be absent; the view MUST be a function of the set of rows alone.
- **FR-003**: The clock MUST make each id after the last it made or took and after the wall time, whatever the wall clock does, with the counter of the id ordering ids of one millisecond and carrying into the next millisecond where it is full; taking an id from another replica MUST put the next id made after it.
- **FR-004**: The version vector of a replica MUST be computed from the numbers of the rows it holds, per replica the greatest number n such that rows 1 to n are all held; a row held with a number missing before it MUST NOT advance the vector; `deltaSince` of a vector MUST give the rows whose number is past what the vector holds of their replica and the blobs their puts name.
- **FR-005**: The union of two sets of rows and blobs MUST be commutative, associative and idempotent: replicas that are given the same rows and blobs, in any order and with any rows repeated, MUST hold the same state, the same files and the same siblings.
- **FR-006**: What a replica holds MUST not depend on the order its rows arrived in: a set of rows put together in a shuffled order with repeated rows MUST give the state of the same rows put together once.
- **FR-007**: A delete and a new write of one path made at the same time MUST converge to one file on every replica; two writes that replaced the same version MUST give a winner that is the same on every replica, and the other MUST be kept as a sibling and in the history, and MUST NOT be lost; a write after a tombstone MUST bring the path back.
- **FR-008**: A transaction MUST make one row for each change, each with its own id after the last, numbered one after the last of the replica, replacing the winner as its parent and any other heads in `merged`; a delete of an absent path MUST make no row; a transaction MUST give one delta of its rows and the blobs of its puts, or none where it changed nothing.
- **FR-009**: A store that merges MUST have the capability `merge` with `versionVector`, `deltaSince` and `applyDelta`; `merge` MUST be refused through a view of a prefix and across mounts; a delta that is applied MUST count as an operation that destroys, and a vector and a delta that is asked for as one that reads; and a retried `merge` MUST be safe.
- **FR-010**: `parseDelta` MUST accept only the format, within the limits, and MUST refuse a text that is not JSON, a format that is not read, rows that are not rows, a blob that is not a digest and base64 and a delta of more rows or more text than the limits allow.
- **FR-011**: A delta's identity MUST be the SHA-256 of its canonical text without its signature, with its rows and its blobs in order, so that the same rows have one identity in any order, and a delta written and read again MUST be the same text.
- **FR-012**: A delta MUST be applied only where the trust of the replica allows it: with `allowlist` every replica named in it (its origin and the replicas of its rows) is on the list, with `signed` the verifier accepts its signature for its identity, with `open` always; otherwise it MUST be refused with the reason `trust` and the state MUST not change.
- **FR-013**: A delta whose rows replace a row that is held in neither the delta nor the replica, or whose puts name a blob held in neither, MUST wait: the outcome is `deferred` naming what is missing, the replica keeps it once, and it MUST be applied, with the others that wait, when what it waited for arrives, in any order of arrival.
- **FR-014**: A delta MUST be refused, and the state MUST not change, where an id is further ahead of the wall time than the drift allows (`future-id`), where a row is not its sum (`bad-sum`), where a blob is not the hash of its bytes (`bad-blob`), where the bytes are not base64 or a row is not a row (`malformed`) or where it is larger than the limits (`too-large`); a delta whose rows are all held MUST end `duplicate` and change nothing; a row with the id of a held row and another sum MUST be added beside it and reported as `duplicate-id`, and so MUST a number made twice by one replica as `duplicate-seq`.
- **FR-015**: `verifyState` MUST report, of the rows and blobs a replica holds however they came, each row that is not its sum or whose id is not an id, each row of a replica the trust does not name, each id from the future, each parent or merged id that is not held, each put whose blob is not held, each id and each number on more than one row, and each blob whose bytes are not its digest.

## Acceptance scenarios

1. **Given** three replicas that each write the same path and exchange deltas in different orders, **When** they have all taken all, **Then** they hold the same files and the same siblings, per FR-005 and FR-007.
2. **Given** a delta taken twice, **When** it is taken the second time, **Then** the outcome is `duplicate` and nothing changes, per FR-014.
3. **Given** a delta whose rows replace a row not yet held, **When** it is taken, **Then** it waits, and **When** the row arrives, **Then** both are applied, per FR-013.
4. **Given** a wall clock set back, **When** a replica makes an id, **Then** it is after the last, per FR-003.
5. **Given** a row held with a number missing before it, **When** the vector is read, **Then** it stops before the gap, per FR-004.

## Out of scope

- A transport of deltas, and a store that keeps them: any store can (0009-anyfs-merge-physical FR-004).
- Counters, sets, bounds and multi-value cells: an optional module later, as reducers over the rows.

## Edge cases

- A tombstone that wins by id hides a write made at the same time; the write is a sibling and in the history (FR-007).
- A replica that is a copy of another makes ids with its own identity (0009-anyfs-merge-physical FR-005).

## Assumptions

- The wall clock of a replica is a number a caller gives; the algebra reads none.

## Open questions

- None.

## Key entities

- **MergeState**, **PathView**, **PathOp**, **Delta**, **Applied**, **Finding**.

## Success criteria

- **SC-001**: Each law is held by a test over generated histories of replicas, exchanged in random orders with repeated and shuffled rows, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
