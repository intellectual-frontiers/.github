# Feature Specification: Questions of records in SQL

**Spec ID:** 0015-grc-query
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** An auditor, a lead and a script ask of the records of GRC what no verb gives: the controls with nothing observed in ninety days, the exceptions that end this quarter, the checks that fail for each framework. SQL is the language every one of them already knows. This feature makes the records into relations and answers a read-only SQL over them with the SQL language library, without a database and without a way to change a record.

## Relations

- **FR-001**: `relationsOf(records, at?)` MUST give the relations `frameworks`, `controls`, `checks`, `check_controls`, `results`, `result_controls`, `findings`, `evidence`, `attestations`, `exceptions`, `risks` and `risk_controls`, each row made from a document of the records (the id of the document is the first column, a time is the text of its instant, a list of the document is a relation of its own), and `control_state`, the state of every control at the instant `at` (the newest instant recorded where none is given) as the as-of view computes it; where the as-of view is an error value `control_state` MUST have no rows.
- **FR-002**: `catalogOf()` MUST give the catalog of those relations, with the type of each column, so that a name or a column that is not there is found before a query is run.

## Questions

- **FR-003**: `queryRecords(records, sql, options?)` MUST answer one query that the guard of the SQL language library judges to be a single read and binds to the catalog, over the relations of FR-001, and MUST give an error value, never a throw, for anything else: a statement that writes, more than one statement, an unknown relation or column (with the name it is closest to), a clause the engine does not have; the reason MUST be the sentence of the guard or the engine, with its place where it has one.
- **FR-004**: A result MUST hold at most `options.limit` rows (1000 where none is given) and MUST say whether it was cut (`truncated`); the records MUST NOT be changed by a question.
- **FR-005**: Parameters (`?`) MUST be given by `options.params`, and a value in a parameter MUST never be read as SQL.

## Out of scope

- A question that changes a record, a view, a function of the user, and a join over two sets of records.

## Edge cases

- Records with no results: every relation is there and the rows are none, per FR-001.
- A question `SELECT * FROM results; DROP TABLE results`: refused as two statements, per FR-003.

## Assumptions

- The records are the documents the library already holds; this feature reads them and adds none.

## Open questions

- None.

## Key entities

- **Records**: what an assessment is made from (the frameworks, checks, results, findings, evidence, attestations, exceptions, risks and the ledger).
- **Relation**: a table of values that a question may name.

## Success criteria

- An auditor's questions of the acceptance scenarios are answered in one line of SQL each.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
