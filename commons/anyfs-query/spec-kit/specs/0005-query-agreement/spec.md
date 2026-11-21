# Feature Specification: AnyFS Query: agreement

**Spec ID:** 0005-query-agreement
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A query is the same question of any store, so the same files in a store in memory, in a folder and in a branch of Git give the same answer.

## Requirements

- **FR-001**: The same queries over a store in memory, a store of a folder and a store of a Git branch holding the same files MUST give the same rows, the same number of objects read and the same ending.
- **FR-002**: Objects whose names hold spaces, quotes, `%`, `_`, `;`, `--`, glob brackets, shell syntax or non-ASCII characters MUST be rows like any other, a query that names one MUST find it, and a condition made of text in a query MUST NOT widen what it matches.
- **FR-003**: A listing of several pages MUST be read to its end with one call for each page, and a query that stops early MUST not read the pages it does not need.

## Acceptance scenarios

1. **Given** ten queries and three stores of the same files, **When** each is run on each, **Then** the rows are equal, per FR-001.
2. **Given** an object `quote's/it's.txt`, **When** `path = 'quote''s/it''s.txt'` is run, **Then** it is found, and `path = 'x'' OR ''1''=''1'` finds nothing, per FR-002.
3. **Given** 2500 objects, **When** a query lists them, **Then** three calls were made, and `LIMIT 3` makes one, per FR-003.

## Out of scope

- Stores that are not in this repository: each backend runs these queries in its own tests.

## Edge cases

- The modification time differs between stores, since each has its own clock, so the comparison leaves it out (FR-001).

## Assumptions

- Each backend is held to the conformance of AnyFS; this specification holds the query language to the backends (FR-001).

## Open questions

- None.

## Key entities

- **Store**, **Place**, **Row**.

## Success criteria

- **SC-001**: Every comparison runs over the real stores of this repository, a branch of Git included, with no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
