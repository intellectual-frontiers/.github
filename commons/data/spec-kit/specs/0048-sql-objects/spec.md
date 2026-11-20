# Feature Specification: sql objects

**Spec ID:** 0048-sql-objects
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The enum, domain, sequence, schema and extension DDL, as an extension of the engine.

## Requirements

- **FR-001**: Sequences, enumerated types, domains, schemas and extensions MUST be values that make idempotent DDL (made again, they change nothing) with quoted, case-styled names.
- **FR-002**: On PostgreSQL the objects MUST do what they say: a sequence counts, an enumerated type and a domain refuse what they do not allow, an extension is made.
- **FR-003**: Where a dialect has no such object it MUST be an error value that names it, and where a project carries them nothing MUST be written.
- **FR-004**: An enumerated type MUST be made from a closed code list, and objects MUST come before the tables that use them.

## Out of scope

- Objects of dialects that have none: they are an error value, not a silent omission.

## Edge cases

- A dialect without the feature, an empty list, or a name that needs quoting: each is an error value or is quoted, never a silent omission, per FR-001.

## Assumptions

- The engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL), in process.

## Open questions

- None.

## Key entities

- **Object** - a sequence, an enumerated type, a domain, a schema or an extension, as a value that makes idempotent DDL.

## Success criteria

- **SC-001**: Each requirement above is proved by a test that runs on real engines, and `bun run verify` is green.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
