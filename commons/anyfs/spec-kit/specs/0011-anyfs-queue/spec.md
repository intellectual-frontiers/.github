# Feature Specification: AnyFS queue

**Spec ID:** 0011-anyfs-queue
**Status:** Draft
**Owner:** if
**Domain:** anyfs

**Input:** A producer that must not lose what it makes (the signals of a device that is offline) needs an ordered, durable queue that survives a restart and is the same on every place bytes live. AnyFS already has the capabilities such a queue is made from (`write` and `read`, `list` in the order of paths, `delete`, `cas`, and on some stores `append`), and no queue. This specification adds a module `queue` that is a queue over any store whose type has the capabilities it needs, and nothing else. It is governed by commons 0041-telemetry-and-reach (audit rows A6 and H4); the port it satisfies is defined in telemetry 0003-telemetry-reach so that Telemetry imports nothing from AnyFS (AnyFS imports Telemetry for its traced layer). **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## The queue

- **FR-001**: The module `@intellectual-frontiers/anyfs/queue` MUST give `openQueue(store, prefix, policy)` over a `Store` whose type has the capabilities `read`, `write`, `list`, `delete` and `cas`, so that a store without one cannot be given (a compile error, as for any capability of AnyFS); `append` MAY be used where the store has it and MUST NOT be required. It is a unit of the logical layer, as `merge` and `docs` are, and imports only the governance of AnyFS and Core. Relies on audit rows: A6, H4.
- **FR-002**: A segment MUST be one object at `<prefix>/<sequence of 20 decimal digits>-<id>.seg`, so that the order of the paths of `list` is the order of the segments; `enqueue` MUST give the next sequence number from the last listing plus one and MUST write the object only where it is absent (`cas` with an expectation of absence), and MUST read the listing again and retry on a conflict, so that two writers never make one number twice. Relies on audit rows: A6.
- **FR-003**: A segment MUST appear whole or not at all: where the store has `rename`, it MUST be written under `<prefix>/.tmp/<id>` and renamed; where it has not, the store's `write` MUST be atomic per its conformance case, and a store that is not (`eventual-listing` or `eventual-merge` consistency) MUST be refused by `openQueue` with a typed problem, because the order of a queue cannot be kept on it. Relies on audit rows: A6.
- **FR-004**: `peek(limit)` MUST give the oldest segments in order with their bytes and revisions; `ack(id)` MUST delete a segment with the revision it was read at and MUST succeed where it is already gone (`delete` is idempotent in AnyFS); a segment MUST never be changed after it is written. Relies on audit rows: A6.
- **FR-005**: The policy (`maxBytes`, `maxAgeMs`, `onFull` of `drop-oldest` or `refuse-new`) MUST be applied by a pure function `evictions(listing, policy, now)` that gives the segments to remove and the reason of each, and by a physical function that applies them; the dropped segments MUST be counted and returned to the caller so that it can report them (telemetry 0003-telemetry-reach FR-004). Relies on audit rows: A6.
- **FR-006**: `stats` MUST be a pure fold over a listing (count, bytes, oldest age) and MUST read no object. Relies on audit rows: A6.
- **FR-007**: A queue MUST be for one writer and one reader; a store with the capability `merge` MUST be refused for a queue. Relies on audit rows: H4.
- **FR-008**: The traced layer MUST trace the operations of a queue as it does any store, and MUST NOT write the bytes of a segment into a span (0004-anyfs-middleware FR-002). Relies on audit rows: A6.
- **FR-009**: The conformance kit of AnyFS MUST gain the cases of a queue (order after a restart, a number never made twice by two writers, `ack` twice, a cap by bytes and by age, a store refused for its consistency) and MUST run on the in-memory and the local stores. Relies on audit rows: A6.

## Acceptance scenarios

1. **Given** three segments and a restart, **When** the queue is opened again, **Then** `peek` gives them in the order written, per FR-002 and FR-004.
2. **Given** two writers on one store, **When** each enqueues, **Then** no sequence number is made twice, per FR-002.
3. **Given** a store with `eventual-merge` consistency, **When** a queue is opened on it, **Then** it is refused, per FR-003 and FR-007.
4. **Given** a cap of two segments and `drop-oldest`, **When** a third is enqueued, **Then** the first is removed and counted, per FR-005.

## Out of scope

- A queue shared by several readers, priorities, delays and dead letters.
- The code of the drain: it is Telemetry's (telemetry 0003-telemetry-reach FR-003).

## Edge cases

- A segment that is written and whose listing lags: the store is `eventual-listing` and is refused, per FR-003.
- An `ack` of a segment that was evicted: it succeeds, per FR-004.

## Assumptions

- The local store's `write` is atomic by a rename inside the store (UNVERIFIED: read from its conformance case, not from its code).

## Open questions

- None.

## Key entities

- **Segment** - one object of a queue, written once.
- **Queue policy** - the cap by bytes and by age and the rule when it is full.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
