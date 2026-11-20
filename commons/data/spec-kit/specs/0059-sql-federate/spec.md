# Feature Specification: sql-federate

**Spec ID:** 0059-sql-federate
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Run the same query on many targets and merge the results: the same SELECT asked of many machines (through osquery, 0058) or many databases, each answer a value (rows or a typed error), the rows tagged with their target and merged by SQL in an engine (DuckDB is the one meant for it), the result partial by default and an audit of the run optional and the caller's. The unit is generic: a target is anything with a `Driver` (0056); osquery supplies targets and a redaction of its personal columns. How a machine is reached (ssh, local, reach policy) is not here: it is the caller's, and a headless library's targets give it.

## Requirements

- **FR-001**: `fanOut` MUST ask every target of a plan the query, give each target's answer as a value in the order of the plan (its rows and when they were collected, or a typed error), and MUST NOT let one target's failure end the run; two targets of one plan with the same name MUST be refused.
- **FR-002**: A result MUST be partial by default: it MUST say how many targets answered, whether all did, and the failures with what the driver rejected with (a typed error such as osquery's is kept as the cause).
- **FR-003**: A plan MUST be able to name a quorum (the share of targets that must answer): a result below it MUST say so (`quorumMet` false) and still hold what answered.
- **FR-004**: A target that takes longer than the plan's timeout MUST be a `timeout` error, no more targets than the plan's concurrency MUST be asked at once, a target that gives more rows than the plan allows MUST be a `too-many-rows` error whose rows are not kept, and the plan's redaction MUST change a value before it is kept.
- **FR-005**: `mergeInto` MUST load the rows, tagged with their target, when they were collected and a key that is the same for the same row, into `fleet_rows` of an engine the caller gives, with a column for each column of the answers of the type they all agree on (whole and fractional numbers as decimals, text where they disagree, and the result saying so), and what each target answered into `fleet_targets`; a column of the answers that the merge uses MUST be refused by name.
- **FR-006**: The merge MUST be SQL over the loaded tables, `countBy` giving how many rows and how many targets have each value of a column.
- **FR-007**: `differences` MUST give the targets that differ from a baseline, row by row, as the rows they lack and the rows they have besides, the baseline being the rows that at least half of the targets that answered have (the default) or the rows of one target, never compared with itself.
- **FR-008**: An audit of a run MUST be optional: `auditOf` MUST give a record of who asked what of which targets and what each answered, with no rows and no values, `auditTable` MUST keep records in a table of a database the caller gives, and a sink of the caller's own MUST be possible.
- **FR-009**: Machines asked through osquery MUST be targets: a table that is on one platform and not another is a typed error for the machine that lacks it and rows for the one that has it, in the same fan-out and the same merge, and the personal columns of osquery's schema MUST be hideable by a redaction that the unit gives.

## Out of scope

- Reaching a machine (ssh, local transports, the reach policy): the caller's, with the targets of a headless library.
- Checks and their assertions over a fleet (GRC's check object), which consume a merge.
- Keeping the history of results over time: a merged table can be loaded by 0054 into a table of the caller's.
- A query that writes: the targets' drivers are trusted to refuse it, as osquery's does (0058).

## Edge cases

- A plan with no target is a result that is complete and meets any quorum of 0, per FR-002.
- A column that two answers give in types that cannot be reconciled is text, and says `mixed`, per FR-005.
- Redaction by column name hides a column wherever it is named: it is conservative, per FR-009.

## Assumptions

- A target's rows are plain values; a wide integer is a number (0056).
- The engine the merge is in is a SQL engine that has `CREATE TABLE`, `BIGINT`, `DOUBLE`, `BOOLEAN` and `count(DISTINCT ...)`; DuckDB is the one the tests use.

## Open questions

- **OQ-1**: Whether `differences` should compare by a key column (a package's name) and give a changed value as one change, not a missing and an extra row.

## Key entities

- **Target** - a name, a platform and a `Driver`.
- **FanOut** - every target's outcome, and whether all answered and enough did.
- **Merged** - `fleet_rows` and `fleet_targets` in an engine.
- **AuditRecord** - who asked what of which targets and what each answered.

## Success criteria

- **SC-001**: A SELECT asked of a mixed fleet gives the rows of the machines that answered, each machine's failure by name, and a count or a difference by SQL.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
