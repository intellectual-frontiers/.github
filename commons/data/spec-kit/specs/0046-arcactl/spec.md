# Feature Specification: arcactl

**Spec ID:** 0046-arcactl
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The arca models are tables, invariants and operations in a PostgreSQL database that others can change. `arcactl` is the command that helps initialise, manage and maintain them. It is for the arca family of models and does not pretend to serve others. This first part is `doctor`: a read-only look at a database against the models a configuration names, which says what is as it should be, what has drifted and what has been weakened, in a form a person or a pipeline reads. `init` and `shell` follow.

## Requirements

- **FR-001**: `arcactl` MUST run on one PostgreSQL connection: Bun's own client (`Bun.SQL`) on Bun, which needs no dependency, and `pg`, an optional peer dependency loaded only on Node, elsewhere; with no URL the driver MUST read libpq's own environment, and a password MUST come from libpq's files or `ARCA_DATABASE_URL` and never from an option of its own; a failure to connect MUST be said, with exit code 2; and either client MUST be chosen by `--driver` or `ARCA_DRIVER` (`pg` can be used on Bun too), and each MUST connect to a server over a socket and give the report that an in-process database gives.
- **FR-002**: The configuration (`arca.config.ts`, `defineArca`) MUST be typed data with defaults and no secret; it MUST name models of the arca family (the party, tenancy and identity models) or the issues model, bring what they require with them, and refuse a model, a schema name or an empty list that is not valid.
- **FR-003**: `doctor` MUST be read-only (it may set the session's search path, and run a query in a transaction that it rolls back, and nothing else), MUST give a result for each check of pass, warn, fail or could not be checked, with what it found and what to do, in text or JSON; its exit code MUST be 0 where every check passed and 1 where any did not, and 2 for a command that is wrong or a database that cannot be reached; a check that lacks a privilege MUST say it could not check and MUST NOT pass.
- **FR-004**: `doctor` MUST say that a database has not been initialised for the models (nothing in the schema), find a table of the models that is missing, and not compare what is not there.
- **FR-005**: `doctor` MUST compare the database with the models and say each change it would take to bring it to them (drift: a table or column that is missing or stray, a changed default), say what is held outside the model where the project holds it, and read the ledger and find an entry changed or taken out.
- **FR-006**: `doctor` MUST find that the invariants of the models (0043-sql-invariants) are weakened: a trigger missing or disabled, and the guard's event triggers missing or disabled; and MUST NOT ask for what the configuration says it does not want.
- **FR-007**: `doctor` MUST find a seal that an application role could use (the key's table or the mark function open to every role, the seal's guard missing), row security off or not forced on a scoped table, and a seal that is wanted and not there.
- **FR-008**: `doctor` MUST verify the audit chain by recomputing it, so that an event whose hash is not that of its fields is found, and MUST say there is no trail where the models have none.
- **FR-009**: `arcactl` MUST NOT print a password: it MUST take it out of every URL and setting in what it says, including the error of a driver that quotes the URL, and out of any secret it was given.
- **FR-010**: `doctor` MUST say what PostgreSQL enforces in the database for the invariants of the models and what the application's runtime enforces.
- **FR-011**: The package `@intellectual-frontiers/arcactl` MUST be a build target of this library and not a folder of its own: `tools/pack.ts` MUST bundle the command into one file for Node and Bun that holds none of the test tools and nothing of the machine it was built on, write the manifest that is published (the version of this library, the file as its `bin`, `pg` as an optional dependency, a public access, nothing of the library's own scripts or dependencies) and pack it; the `package.json` of this folder MUST stay private; and the tarball MUST install into an empty project and its command run there on Bun with Bun's own client and on Node with `pg`, give the report the sources give, and say what to install where `pg` is missing.
- **FR-012**: `arcactl scope` MUST print the statement that sets a sealed scope (0009-sql-features FR-019, FR-020) for the session, or with `--local` for the transaction: for the tenants named by `--tenant a,b`, for a tenant and every tenant beneath it by `--subtree T` (read from the tenant table by its `parent` relationship, the one form that connects, and an unknown tenant exits 1), or for every tenant by `--all`. It MUST take the key from `ARCA_SEAL_KEY` (or the file `ARCA_SEAL_KEY_FILE` names) and never from an argument, MUST print a mark and never the key, and MUST refuse, with exit code 2, no key, none or more than one of the three, a value that is empty, has a comma or is `*`, and a name or prefix that is not a lower-case name.
- **FR-013**: `doctor` MUST take a module of the project's own (`--module FILE`, as `sql` does; not with `--models` or `--config`) and hold its tables as it holds those of the arca models: present, without drift, and, with `--seal`, with row security forced, the seal in place and closed to application roles, naming what it checks "the project's models".
- **FR-014**: With no URL, `arcactl` MUST connect as `psql` does: in libpq's order: from the service that `PGSERVICE` names in `pg_service.conf` (`PGSERVICEFILE` where set), which wins over libpq's variables as libpq has it, then from those variables, and the password from the service, then `PGPASSWORD`, then `.pgpass` (`PGPASSFILE` where set; a `*` field matches anything), so that what `arcactl init` writes is what `doctor` and `scope` use. Where no host is known, or the host is a socket, it MUST leave the driver to read the environment as before; a service that is not in the file MUST be as no target. A password found in a file MUST be in no error and in no account of where the target came from.

## Out of scope

- `init` and a `--fix` mode: later parts; `doctor` writes nothing.
- The publishing itself: the generated workflow of this library (`data-publish.auto.yml`, from a tag `data-v<version>`) sends the tarball to npm and the GitHub package registry; the owner of the npm scope sets up trusted publishing once.
- Roles and grants against what the models say each role may do, and the issues model's synchronisation: checks to come.
- A PostgreSQL server of the full product in this library's tests: they run on PGlite, in process and served on a socket (which has one session at a time, no authentication of its own, and ignores the `options` startup parameter). A server that asks for a password is a small one of the tests' own, which shows what a client sends.

## Edge cases

- A database made by DDL and not through the lifecycle: it has no ledger, which `doctor` warns of, per FR-005.
- A role that cannot read a catalog: the check says it could not be made and does not pass, per FR-003.
- A model with no invariants, no audit trail or no scoped tables: its checks say there is nothing to check, per FR-006 to FR-008.
- A URL given as an argument shows in the process list: `ARCA_DATABASE_URL` is preferred, and the password is never printed either way, per FR-009.

## Assumptions

- The tables are in one schema, `arca` by default.
- PGlite stands for PostgreSQL in the tests, as it does in the rest of this library, in process and on a socket.

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
