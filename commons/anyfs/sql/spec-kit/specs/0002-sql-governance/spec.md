# Feature Specification: AnyFS SQL: governance

**Spec ID:** 0002-sql-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialects, the names of the tables, the documented layout and the media types of names are closed lists and smart constructors with no input or output.

## Requirements

- **FR-001**: The dialects MUST be the closed list `sqlite`, `postgres` and `duckdb`, each with the hard limit of one value in that engine, and the largest object a store holds MUST default to 64 MiB and MUST NOT be raised above the limit of the engine.
- **FR-002**: A prefix and a schema MUST be made only by `parseWord` (lower case letters, digits and underscores, starting with a letter, at most 32 characters), a naming MUST default its prefix to `anyfs`, and the table of a role MUST be the prefix, an underscore and the role.
- **FR-003**: The layout MUST be documented as data (`LAYOUT`: each column of each table with what it holds and what it means).
- **FR-004**: The media type of a path MUST be the one its last extension says in a closed table, MUST be none for a name with no extension in the table, and MUST NOT be guessed from the bytes.

## Acceptance scenarios

1. **Given** the text `Fleet-1`, **When** a word is made, **Then** it is refused, per FR-002.
2. **Given** no options, **When** a naming is made, **Then** its versions table is `anyfs_versions`, per FR-002.
3. **Given** `a/b.json`, **When** its media type is asked, **Then** it is `application/json`, per FR-004.

## Out of scope

- Media types from the bytes of an object.

## Edge cases

- A name with a dot first and no other (`.json`) has no extension (FR-004).

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
