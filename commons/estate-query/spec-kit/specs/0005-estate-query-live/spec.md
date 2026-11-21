# Feature Specification: Estate Query: the live fleet

**Spec ID:** 0005-estate-query-live
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A question that joins what the estate holds with what the machines of the fleet say now, through the tables of osquery that are allowed: the SELECT sent to a machine is made from a list of tables and columns and never from what a person wrote, each machine is asked read only, a few at a time and within a time, and a machine that did not answer is said and never read as a machine with no rows.

## Requirements

- **FR-001**: The tables of osquery that may be read MUST be one list of data (`OSQUERY_TABLES`) with the columns that may be read of each, none that can hold a secret (a command line, an environment) and none that makes a request or writes; the relation of a table MUST be `osquery_<table>` with the asset and the instant the row was read in front of its columns, `osquerySelect` MUST make the text sent to a machine from the list and a limit alone (and give nothing for a table not on the list or a limit that is not a whole number from 1 to 100,000), and `osqueryTablesNamed` MUST find, in the code of a question and not in its strings and comments, the tables of the list it names.
- **FR-002**: `gatherLive` MUST send, for each machine and each table named, the SELECT of FR-001 through the way of reaching a machine that the host gives, at most `concurrency` machines at once (4 by default), each within `timeoutMs` (15,000 by default) and with at most `rowLimit` rows (5,000 by default), and MUST give each table as the relation of its columns, each value of the type of its column (a text that is not one of it is null) and every machine's rows together.
- **FR-003**: A machine that does not answer (it is unreachable, it refuses, osquery is not there, the time ended, the way throws) MUST be a row of `live_status` with the table, `answered` false and the reason, and MUST NOT stop the others nor be read as a machine with no rows (which is a row with `answered` true and no rows); a value that looks like a secret MUST be replaced.
- **FR-004**: A question MUST be able to be given the live relations and `live_status`, which MUST be bound to the catalog with the relations of the estate so that a name or a column that is not there is found with the nearest, and a join of the estate with the live relations MUST give the rows the data says.

## Acceptance scenarios

1. **Given** three machines of which one does not answer, **When** the processes are gathered, **Then** the rows of two are given and `live_status` says why the third did not answer, per FR-003.
2. **Given** a question that names `osquery_processes` and a string with `osquery_users` in it, **When** its tables are found, **Then** only the first is, per FR-001.

## Out of scope

- Reaching a machine (keys, host keys, the forced command of the probe): the host that gives the way.
- Pushing the conditions of a question into the SELECT: a question reads the allowed columns of the whole table, up to the limit, and the conditions are for the engine here.

## Edge cases

- A table named with the prefix that is not on the list: not one, and the question is refused by the catalog, per FR-001 and FR-004.
- A machine with more rows than the limit: the rows up to it, per FR-002.

## Assumptions

- The machines run osquery, and a machine that does not is a row of `live_status`.

## Open questions

- None.

## Key entities

- **Live relation**, **Status**, **Fetch**.

## Success criteria

- **SC-001**: A question across the fleet is one statement, no text of it reaches a machine, and what did not answer is known.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
