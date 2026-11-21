# Feature Specification: project cli

**Spec ID:** 0051-project-cli
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The sql and lint project commands, in arcactl.

## Requirements

- **FR-001**: `sql` MUST write the DDL of the models for a dialect, with the triggers of the invariants unless left out.
- **FR-002**: It MUST work for a module of a project's own.
- **FR-003**: `lint` MUST hold models and operations to governance's rules: errors fail, warnings fail only when strict.
- **FR-004**: `generate` MUST write what a generator makes and `list` MUST say what there is. A generator MUST be named by its id or by the short name the usage gives (the id without `sql.generate.`; `mermaid` and `d2` for `erd-mermaid` and `erd-d2`).
- **FR-005**: A command that is wrong MUST be refused with exit code 2 before anything is made.
- **FR-006**: `sql` MUST write row security where its flags ask for it, for PostgreSQL only: `--access` (the grants of `security.access` and the policies of `security.scope`), `--protect ROLE` (the protected layer of 0014-sql-protected-access: the tables in `--schema`, a view of each in `api`, owned by that role), `--seal` (the scope is sealed; its key is `ARCA_SEAL_KEY`, at least 16 characters, and its unlock secret `ARCA_UNLOCK_SECRET`, from the environment or the files `<NAME>_FILE` name, never an argument), `--reach exact|set`, `--wildcard` (with `--reach set`) and `--prefix`; `--protect` and `--seal` imply `--access`. It MUST refuse, with exit code 2, a seal with no key or a short one, `--reach`, `--wildcard` or `--prefix` without access, `--wildcard` without `--reach set`, a role that is not a lower-case name, and a dialect other than PostgreSQL; without these flags it writes what it always wrote. The statements of a seal hold the key, which the database must hold, so they are for a pipe into `psql` and not for a file.

## Out of scope

- A command for a model that is not of the arca family.

## Edge cases

- A dialect without the feature, an empty list, or a name that needs quoting: each is an error value or is quoted, never a silent omission, per FR-001.

## Assumptions

- The engines of the tests are SQLite, DuckDB and PGlite (PostgreSQL), in process.

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
