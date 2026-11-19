# Feature Specification: Kinds

**Spec ID:** 0026-sql-kinds
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Reference data (the kinds of things, the statuses, the ranks) is kept by people in a spreadsheet and belongs in the model as rows and as a typed value in code. A kinds file is CSV text whose header names the columns of a table by the words of their names; this feature reads it into typed rows (each column's type declared, text where it is not), checks it against the table of a logical schema (a column the table does not have, a required column the file lacks, a key that is there twice, a row with the wrong number of fields, a value that is not of its column's type), and writes a TypeScript module of the same rows (an interface and a readonly array, the same bytes every time, marked not to be edited) so that code and database say one thing. The rows feed integrations (0022) and ephemeral targets (0025) as they are.

## Reading

- **FR-001**: `kindsFromCsv` MUST read CSV text (the reader of 0007-physical FR-015) with a header into typed rows in the order of the file, each column of a declared type (`text`, `integer`, `number` or `boolean`, text where not declared), an empty field being null, and MUST give errors as values for a header that names a column twice or names none, a row with a number of fields other than the header's (with its line), a value that is not of its column's type (with its line and column), and a key (the first column where not said) that is in the file twice.

## Checking against a table

- **FR-002**: `checkKinds` MUST compare the rows with a table of a logical schema by the words of the names and give errors as values for a table that is not there, a column of the file the table does not have, a column the table requires (not optional and with no default) that the file lacks, and an empty value in a column the table requires.

## The module

- **FR-003**: `kindsModule` MUST write a TypeScript module that holds an interface of one row (a column optional in the file as `T | null`) and a readonly array of the rows in the order of the file, with a header that says it is made from a file and is not to be edited, the same text every time for the same rows, and the module, imported, MUST give the rows that were read.

## Feeding the rest

- **FR-004**: `rowsOf` MUST give the rows as the records that integrations and ephemeral targets take, so that one file is the module in code, the rows in a build and the load into a database.

## Out of scope

- Reading the file from disk: the caller reads it.
- Changing a row of a durable table: that is an integration with an `upsert`.

## Edge cases

- A quoted field that holds the delimiter or a newline: read as one field, per FR-001.
- A boolean written `true`, `false`, `1` or `0` in any case: read as a boolean, per FR-001.
- A file with a header and no rows: an empty array, per FR-003.

## Assumptions

- A column that is declared an integer holds whole numbers that are safe integers.

## Open questions

- **OQ-1**: Whether a column that holds a code of a code list is checked against the list.

## Key entities

- **Kinds** - the typed rows of a CSV file.

## Success criteria

- **SC-001**: A spreadsheet of reference data becomes rows in the model, a typed value in code and a load, from one file.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
