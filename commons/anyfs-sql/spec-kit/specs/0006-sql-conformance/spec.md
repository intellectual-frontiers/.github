# Feature Specification: AnyFS SQL: conformance

**Spec ID:** 0006-sql-conformance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The stores pass the laws of AnyFS and of the bridge on the real engines, and on clearly named fakes over a real engine for the drivers that need a server.

## Requirements

- **FR-001**: The store MUST pass every case of the conformance suite of AnyFS that its capabilities name, on SQLite (the module of the runtime and the other one), on PostgreSQL in PGlite and on DuckDB, each a real engine.
- **FR-002**: The port of libSQL MUST pass the same cases through a fake of the client's shape over a real SQLite, and the port of `pg` through a fake of the client's shape over a real PostgreSQL in PGlite, each named as a fake in its test, because the client needs a server this environment does not run.
- **FR-003**: The laws of the bridge MUST hold between the store and the stores of memory and of a folder, and a sync from a folder into the store and back MUST give the folder again.
- **FR-004**: Two processes writing one SQLite file MUST be safe: of two that write no object at one path exactly one wins, and every write of each ends.

## Acceptance scenarios

1. **Given** a fresh database of each engine, **When** the suite runs, **Then** every case passes, per FR-001.
2. **Given** a folder synced into the store and back, **When** the folders are compared, **Then** they are equal, per FR-003.
3. **Given** two processes, **When** both write no object at one path, **Then** one wins, per FR-004.

## Out of scope

- A server of PostgreSQL, of libSQL or of DuckDB over a network.

## Edge cases

- The tests of the drivers' shapes name their fakes (FR-002).

## Assumptions

- The stores are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003); a value is only ever a parameter.

## Open questions

- None.

## Key entities

- **Port**, **Dialect**, **Layout**, **Revision**.

## Success criteria

- **SC-001**: Every behaviour is tested on the real engines in memory or in temporary folders, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
