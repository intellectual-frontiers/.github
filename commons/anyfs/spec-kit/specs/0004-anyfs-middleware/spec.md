# Feature Specification: AnyFS: layers of a store

**Spec ID:** 0004-anyfs-middleware
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A layer is a function from a store to a store, written over the handler of operations, so that tracing, auditing, retrying, rate limiting and caching are made once and compose, each saying in its type which capabilities it keeps. The clock, the sleep and the tracer are ports, so that every layer is pure and tests run it with a clock they hold.

## Requirements

- **FR-001**: A layer MUST be a function of a store to a store; `compose` MUST apply layers in the order given, and the capabilities of the result MUST be those the layers say they keep, in the type and in the set of the store.
- **FR-002**: `traced` MUST make one span for each operation through a tracer port, named for the operation, with the path, the kind of outcome and the size of the bytes, and MUST NOT give a span any bytes or any text of a file; it MUST keep every capability of its argument.
- **FR-003**: `audited` MUST make one record for each operation, a refused one included, with the instant, the operation, the path, the outcome kind and the size, and give it to a sink; where the sink fails the result MUST be `unavailable` and the operation's effect MUST stand, so that a gap in the audit is never silent; it MUST keep every capability.
- **FR-004**: `retrying` MUST repeat an operation that is safe to repeat (`read`, `stat`, `list`, `history`, `rangeRead`, and a `write` or `delete` with the expectation `any`) when it ends `unavailable` with a retry possible, at most the attempts of its policy, waiting by capped exponential backoff through the sleep port; it MUST NOT repeat a conflict, a refusal or any other operation.
- **FR-005**: `rateLimited` MUST allow at most the operations of its limit in each interval of its clock, by a token bucket, waiting through the sleep port and never failing an operation for the limit.
- **FR-006**: `cached` MUST read through a cache store: a read MUST ask the origin for the revision of the path and give the cached bytes where the revision is the one cached, and fetch and keep the bytes otherwise; a write or a delete through it MUST go to the origin and drop the cached copy; its result MUST have the capabilities of its origin less `batch`, `rename`, `append`, `rangeRead` and `search`, in the type and in the set.

## Acceptance scenarios

1. **Given** a store traced with a recording tracer, **When** a read of a missing path is made, **Then** one span names `read` and the path, and its outcome is `missing`, per FR-002.
2. **Given** a sink that fails, **When** a write is made through `audited`, **Then** the result is `unavailable` and the bytes were written, per FR-003.
3. **Given** a store that is unavailable twice and then answers, **When** a read is made through `retrying` with three attempts, **Then** it succeeds after two waits, per FR-004.
4. **Given** a limit of two operations in an interval, **When** three are made at once, **Then** the third waits for the next interval, per FR-005.
5. **Given** a cached store, **When** a path is read twice and its bytes are changed in the origin between the reads, **Then** the second read gives the new bytes, per FR-006.

## Out of scope

- Layers that need keys or several places (`encrypted`, `signed`, `mirror`, `overlay`): later specifications.

## Edge cases

- A cache that holds the bytes of an old revision is never trusted: the revision of the origin decides (FR-006).

## Assumptions

- The tracer, the sink, the clock and the sleep are given by the caller.

## Open questions

- None.

## Key entities

- **Layer**, **Tracer**, **AuditRecord**, **Clock**.

## Success criteria

- **SC-001**: Every layer is tested with a clock the test holds and no real time passes.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
