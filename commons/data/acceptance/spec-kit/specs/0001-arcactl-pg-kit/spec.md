# Feature Specification: arcactl-pg-kit

**Spec ID:** 0001-arcactl-pg-kit
**Status:** Active
**Owner:** if
**Domain:** data (acceptance)

**Input:** The first kit of the acceptance specifications of this library (a UAT: testing by a person, for the experience beyond the code; these specifications are synthetic and are kept apart from the library's own, which they may cite and which never cite them). A person who has not built `commons/data` has to be able to test it as an application team would, on a PostgreSQL they already have: find the database, set it up with `arcactl`, load a business-to-business multi-tenant schema with row-level security, connect with `psql` and DBeaver as roles that own nothing, and see that a caller sees only its tenant's rows, that a reseller reaches its tenants and a platform operator every tenant, and that nobody can switch the protection off. The kit holds the example, the roles, the seed, the scenarios and a README that gives every command; its own checks run it on a PostgreSQL in process, and on a real server where one is found, so it does not go stale. It starts no database and uses no container: the database is the person's.

## Requirements

- **FR-001**: The kit MUST be the folder `acceptance/arcactl-pg/` of this library, with `README.md`, `FINDINGS.md`, `models/crm.ts`, `sql/roles.sql`, `sql/reset.sql`, `seed/`, `scenarios/`, `dbeaver/`, `bin/` and `checks/`. It MUST start no database and use no container: its README MUST say that PostgreSQL exists somewhere and teach how to find it and set up the workstation for it with `arcactl init` and `arcactl doctor --scope workstation`. Its secrets (a password for the UAT's roles, the key of the seal and its unlock secret) MUST be made once into `acceptance/arcactl-pg/.env.uat`, which MUST NOT be committed, and the folder MUST NOT be in the packed library.
- **FR-002**: The example application, the module `models/crm.ts`, MUST be a business-to-business product's customer data: customer accounts, contacts, support tickets and their comments, each with a `tenantId` that carries `security.scope` named `tenant`, and each naming the roles that read and write it (`crm_reader`, `crm_writer`, `crm_support`). Its default export MUST be what `arcactl --module` reads: the party and tenancy models of arca, from which the platform's tenants come, and this module. It MUST pass `arcactl lint` with no error.
- **FR-003**: `sql/roles.sql` MUST make, and may be run again, the role `crm_owner` that owns the schemas, tables and views, the roles the grants name, and the login roles `uat_reader`, `uat_writer`, `uat_support` and `uat_operator`, none of them a superuser or able to bypass row security; and `sql/reset.sql` MUST take the schemas, the seal and every one of these roles out of the database, after which the schema MUST be able to be made again.
- **FR-004**: The tenants MUST be a hierarchy of a platform, a reseller with two businesses beneath it and a business beneath the platform; the sample rows of each tenant with data MUST be written by `uat_writer` through the views in that tenant's scope, so that the policies are exercised as the rows go in.
- **FR-005**: The row-security scenarios MUST be data (`scenarios/scenarios.ts`) that one runner (`scenarios/run.ts`) runs, in a transaction rolled back, on the person's database (`bin/rls-check.ts`, which `--explain`s each as the statements to run by hand) and on a PostgreSQL in process (the kit's own checks, `checks/`). They MUST show that a tenant sees only its rows and a session with no scope sees none; that a scope the session wrote itself, a forged mark and another value's mark are not trusted; that the tables are unreadable to the application roles and a reader cannot write; that a writer cannot write into, change, move a row to or delete from another tenant; that a reseller reaches the tenants beneath it and no others, reading and writing; that a platform operator reaches every tenant and a wildcard it wrote itself reaches none; that the owner is held to the policy; that row security cannot be disabled nor a policy dropped; and that the key cannot be read nor a mark made. A limit that the kit records and does not hide (a ticket may point at another tenant's account) MUST be a scenario that passes while the limit is there and fails when it is closed.
- **FR-006**: `README.md` MUST be a walk-through for a junior engineer that gives, for each step, the exact command to run, what it prints or does, and what to do if it fails: what the terms mean; how to find the PostgreSQL and set the workstation up; the roles, the schema, the seed; `arcactl doctor`; `psql` as each role with a scope; DBeaver click by click, including how to set a scope there; the scenarios; breaking row security on purpose and having `doctor` find it; reviewing the schema for an application's integration; and removing the kit. Every script, file and `arcactl` command it names MUST exist.
- **FR-007**: `FINDINGS.md` MUST be a template to record what a tester finds, with the findings that the kit already knows (the ticket that can point at another tenant's account, the missing foreign key from `tenantId` to the tenant table, that the scope is for the session in an autocommit tool, that the statements of a seal hold its key), each with where it is shown.
- **FR-008**: The acceptance kits of this library MUST be checked apart from the library by `bun run acceptance` (in `commons/data`; not by `verify`), which MUST type-check the kits, hold `acceptance/spec-kit` to the rules of a spec kit, trace each kit's sources and checks to the acceptance specifications, and hold the table of enforcement to what the checks say. The three tiers of specifications MUST stay apart: an acceptance specification MAY cite the library's, and no specification of the library or of the repository, and no test of the library's suite, MUST name an acceptance specification or a kit; the check MUST find one that does.
- **FR-009**: Where a PostgreSQL server is installed on the machine that checks the kit, the kit's checks MUST run the README's steps as written on a cluster of their own (a temporary folder, a free port, passwords over TCP): the workstation set up with `arcactl init`, the roles, the schema, the seed twice, `doctor`, each person in `psql`, every scenario, a fault planted and found, the reset, and all of it again; where none is installed they MUST say so and pass, and fail instead where `ACCEPTANCE_REQUIRE_PG=1`.

## Out of scope

- Starting, installing or configuring PostgreSQL (the kit's checks may start a throw-away cluster of their own where a server is installed), and containers.
- A user interface, and the application's own authentication: the scope is made by the issuer, here `arcactl scope`.
- Performance of the policies.

## Edge cases

- A tool in autocommit (DBeaver's default) sets the scope for its session and not for a transaction: the README says so, and says to clear it (FR-006).
- A connection pool that gives another session than the one the scope was set on sees no rows, which is the policy failing closed (FR-005).

## Assumptions

- A PostgreSQL 14 or later exists and the person has a superuser login on it and an empty database to throw away; the kit's tests run on PGlite (PostgreSQL 18) in process.
- The person works in Bash or Zsh (on Windows, WSL), with Bun and `psql` installed.

## Open questions

- **OQ-1**: Whether a tenant column should be a foreign key to the tenant table and whether a reference should carry the tenant (a scoped composite key); the kit records both as findings (FINDINGS.md K1, K2) and leaves governance as it is.
- **OQ-2**: Whether a reach of `*` should be allowed to write; today it is the same test as a read (FINDINGS.md K5).

## Key entities

- **Tenant** - a customer business of the platform, in a hierarchy (platform, reseller, business).
- **Scope** - the tenants a session acts for, sealed by the issuer's mark.
- **Issuer** - whoever holds the seal's key and makes the scope: `arcactl scope`, in this kit.
- **Scenario** - a role, a scope, one statement and what must come of it.
- **Finding** - what the tester records when what happened is not what the guide said.

## Success criteria

- **SC-001**: A person who follows the README on a PostgreSQL 14 or later reaches `bin/rls-check` with every scenario passing and the one known limit shown as a gap, and `arcactl doctor` with nothing failed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
