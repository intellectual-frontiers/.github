# Feature Specification: AnyFS SQL: the port

**Spec ID:** 0003-sql-port
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The least a store asks of a driver is a port of statements with parameters and a transaction; the statements are built by the language of SQL, and each driver fits the port by its shape.

## Requirements

- **FR-001**: The port MUST give `query` (the rows a statement returns), `exec`, `transaction` (all or none, the function's throw undoing it) and `close`, with a value of exactly null, a wide integer, a number, a text or bytes, and a row by the name of its column.
- **FR-002**: The builder MUST write a name as the dialect's `identifier` writes it (a keyword quoted), a parameter as the dialect's `placeholder` writes it in the order the parameters were added, and MUST give the bytes of an object to DuckDB as hex (`unhex`, and `hex` on the way back), so that a value is never part of the text.
- **FR-003**: A gate MUST run what goes through it one at a time in the order it came, and two connections to one file in one process MUST share one.
- **FR-004**: A value a driver gives MUST be read into a value of the port: a buffer, an array buffer or an array of bytes into bytes (copied), a boolean into 1 or 0, a date into its ISO text, and an object with no prototype into a row.
- **FR-005**: The port of SQLite MUST open a write as `BEGIN IMMEDIATE` with a busy timeout, open a file in write-ahead mode, and be had from a file opened by the module of the runtime that is running (`bun:sqlite` or `node:sqlite`), typed by the shape both have.
- **FR-006**: The port of a libSQL client (Turso, a libSQL file, a server of sqld) MUST run a transaction through the client's `transaction('write')`, commit it or roll it back, and give blobs that arrive as array buffers as bytes, typed by the client's shape.
- **FR-007**: The port of PGlite MUST run a transaction through PGlite's own, so that a statement outside it waits for it.
- **FR-008**: The port of `pg` MUST take a connection of a pool for each transaction and give it back, or run one transaction at a time on a client, read a `BIGINT` that arrives as text and a buffer as bytes, and never take credentials from a place.
- **FR-009**: The port of DuckDB MUST run a transaction as `BEGIN TRANSACTION` and `COMMIT`, undone with `ROLLBACK`, one at a time on a connection.

## Acceptance scenarios

1. **Given** a statement whose parameter holds a quote, a percent sign and a backslash, **When** it is built, **Then** the text holds only a placeholder, per FR-002.
2. **Given** two transactions on one port, **When** they run at once, **Then** one ends before the other starts, per FR-003.
3. **Given** a transaction that throws, **When** it ends, **Then** none of its changes is there, per FR-001.

## Out of scope

- A pool of connections for SQLite or DuckDB.

## Edge cases

- A driver that gives a number as text is read by the store (FR-004 of 0005).

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
