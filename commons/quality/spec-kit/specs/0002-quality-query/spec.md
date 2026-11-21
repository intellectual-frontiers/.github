# Feature Specification: Questions of the runs in SQL

**Spec ID:** 0002-quality-query
**Status:** Active
**Owner:** if
**Domain:** quality

**Input:** A history of runs kept as evidence answers what a lead asks of it: which tests are flaky, which cases never ran and why, which requirement fails most. Reading the files by hand or by a script of text tools answers them badly. This feature makes the runs and their cases into relations and answers one read-only SQL over them with the SQL language library, without a database and without a way to change the evidence.

## Relations

- **FR-001**: The relations MUST be `runs` (`trace_id`, `day`, `revision`, `grade`, `tests`, `passed`, `failed`, `not_run`), `cases` (`trace_id`, `day`, `file`, `name`, `outcome`, `grade`, `risk`, `characteristic`, `runtime`, `attempt`, `duration_ms`, `rule`, `line`, `reason`) and `case_requirements` (`trace_id`, `file`, `name`, `requirement`), a row for each run, for each case of each run (whatever became of it, `not_run` included) and for each requirement a case names; the duration of a case MUST be in milliseconds.
- **FR-002**: `qualityCatalog()` MUST give the catalog of those relations with the type of each column, so that a name or a column that is not there is found before a question is answered.

## Questions

- **FR-003**: `queryRuns(runs, sql, options?)` MUST answer one query that the guard of the SQL language library judges to be a single read and binds to the catalog, with the engine of the same library, and MUST give an error value, never a throw, for anything else (a statement that writes, more than one statement, an unknown relation or column with the name it is closest to), with the sentence of the guard and its place; an answer MUST hold at most `options.limit` rows (1000 where none is given) and say whether it was cut; parameters (`?`) MUST be given by `options.params` and never read as SQL.

## The command

- **FR-004**: `keptRuns(repo)` MUST read the runs of the `quality` branch after the branch verifies, each with the day of its file and the grade the branch gives it, leaving out a file that does not read; a repository with no branch MUST have no runs, and a branch that does not verify MUST be an error value.
- **FR-005**: `quality query "<SELECT>" [--repo DIR] [--limit N] [--json]` MUST print the answer as an aligned table or as JSON and write nothing; it MUST end with 0 where it answered, 1 where the question is refused or the branch cannot be read, and 2 for a command line that does not fit.

## Out of scope

- A question that changes the evidence, and a question over the ledger of nonconformances or the register (a later provider of the same shape).

## Edge cases

- A run with no cases: a row in `runs` and none in `cases`, per FR-001.
- A repository with no `quality` branch: every relation is there with no rows, per FR-004.

## Assumptions

- A case's duration is its end minus its start in the record, which is in nanoseconds.

## Open questions

- None.

## Key entities

- **Kept run**: a record read back from the branch, with the day of its file and its grade.
- **Relation**: a table of values that a question may name.

## Success criteria

- The flaky tests of a history are found by one line of SQL over the runs kept on the branch.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
