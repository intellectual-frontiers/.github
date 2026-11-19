# Feature Specification: project cli

**Spec ID:** 0051-project-cli
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The sql and lint project commands of SQL Aide, in arcactl.

## Requirements

- **FR-001**: `sql` MUST write the DDL of the models for a dialect, with the triggers of the invariants unless left out.
- **FR-002**: It MUST work for a module of a project's own.
- **FR-003**: `lint` MUST hold models and operations to governance's rules: errors fail, warnings fail only when strict.
- **FR-004**: `generate` MUST write what a generator makes and `list` MUST say what there is.
- **FR-005**: A command that is wrong MUST be refused with exit code 2 before anything is made.

## Out of scope

- A command for a model that is not of the arca family.

## Edge cases

- A dialect without the feature, an empty list, or a name that needs quoting: each is an error value or is quoted, never a silent omission, per FR-001.

## Assumptions

- Ported from SQL Aide, which this library replaces; the engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL), in process.

## Open questions

- None.

## Key entities

- **Command** - `sql`, `lint`, `generate` or `list` of `arcactl`, run on the models of a project.

## Success criteria

- **SC-001**: Each requirement above is proved by a test that runs on real engines, and `bun run verify` is green.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
