# Feature Specification: recovery-proof-identity

**Spec ID:** 0064-recovery-proof-identity
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The fifth stage of the toolkit of the book "Accepted Is Not Correct": the proof that a platform can be put right and that its figures are right. Drills of replay, rollback and restore that are kept with how long they took and what they found (a rollback is done by the load id of the flow model, 0060); a calculation ledger with the hash of each run's inputs and outputs so that a figure can be reproduced and a change of one shown; reference cases that hold a calculation to a value; lineage that says what a dataset is made from and what a change reaches (and feeds the label check of 0062); and the linking of records of different sources to one entity by rules that are written down, as an optional extension that needs only the table of links.

## Requirements

- **FR-001**: The model MUST be a module of governance named `proof` that requires nothing, with a drill as a record of its kind (a closed code list: replay, rollback, restore), what it was done to, when it began, how many seconds it took, what it found (a closed code list: passed, failed, abandoned), the hash of what was there before and after and the evidence, annotated append-only.
- **FR-002**: A calculation run MUST be a record of the calculation and its version, the parameters as JSON, the SHA-256 of its inputs and of its outputs, how many rows it gave, when and the load it was for, annotated append-only.
- **FR-003**: A reference case MUST be a record of the calculation, what it shows, the inputs as JSON, the value expected, the tolerance and where the value comes from.
- **FR-004**: A lineage edge MUST be a record of the dataset something is made from, the dataset that is made and the transform that makes it, unique together.
- **FR-005**: An entity link MUST be a record of the entity, the source and the key of the record in it (unique together), the rule that found it (a closed code list: exact, normalized, similar, confirmed) and the score.
- **FR-006**: Every concept of the model MUST be defined.
- **FR-007**: `rollbackDrill` MUST count what a load wrote in each table, undo it by its id, and show that the rows removed are the rows written, that none of the load's rows remain and that the rows of the other loads are what they were, and keep the drill as passed or failed with the problems found.
- **FR-008**: `stateDrill` MUST read a table, do the steps (a replay, or a backup, a loss and a restore), read it again and say whether it is as it was (or, where asked, that it is not), keep the drill with how long it took, and say what did not hold where it failed; `fingerprint` MUST be the count and the SHA-256 of the columns asked for in the order asked for.
- **FR-009**: `recordCalculation` MUST run a calculation and record the hashes of its inputs and outputs with its version and parameters, and `reproduce` MUST say `reproduced` where the same inputs give the recorded outputs, `different-outputs` with both hashes where they do not, `different-inputs` where the inputs are not the recorded ones and `unknown-run` for a run that was not recorded.
- **FR-010**: `runReferenceCases` MUST run each case of a calculation and say for each the value expected, the value given, the difference and whether it is within the tolerance.
- **FR-011**: `lineage` MUST walk upstream or downstream from a dataset, nearest first, each dataset once, without looping on a cycle, with its depth and the transform; `edgesOf` MUST give the edges as the label check of 0062 reads them.
- **FR-012**: `linkRecords` MUST link records by rules tried in order (exact on fields as they are, normalized on fields written one way, similar above a threshold across sources), give each record the entity it is in with the rule and score that joined it, leave a record nothing links as its own entity, and give the same entities whatever order the records come in.
- **FR-013**: `saveLinks` MUST keep the links in the table of entity links, a record linked to nothing as an exact link to itself.

## Out of scope

- Probabilistic record linkage with learned weights and a review queue: `similar` is a threshold a person confirms, and `confirmed` is how a link they confirmed is kept.
- Backups of a database: the engine's; the drill proves a restore, and does not make one.
- A lineage extracted from SQL text: the edges are given, and a parser of lineage is a later extension.

## Edge cases

- A drill that throws leaves no row: it was not done, per FR-007.
- A rollback drill runs the rollback for real, so it is done on a copy or in a test, per FR-007.
- `similar` never links two records of the same source, per FR-012.

## Assumptions

- The tables are made by `bind` from the model on any of SQLite, DuckDB and PostgreSQL; the fixtures of the tests are synthetic.

## Open questions

- **OQ-1**: Whether a drill's schedule (how often each kind must be done) should be a control of 0062, so that an overdue drill shows in the control matrix.

## Key entities

- **Drill** - a recovery put to the test, kept with what it found.
- **Calculation run** - a calculation with the hashes of what went in and came out.
- **Reference case** - a value a calculation must give.
- **Lineage edge** - a dataset made from another.
- **Entity link** - a record of a source linked to an entity, with the rule.

## Success criteria

- **SC-001**: A load can be undone and the others shown intact, a replay or restore shown to return what was there, a figure reproduced or its change shown, and who is the same person across sources is a fact with a rule.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
