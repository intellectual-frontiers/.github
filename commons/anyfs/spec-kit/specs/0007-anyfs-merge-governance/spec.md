# Feature Specification: AnyFS: merge, governance

**Spec ID:** 0007-anyfs-merge-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Two databases that hold files must be able to take each other's changes at any time with no conflict. The source of truth of such a store is a set of immutable version rows; this specification gives the identities, the row, the delta, the trust and the closed lists a merge is made of, and nothing that does anything.

## Requirements

- **FR-001**: A replica identity MUST be 32 lower case hexadecimal digits, made only by `parseReplicaId` or from 16 bytes by `replicaIdOfBytes`, which MUST refuse any other text or length; it MUST be random and MUST NOT be reused by a copy of a database (0009-anyfs-merge-physical FR-005).
- **FR-002**: A version identity MUST be a UUID of version 7 as IETF RFC 9562 section 5.7 lays it out, in lower case: 48 bits of milliseconds (`unix_ts_ms`), the version `0111`, `rand_a` of 12 bits that hold the counter (section 6.2, method 1), the variant `10` and `rand_b` of 62 bits; it MUST be made only by `parseVersionId` or by `makeVersionId`; `timeOfId` MUST give back the milliseconds and the counter, and ids MUST sort as text, and as raw bytes, in the order of their time and counter (section 6.11).
- **FR-003**: A version vector MUST be, for each replica, the number of the last row held of that replica with no row of that replica missing before it; the rows of a replica MUST be numbered from 1 with none left out.
- **FR-004**: A version row MUST hold its `id`, its `replica`, its number `seq`, its `path`, its `parent` (the version the writer replaced, `null` for the first of a path), `merged` (the other heads of the path the writer saw and replaced, sorted, each once, never the parent), its `kind` (`put` or `tombstone`), its `blob` (the SHA-256 of the bytes of a put, `null` for a tombstone) and its `sum`; a row MUST be immutable and MUST be the same row as another where their ids and their sums are equal.
- **FR-005**: A delta MUST be a format number, the origin replica, a list of rows and a list of blobs (a digest and base64 bytes) and, where it is signed, a signature; a trust MUST be one of `open`, `allowlist` of replicas (the default, and the replica itself alone) and `signed` with a verifier; the reasons a delta is refused (`trust`, `future-id`, `malformed`, `too-large`, `bad-sum`, `bad-blob`, `forged`), the outcomes of applying one (`applied`, `duplicate`, `deferred`, `refused`) and the kinds of finding (`duplicate-id`, `duplicate-seq`, `bad-sum`, `bad-blob`, `future-id`, `untrusted-replica`, `dangling-parent`, `missing-blob`, `bad-id`) MUST be closed lists.
- **FR-006**: A merge MUST have limits that are values and not hopes: the characters of a path, the bytes of a blob, the rows of a delta and the characters of a delta; a value over a limit MUST be refused with the limit in the sentence.
- **FR-007**: The `sum` of a row MUST be the SHA-256 of the canonical text of every other field, a list in the order `id`, `replica`, `seq`, `path`, `parent`, `merged`, `kind`, `blob`; `makeVersion` MUST refuse a number below 1, an empty path, a put with no blob or a blob that is not a SHA-256, a tombstone with a blob and a `merged` that is unsorted, repeated or holds the parent.
- **FR-008**: `verifyVersion` MUST find a row whose id is not an id, whose replica is not a replica, whose fields are not a row, or whose sum is not the hash of its fields, and the primary key of a row MUST be its id with its sum, so that a row with the id of another and a different sum is another row and is reported, and is not dropped in silence (0008-anyfs-merge-logical FR-014).
- **FR-009**: Consistency MUST have the member `eventual-merge`, which says that a replica holds what it has made and taken and that every two replicas that have taken each other's changes hold the same; a store that merges MUST declare it; and the capability `merge` MUST be one of the optional capabilities.
- **FR-010**: The 62 bits of `rand_b` of an id MUST be random for each id made, from the CSPRNG of the runtime (RFC 9562 sections 5.7, 6.9 and 8) or from bytes the caller gives (a test), and MUST NOT be derived from the replica, from the path, from the time or from any other id, so that the ids of one replica share no tail, an id cannot be linked to its replica by what it holds and an id is not guessed from another (section 8: an id is not a security capability); two ids of one time made by two replicas MUST be two ids by these bits, and a row with the id of another and another sum is found by FR-008.
- **FR-011**: An id MUST hold no replica: the replica of a version is the field `replica` of its row, and every check of trust, every filter by replica, every version vector and every dump MUST use that field and MUST NOT read a replica out of an id; a node id in an identifier is a UUID version 8 (RFC 9562 section 6.4), which is not needed here and is not made.

## Acceptance scenarios

1. **Given** a replica id of 31 digits, **When** it is parsed, **Then** it is refused, per FR-001.
2. **Given** two ids made at the same millisecond and counter by one replica or by two, **When** they are compared, **Then** they are two ids whose last 62 bits differ, per FR-010, and neither holds its replica, per FR-011.
3. **Given** a row whose path was changed after it was made, **When** it is verified, **Then** the sum is found not to be the hash of its fields, per FR-008.
4. **Given** a put with no blob, **When** a row is made of it, **Then** it is refused, per FR-007.

## Out of scope

- Doing anything with the rows: the algebra is 0008-anyfs-merge-logical and the layout of a SQL database 0009-anyfs-merge-physical.
- Strategies per column (counters, sets, bounds, multi-value): an optional module later, as reducers written as code over the rows.

## Edge cases

- A replica that makes ids with its wall clock set back keeps making ids after its last (0008-anyfs-merge-logical FR-003).
- A row with the id of a held row and another sum is kept beside it (FR-008).

## Assumptions

- A replica identity is made from a random source the host gives; the algebra holds none, and an id takes its random bits from the CSPRNG of the runtime (`globalThis.crypto`).

## Open questions

- None.

## Key entities

- **ReplicaId**, **VersionId**, **VersionVector**, **Version**, **Delta**, **Trust**, **MergeOutcome**, **MergeFinding**, **Limits**.

## Success criteria

- **SC-001**: Every requirement is tested with values and with generated values, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
