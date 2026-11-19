# Feature Specification: arcactl

**Spec ID:** 0046-arcactl
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The arca models are tables, invariants and operations in a PostgreSQL database that others can change. `arcactl` is the command that helps initialise, manage and maintain them. It is for the arca family of models and does not pretend to serve others. This first part is `doctor`: a read-only look at a database against the models a configuration names, which says what is as it should be, what has drifted and what has been weakened, in a form a person or a pipeline reads. `init` and `shell` follow.

## Requirements

- **FR-001**: `arcactl` MUST run on one PostgreSQL connection: Bun's own client (`Bun.SQL`) on Bun, which needs no dependency, and `pg`, an optional peer dependency loaded only on Node, elsewhere; with no URL the driver MUST read libpq's own environment, and a password MUST come from libpq's files or `ARCA_DATABASE_URL` and never from an option of its own; a failure to connect MUST be said, with exit code 2.
- **FR-002**: The configuration (`arca.config.ts`, `defineArca`) MUST be typed data with defaults and no secret; it MUST name models of the arca family (the party, tenancy and identity models) or the issues model, bring what they require with them, and refuse a model, a schema name or an empty list that is not valid.
- **FR-003**: `doctor` MUST be read-only (it may set the session's search path, and run a query in a transaction that it rolls back, and nothing else), MUST give a result for each check of pass, warn, fail or could not be checked, with what it found and what to do, in text or JSON; its exit code MUST be 0 where every check passed and 1 where any did not, and 2 for a command that is wrong or a database that cannot be reached; a check that lacks a privilege MUST say it could not check and MUST NOT pass.
- **FR-004**: `doctor` MUST say that a database has not been initialised for the models (nothing in the schema), find a table of the models that is missing, and not compare what is not there.
- **FR-005**: `doctor` MUST compare the database with the models and say each change it would take to bring it to them (drift: a table or column that is missing or stray, a changed default), say what is held outside the model where the project holds it, and read the ledger and find an entry changed or taken out.
- **FR-006**: `doctor` MUST find that the invariants of the models (0043-sql-invariants) are weakened: a trigger missing or disabled, and the guard's event triggers missing or disabled; and MUST NOT ask for what the configuration says it does not want.
- **FR-007**: `doctor` MUST find a seal that an application role could use (the key's table or the mark function open to every role, the seal's guard missing), row security off or not forced on a scoped table, and a seal that is wanted and not there.
- **FR-008**: `doctor` MUST verify the audit chain by recomputing it, so that an event whose hash is not that of its fields is found, and MUST say there is no trail where the models have none.
- **FR-009**: `arcactl` MUST NOT print a password: it MUST take it out of every URL and setting in what it says, including the error of a driver that quotes the URL, and out of any secret it was given.
- **FR-010**: `doctor` MUST say what PostgreSQL enforces in the database for the invariants of the models and what the application's runtime enforces.

## Out of scope

- `init`, `shell` and a `--fix` mode: later parts; `doctor` writes nothing.
- Roles and grants against what the models say each role may do, and the issues model's synchronisation: checks to come.
- A server over the network in this library's tests: they run on PGlite, which is in process. The Bun and `pg` clients are reached only to see that a failure to connect is said; they are not shown against a server here.

## Edge cases

- A database made by DDL and not through the lifecycle: it has no ledger, which `doctor` warns of, per FR-005.
- A role that cannot read a catalog: the check says it could not be made and does not pass, per FR-003.
- A model with no invariants, no audit trail or no scoped tables: its checks say there is nothing to check, per FR-006 to FR-008.
- A URL given as an argument shows in the process list: `ARCA_DATABASE_URL` is preferred, and the password is never printed either way, per FR-009.

## Assumptions

- The tables are in one schema, `arca` by default.
- PGlite stands for PostgreSQL in the tests, as it does in the rest of this library.

## Open questions

- **OQ-1**: Whether `doctor` should read libpq's service file itself to say which connection it used; now it says only what the server reports.

## Key entities

- **Check** - one question `doctor` asks, with an identifier, a result and a next step.
- **Report** - the results of a run and the exit code.

## Success criteria

- **SC-001**: A database with an invariant dropped, a guard disabled, a table missing, a ledger entry changed or an audit event altered is reported as failing by a command a pipeline can run, and one that is as the models say is reported as passing.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
