# Feature Specification: sql-loads

**Spec ID:** 0054-sql-loads
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** ETL, ELT, data loads and data extracts matter as much as the schema. The design: a load is a typed source into a typed table (0053-sql-typed), in one transaction, recorded in a ledger; ELT is the same load into a staging table, gated by SQL-DQ tests (0052-sql-quality), merged only where they pass; an extract is a typed select written as CSV or lines of JSON; an incremental load reads from a high-water mark that the ledger keeps. The unit `sql/loads` holds this first slice, in pure TypeScript over the driver of this library, so that it is the same on SQLite, DuckDB and PostgreSQL. What a dialect does faster by itself (`COPY`, `read_csv`, `read_parquet`) and the sources and sinks that are another system's (HTTP, object stores, queues) are connectors that sit on the same `Source` and `Load` and are later parts, listed below.

## Requirements

- **FR-001**: A source MUST give rows of a type in batches, and MUST be made from rows in memory, from CSV text (RFC 4180: quoted cells, doubled quotes, line breaks inside quotes, a byte order mark) with a typed parser for each column of the row (text, integer, decimal, boolean, date, timestamp, a closed list of codes, optional), from lines of JSON read by a function that checks a row, and from a typed select of any database.
- **FR-002**: A line that cannot be read (a cell that does not parse, the wrong number of cells, a header that lacks a column, a line that is not JSON or not a row) MUST be rejected with its line, why and what it was, and MUST NOT stop the lines that can be read.
- **FR-003**: An extract MUST write the rows of a typed select as CSV (a header, quoting where needed, null as an empty cell) or as lines of JSON, and return the text; a CSV that is extracted MUST be read again by the source to the same rows.
- **FR-004**: A load MUST put a source into a typed table in batches in one transaction, in a mode: `append` (a key that is there fails the load), `skip-existing`, `upsert` or `replace`; a load that the database refuses MUST leave the table as it was and be a report with status `failed`, not a throw; each run MUST be a row of the ledger of loads (its name, status, counts, start and end), which the load makes if it is not there.
- **FR-005**: A load with a gate MUST go through a staging table that has the target's columns and none of its constraints; the SQL-DQ tests of the gate MUST run on the staging table; the rows MUST be merged into the target only where no test failed or erred; a load that does not pass MUST leave the target as it was, report the outcomes of the tests with status `gated`, and leave no staging table unless asked to keep it.
- **FR-006**: A load MUST report the lines it rejected, MUST be refused with status `rejected` and take nothing where more than the share that is allowed was rejected, and otherwise MUST take the rows that were read.
- **FR-007**: A load MUST keep the greatest value of a named column in the rows it loaded as its high-water mark in the ledger, `watermarkOf` MUST give the mark of the last run that loaded, and a run that did not load MUST NOT move it.
- **FR-008**: A select of one database MUST be loadable into a table of another, through a gate, on every pair of SQLite, DuckDB and PostgreSQL, with the rows, the counts and the ledger of the database loaded into.
- **FR-009**: A load MUST be able to give the run's id to every row it writes (`loadIdColumn`), so that what a load wrote is found by its id; and with `divertConflicts`, in the mode `append` and without a gate, a row whose key is already there MUST NOT fail the load: where its content is the same it MUST be absorbed and counted, where it differs it MUST be written to the table `<table>__conflict` (the run, when, the key and the existing and incoming rows as JSON) and the original MUST be left as it is; the report MUST say how many rows were absorbed and diverted.

## Out of scope

- Connectors that sit on `Source` and `Load` and are later parts: dialect-native bulk load and extract (PostgreSQL `COPY`, DuckDB `read_csv`, `read_parquet` and `COPY ... TO`, SQLite `.import`), Parquet and Arrow, HTTP and API sources with paging, object stores, queues, change data capture and `LISTEN`/`NOTIFY`.
- Orchestration: schedules, dependencies between loads, retries and alerts; a load is a function that a scheduler calls, and the ledger is what it reads.
- dbt-style seeds, snapshots and source freshness, which are built on these (issue 11).
- Reading and writing files: the text is given and returned; the caller owns the file, the bucket and the response.

## Edge cases

- A table with no primary key cannot be loaded in `skip-existing` or `upsert` unless the keys are given, per FR-004.
- A staging table is made with `CREATE TABLE ... AS SELECT ... WHERE 1 = 0`, so it has none of the target's constraints, defaults or indexes; the gate's tests are what hold the rows to them, per FR-005.
- A mode of `replace` through a gate empties the target only after the gate has passed, per FR-005.
- A batch that fails after other batches were written takes none of them, per FR-004.

## Assumptions

- The driver takes text and every value is a literal (0053-sql-typed), so a load writes batches of `INSERT` statements; the native bulk paths are the connectors above.
- The ledger is in the database that is loaded into, in the schema the connection is set to.

## Open questions

- **OQ-1**: Whether the ledger of loads becomes a model of its own (with the issues model's pattern), and whether it records the SQL-DQ outcomes of a gate.
- **OQ-2**: Whether a connector is a contribution point of the engine (`sql.loads.sources`) or a plain value, as it is here.

## Key entities

- **Source** - rows of a type in batches, and the lines that were rejected on the way.
- **Load** - a source into a typed table: a mode, a gate and a high-water mark.
- **Report** - what a run did: status, counts, the rejected lines and the outcomes of the gate.
- **Ledger** - the table `load_run`, one row for each run.

## Success criteria

- **SC-001**: A CSV file is loaded into a table with a gate of data tests, on each engine, and what fails the gate is reported and not loaded; the same table is extracted to CSV that reads back to the same rows.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
