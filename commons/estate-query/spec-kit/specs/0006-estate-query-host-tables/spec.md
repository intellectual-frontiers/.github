# Feature Specification: Estate query host tables

**Spec ID:** 0006-estate-query-host-tables
**Status:** Draft
**Owner:** if
**Domain:** estate-query

**Input:** The questions over the live fleet may name only the osQuery tables of an allow-list, each with its columns as data (0005-estate-query-live). The list has ten tables and none that says how loaded a machine is, how long it has been up, how much memory it uses or what its interfaces carry, so the host metrics that an asset of tier 3 or tier 4 gives (machine-probe 0009-machine-probe-signals) cannot be asked. This specification adds those tables. It is governed by commons 0041-telemetry-and-reach (audit row B9). **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## Requirements

- **FR-001**: `OSQUERY_TABLES` MUST gain the tables `memory_info`, `load_average`, `uptime`, `cpu_time` and `interface_details`, each with an allow-list of the columns the mapper reads and the type of each (the columns are read from the schema of osQuery 5.24.1 and each is marked UNVERIFIED until a capture of that version proves it, as desired-os-state 0007-desired-os-state-observe-osquery FR-008 requires). Relies on audit rows: B9.
- **FR-002**: Each added table MUST be reachable through `osqueryRelation` and `osquerySelect` and no other way: the text sent to a machine MUST be made from these names, never from what a person wrote, and a column that is not in the allow-list MUST be refused. Relies on audit rows: B9.
- **FR-003**: A table MUST say for which platforms it exists (`linux`, `macos`, `windows`), and a question over a table of a platform the machine does not have MUST be an answer of `unsupported` and not an error of the engine. Relies on audit rows: B9.
- **FR-004**: The allow-list MUST be the one source of the tables and columns that machine-probe's mapper reads, and a test MUST show that every table that the mapper names is in it. Relies on audit rows: B9, D6.

## Acceptance scenarios

1. **Given** the table `load_average`, **When** a question names a column it does not list, **Then** it is refused, per FR-002.
2. **Given** a Windows machine and `load_average`, **When** it is asked, **Then** the answer is `unsupported`, per FR-003 (where the table is not on that platform).
3. **Given** the mapper of machine-probe, **When** its tables are compared with the allow-list, **Then** each is in it, per FR-004.

## Out of scope

- Writing to a machine and any table that changes state.

## Edge cases

- A column that an older osQuery does not have: the question gives an error naming the column, not an empty value, per FR-001.

## Assumptions

- osQuery 5.24.1 (the version pinned by the enrollment server's catalog).

## Open questions

- None.

## Key entities

- **OsqueryTable** - a table and the columns that may be read.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
