# Feature Specification: AnyFS SQL: the store

**Spec ID:** 0005-sql-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A table of a database is a store whose objects are rows with a revision, whose conditional writes are decided by one statement, and whose list is by a range of bytes.

## Requirements

- **FR-001**: `read`, `stat` and `list` MUST give an object's bytes and revision, its size and revision, and the objects below a prefix in the order of the bytes of their paths in pages with a cursor, by a range and never by a pattern, so that a name with a percent sign, an underscore or a quote is an ordinary name.
- **FR-002**: A write MUST be decided by its expectation: no object is made only where none is there (one statement that returns a row only where it inserted), a revision replaces only the object at that revision (one statement that returns a row only where it updated), and any state replaces; two writers who expect the same state MUST NOT both win, and the same bytes written again MUST change nothing.
- **FR-003**: A revision MUST be `sha256:` and the digest of the bytes, made in the library so that it is the same as in every store; a delete MUST succeed where the object is gone and leave a path that has no history, and `history` MUST give the revisions of the puts of a path newest first.
- **FR-004**: A batch MUST be one transaction: every change applies or none, and a change that fails (an expectation that does not hold, an object too large) MUST leave the database as it was.
- **FR-005**: A rename MUST move an object, its history and its search to a path where there is none as one transaction, MUST refuse a move onto an object, and MUST refuse a move to the same path.
- **FR-006**: `search` MUST be a capability only where the engine has the index, MUST find the objects whose bytes are text that holds the words, below a prefix, and MUST treat the words as words: no operator of the engine's query syntax can be written by the caller.
- **FR-007**: An object larger than the store's limit MUST be refused as too large and never cut, bytes that are not the ones their revision names MUST be reported as tampered, and a busy or locked database MUST be reported as unavailable and retryable.
- **FR-008**: Every statement that names a table or a column MUST be in one module, the layout (`layout.ts`), called by name by the store, so that the store holds the rules of an operation and no name of a table, a column or a key, and a different layout of the rows is a replacement of that module and of the migrations and nothing else.

## Acceptance scenarios

1. **Given** two writers who both expect no object at a path, **When** both write, **Then** exactly one wins and the other has the conflict, per FR-002.
2. **Given** a batch whose last change fails, **When** it ends, **Then** the first change is not there, per FR-004.
3. **Given** the names `a%`, `a_b` and `a/%`, **When** they are listed below `a`, **Then** only `a/%` is, since a prefix is a range and not a pattern, per FR-001.
4. **Given** the source of the store, **When** it is read, **Then** it builds no statement and names no table, per FR-008.

## Out of scope

- Ranges, append and streams: whole objects only.

## Edge cases

- A prefix that is the root lists every object (FR-001).

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
