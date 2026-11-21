# Feature Specification: Questions of the repository in SQL

**Spec ID:** 0012-repoctl-query
**Status:** Active
**Owner:** if
**Domain:** repoctl

**Input:** Which requirements does nothing verify, which specifications are still drafts, which library has the most requirements: a person or a tool asks these of a repository's spec kits, and a script of text tools answers them badly. `repoctl query` makes the libraries, their specifications and their requirements into relations and answers one read-only SQL over them with the SQL language library.

## Relations

- **FR-001**: The relations MUST be `libraries` (`name`, `package`, `folder`, `version`, `level`, `npm`, `held`), `specs` (`library`, `number`, `slug`, `state`: a row of `registry.tsv`) and `requirements` (`library`, `spec`, `fr`, `mechanism`, `by`, `note`: a row of `enforcement.tsv`, its first column split into the specification and the requirement); a library with no spec kit MUST have rows in `libraries` only, and a line of a table that is not a row (a header, a blank line, a line that is not an id of a requirement) MUST be left out.

## Questions

- **FR-002**: `askRepository(sources, sql, options?)` MUST answer one query that the guard of the SQL language library judges to be a single read and binds to the catalog of FR-001, with the engine of the same library, and MUST give an error value, never a throw, for anything else (a statement that writes, more than one statement, an unknown relation or column with the name it is closest to), with the sentence of the guard and its place.
- **FR-003**: An answer MUST hold at most `options.limit` rows (1000 where none is given) and say whether it was cut; parameters (`?`) MUST be given by `options.params` and never read as SQL.

## The verb

- **FR-004**: `repoctl query "<SELECT>"` MUST be a verb of the public tier that only reads (it changes no file), present only where the configuration turns on the capability `query` (which needs `libraries`); it MUST read the manifests and the two tables of each library's spec kit through the ports of the world, and give the answer as an aligned table, or as the `data` of the JSON envelope with `--json`, with `--limit` for the most rows.
- **FR-005**: A question that is refused or cannot be answered MUST end the verb with a problem (`E-USAGE`, naming the sentence and place) and a status that is not 0; an answer, however many rows it has, MUST end with 0.

## Out of scope

- A question over the findings of `check`, the versions on npm, or anything the ports do not already read; a question that changes a file.

## Edge cases

- A library whose spec kit has no `enforcement.tsv`: no requirements, per FR-001.
- A repository with no capability `query`: the verb is not in the tree, per FR-004.

## Assumptions

- The tables are tab-separated with the columns the spec kit of every library of commons keeps.

## Open questions

- None.

## Key entities

- **Source**: a library as the manifest says it, with the texts of its two tables.
- **Relation**: a table of values that a question may name.

## Success criteria

- The questions of the examples are answered in one line of SQL each, from the checkout, with nothing written.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
