# Feature Specification: Integrations

**Spec ID:** 0022-sql-integrations
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** Data comes into a model's tables from outside: reference data written by people, a file, a table of another database, or an API. An integration says where rows come from (the source), which of the target table's columns they give (the contract) and how they are put in (the strategy: append, upsert, replace or snapshot). The rows are landed first in a typed temporary table of the target's columns, so that what is wrong with them is found while the target is untouched; then, in one transaction, the landing is checked, counted, loaded and recorded. Reliability is the point of the design. A load that finds duplicate keys, a missing value a column requires, an empty snapshot, or a snapshot that would delete most of the target changes nothing and says why as an error value. Every successful load is a row in a ledger with its counts and the hash of what it landed, and a load of rows that have not changed since the last one (the case that would double an append) does nothing. The lineage of the rows (from where to where) is a value. The names of tables and columns are those of governance (by words), written by the naming layer, so that an integration is the same for every dialect and every schema qualifier.

## The integration

- **FR-001**: `loader` MUST resolve an integration (a name, a table and the columns of the contract by the words of their names, the source, the strategy and the key) against a logical schema, a dialect and a naming, and MUST give errors as values for a table or column the schema does not have, for a column the target requires (not optional and with no default) that the contract leaves out, and for an upsert or snapshot whose key is empty or is not in the contract; the key is the table's primary key where it is not said, and the strategy is `upsert` where it is not said.

## Sources

- **FR-002**: A source MUST be one of: rows written in TypeScript (all with the same columns, which are the contract), CSV text (read by the library, with quoted fields, doubled quotes and a delimiter that is a setting, an empty field being null, and each field cast to its column's type), a table of another database file of the same engine (attached for the load and detached after it, for a dialect that says it can attach), or an adapter (a typed hook that reads rows, or says why it could not); a source that the dialect cannot read, a failing adapter and an adapter row with a column outside the contract MUST each be an error value that changes nothing.

## The load

- **FR-003**: A load MUST land the source in a temporary table of the contract's columns typed as the target's, and MUST run everything after landing in one transaction that is rolled back where anything fails, and MUST drop the landing whether the load succeeded or not.
- **FR-004**: The strategies MUST be: `append` (every landed row inserted), `upsert` (a landed row whose key is in the target changes that row, any other is inserted), `replace` (the target's rows deleted and the landed rows inserted) and `snapshot` (the target made to hold the landed rows by key: upserted, and a row whose key was not landed deleted); an upsert run twice MUST leave the rows as after once.
- **FR-005**: Before it loads, a load MUST find, in the landing, a key that is there more than once (for upsert, snapshot and replace) and a null in a column the target requires, and MUST refuse, as an error value that names the count and the column and leaves the target unchanged, a landing that has either.
- **FR-006**: A snapshot MUST refuse a landing with no rows, and one that would delete a larger share of the target's rows than the setting allows (half by default), as an error value that leaves the target unchanged, unless the setting says otherwise.

## The record

- **FR-007**: A successful load MUST add one row to a ledger table (the integration's name, its sequence, a label of the source, the hash of the landed rows, the strategy and the counts) made `IF NOT EXISTS`, in the same transaction as the load; and where the setting says so (by default for append only), a load whose landed rows have the hash of the last load of that integration MUST change nothing and report that it was unchanged.
- **FR-008**: A report MUST give the number of rows landed, inserted, updated and deleted, the hash of what was landed, and whether the load was made or unchanged.
- **FR-009**: `lineageOf` MUST give the edges of an integration (the source to its landing, the landing to its target) as values in a stable order, and `upstream` MUST give every node whose rows reach a node, nearest first.

## Settings

- **FR-010**: The ledger's table, the landing's name, when an unchanged load is skipped (`append`, `all` or `none`), the share of a snapshot that may be deleted, and the CSV delimiter MUST each have a default and be changeable.

## Out of scope

- Reading a file from disk: the caller reads it; the library parses text.
- Loading from an attached database of another engine.
- Change data capture and streaming.
- Transforms and queries: a later part of this phase.

## Edge cases

- A source with no rows: lands nothing; an upsert, append and replace load nothing (replace empties the target), a snapshot refuses, per FR-006.
- A CSV with a header the contract does not name: the contract's columns are taken by header name, and a header that is not a column is refused, per FR-002.
- An attached source on PostgreSQL: an error value, per FR-002.
- A load run twice with append and the same rows: the second is unchanged, per FR-007.

## Assumptions

- The target tables exist; the lifecycle makes them.
- A key that is present in the target and in the landing is the same row.

## Open questions

- **OQ-1**: Whether the load's ledger is also a table of the schema, made by `bind`, so that convergence does not read it as drift; for now the convergence ignore list names it.

## Key entities

- **Integration** - a source, a contract, a strategy and a key, for one table.
- **Load** - what an integration does on one run.
- **Landing** - the temporary table the source is put in first.
- **Ledger** - the record of what each load did.

## Success criteria

- **SC-001**: Rows from outside come in once, are checked before they touch a table, can be loaded again without harm, and are accounted for.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
