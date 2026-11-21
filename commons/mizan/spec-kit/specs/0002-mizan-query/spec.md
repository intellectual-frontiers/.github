# Feature Specification: Questions of the trace in SQL

**Spec ID:** 0002-mizan-query
**Status:** Active
**Owner:** if
**Domain:** mizan

**Input:** Mizan holds the sources, tests and specifications of a library to the trace and judges its findings against a baseline that only shrinks. Which rule has the most findings, which requirements are not reviewed, which keys of the baseline are stale: a person asks these of a library and a text search answers them badly. This feature makes the findings, the baseline and the specifications into relations and answers one read-only SQL over them with the SQL language library.

## Relations

- **FR-001**: The relations MUST be `findings` (`rule`, `file`, `line`, `message`, `key`, `status`), `baseline` (`key`, `status`), `specs` (`slug`, `status`, `in_force`, `requirements`) and `requirements` (`spec`, `id`, `line`, `reviewed`); the status of a finding MUST be `fresh` where the baseline does not hold its key and `held` where it does, and the status of a key of the baseline MUST be `stale` where no finding has it and `held` where one does, as `judge` says.
- **FR-002**: `traceCatalog()` MUST give the catalog of those relations with the type of each column, so that a name or a column that is not there is found before a question is answered.

## Questions

- **FR-003**: `queryTrace(records, sql, options?)` MUST answer one query that the guard of the SQL language library judges to be a single read and binds to the catalog, with the engine of the same library, and MUST give an error value, never a throw, for anything else (a statement that writes, more than one statement, an unknown relation or column with the name it is closest to), with the sentence of the guard and its place; an answer MUST hold at most `options.limit` rows (1000 where none is given) and say whether it was cut; parameters (`?`) MUST be given by `options.params` and never read as SQL.

## The library and the tool

- **FR-004**: `queryLibrary(root, sql)` MUST read the findings of the trace of the library at `root` (its `about.ts`, `src` and `tools` and its `suite` against `spec-kit/specs`), its `trace.baseline.txt` and its specifications, and answer through `queryTrace`; `bun tools/query.ts [--root DIR] [--limit N] "SELECT ..."` MUST print the answer as an aligned table and write nothing, and end with 0 where it answered, 1 where the question is refused and 2 for a command line that does not fit.
- **FR-005**: Only `src/query.ts` MAY name the SQL language library (`lang-sql/aide/catalog`, `guard`, `relational` and `text`); no other module of the library names it.

## Out of scope

- A question over the findings of the other checks of Mizan (layers, versions, changes), over a ladder of libraries at once, and over the git history.

## Edge cases

- A library with no baseline file: every finding is `fresh` and the baseline has no rows, per FR-001.
- A key of the baseline that no finding has: `stale`, per FR-001.

## Assumptions

- A library keeps its specifications in `spec-kit/specs` and its baseline in `trace.baseline.txt`.

## Open questions

- None.

## Key entities

- **Records**: the findings, the baseline and the specifications a question is about.
- **Relation**: a table of values that a question may name.

## Success criteria

- The findings of a library are grouped by rule and by status with one line of SQL, from the checkout, with nothing written.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
