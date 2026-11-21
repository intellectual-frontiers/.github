# Feature Specification: AnyFS Query: safety

**Spec ID:** 0004-query-safety
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A query over a remote place can cost a great deal and can read what it should not. A place is open to what its owner says, a run has a budget, and what is cut short says so.

## Requirements

- **FR-001**: Each place MUST be given a consent: `none`, `metadata` (what a listing says) or `content` (the objects too); a query that needs more than its place is given MUST be refused as a problem that names the place, what is needed and what is given, before a store is called; `places` MUST need none.
- **FR-002**: A run MUST have a budget of five whole limits of at least 1: objects listed, objects read, bytes read, rows given and milliseconds; a run that reaches one MUST end with the rows it has and name the limit (`listed`, `read`, `bytes`, `rows` or `deadline`) in its result, and a run that does not MUST say nothing was cut; a budget with a limit that is not a whole number of at least 1 MUST be a problem.
- **FR-003**: An object the context marks as redacted MUST NOT be read, and its text MUST be no value and its `redacted` true.
- **FR-004**: A run MUST ask a store for `list`, `stat`, `history` and `read` and no other operation, and a statement that changes anything MUST be refused before a store is asked (0002-query-language FR-004).
- **FR-005**: A table whose store lacks the capability it needs (`list` for `files`, `list` and `read` for `content`, `history` for `revisions`) MUST be a problem that names the table, the place and the capability.
- **FR-006**: A context MAY give an index of listings; a run MUST ask it for a listing of the prefix it would list, MUST list the store where the index has nothing, and MUST read objects only from the store.
- **FR-007**: Bytes that are not UTF-8 MUST have no text and `is_text` false, and a filter on `is_text` MUST leave out the objects that have none.

## Acceptance scenarios

1. **Given** a place open to `metadata`, **When** a query on `content` is run, **Then** it is refused and no store is called, per FR-001.
2. **Given** a budget of four objects listed, **When** a query lists a store of nine, **Then** four rows come back and the result says `listed`, per FR-002.
3. **Given** every `machines/` object redacted, **When** a query reads the content of the store, **Then** none of them is read, per FR-003.
4. **Given** a counting store, **When** many queries are run, including a `DELETE`, **Then** no operation but the four was asked, per FR-004.
5. **Given** a store attenuated to `read` and `stat`, **When** `files` is run, **Then** the problem names `list`, per FR-005.
6. **Given** an index that knows a prefix, **When** a query lists it, **Then** the store is not listed, per FR-006.
7. **Given** an object of bytes `ff fe 00 c3 28`, **When** its content is selected, **Then** the text is no value, per FR-007.

## Out of scope

- The decision of what is redacted or what consent a place has: a context gives them.
- Encrypting or decrypting: a layer of the store does that, and a query reads what the store gives.

## Edge cases

- A listing that is longer than the budget ends at the limit, and the result says `listed` and not that the answer is whole (FR-002).

## Assumptions

- The consent of a place and the objects that are redacted are given by the owner of the context; the library asks and does not decide (FR-001, FR-003).

## Open questions

- None.

## Key entities

- **Consent**, **Budget**, **Truncation**, **Statistics**, **Problem**, **Index**.

## Success criteria

- **SC-001**: Every limit and every consent is tested to stop a run before the cost it guards, and the operations a run makes are counted.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
