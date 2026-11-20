# Feature Specification: sql-osquery

**Spec ID:** 0058-sql-osquery
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The facts of a machine are in osquery's tables. The library imports osquery's published schema of one version, through the live-database path (0055), into a logical schema (never written by hand) that says on which platforms each table exists and which columns hold personal data, and gives a read-only driver (0056) that runs `osqueryi --json` on demand for a SELECT, so that a program or an agent asks a machine what it is with a typed query and cannot change it. `osquery-atc` (0027) goes the other way and is not changed. The osqueryd daemon and fleet TLS are out of scope: a machine is asked on demand, locally or over ssh.

## Requirements

- **FR-001**: The schema MUST be imported from osquery's published schema of a version, never written by hand: `tools/osquery-schema.ts` MUST write the file of a version from a checkout of `osquery/osquery-site`, trimmed to the fields the importer reads, with where it came from (the repository, the commit, the path, the SHA-256 of the file it was trimmed from) and its licence; `readSchema` MUST read it as a value and refuse a file that is not osquery's or a column of a type osquery's schema does not have.
- **FR-002**: `importSchema` MUST make a logical schema of the published schema through `adopt` (0055), stamped with the version of osquery (`osquery.version` on the schema and the domain named by it), with each table carrying the platforms it exists on and whether it is evented, each column whether it is hidden, required or an index and, where it exists on fewer platforms than its table, which; a platform given MUST leave out the tables and columns that do not exist on it; and the schema MUST make the same tables on SQLite, DuckDB and PostgreSQL.
- **FR-003**: The columns that hold personal data (the users and who is logged in, the groups a user is in, their keys, their shell history, their browser extensions, the network addresses and names that identify them) MUST be marked with the DPV-PD category and what they are held for, from a table of rules that is data; every rule MUST name a table and a column that osquery's published schema has; no other column is personal.
- **FR-004**: The driver MUST run only a SELECT, or a WITH that ends in one, of one statement: anything that writes, more than one statement, an empty statement and anything else MUST be refused as an error value before a process is started, with words in strings and comments not counted as code; `exec` MUST always be refused.
- **FR-005**: A table that acts on the world and not only reports it (`carves`, `curl`, `curl_certificate`) and any table the caller denies MUST be refused as an error value that names it, before a process is started.
- **FR-006**: A SELECT MUST be run as `osqueryi --json "<sql>"` through the function the caller gives that runs a program (so that the library depends on no runtime, and `ssh host osqueryi` is a prefix), its rows MUST have the types of the schema (osquery prints every value as text), a table that is not on the platform MUST be a typed error that says where it is, and what osquery says (a table it does not have, a failure, output that is not a list of rows) MUST be an error value; the driver MUST reject with the typed error.

## Out of scope

- The osqueryd daemon, scheduled queries, packs and fleet TLS; the check object of GRC and the `machine` verbs of headless, which are other libraries' and use this one.
- Running a query on a machine of another platform than the one asked: the platform is the caller's to give.
- Installing osquery: the tests answer the program runs with a function of their own where `osqueryi` is not on the path and run it for real where it is.

## Edge cases

- A name after `FROM` that is not a table of osquery (a common table expression, an alias) is left to osquery, which says if it is not there, per FR-006.
- A column that two tables type differently is left as osquery printed it, per FR-006.
- A table the schema does not name on a newer osquery is `unknown-table` from osquery's own message, per FR-006.

## Assumptions

- The schema files are of the versions of osquery that are published; a newer version is another file made by the tool, not an edit.
- The classification is of the columns whose value identifies a person or what they do; it is a table of rules that a review changes, and `FR-003`'s check holds it to the real schema.

## Open questions

- **OQ-1**: Whether the classification is also given as a governance model of its own, so that the register of personal data of the documentation site (0057) lists osquery's columns beside the arca models.

## Key entities

- **OsquerySchema** - the published schema of one version of osquery, with its provenance.
- **Importer** - `importSchema`: the schema made a logical schema through `adopt`.
- **Driver** - the read-only `Driver` over `osqueryi --json`.

## Success criteria

- **SC-001**: An agent can ask a machine for its users with a typed SELECT, gets rows of the right types, cannot change the machine, and is told as a value when a table does not exist on that platform.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
