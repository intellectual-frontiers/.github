# Feature Specification: contracts-time-control

**Spec ID:** 0062-contracts-time-control
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The third stage of the toolkit of the book "Accepted Is Not Correct": the promises a dataset makes and the proof that they are kept. A data contract of fields, owner and version whose versions are compared by a compatibility matrix for readers and for writers; effective dating, with a `temporal` annotation of governance and one predicate that reads a table as of an instant; a period that is closed so that a late change is placed in the next open one; a control matrix whose status is computed from the runs of each control; consent as a test of the uses that had none; canary tokens that find a leak; labels that propagate along the lineage; and a report of where the layers disagree. The checks that need no table (the matrix, the labels, the report) are plain functions, so a pipeline can run them without a database.

## Requirements

- **FR-001**: The model MUST be a module of governance named `contract` that requires nothing, with a data contract as a record of the dataset, version (unique with the dataset), status, owner and the instants between which it holds, and each field it promises as a record of its name, datatype, whether it may be missing and its classification, of one contract.
- **FR-002**: A period MUST be a record of a scope, the instants it starts at and ends before, its status, who closed it and when, and the reason it was opened again.
- **FR-003**: A control MUST be a record of what must hold, who answers for it, how often it is checked in days, the evidence that checks it and the framework it answers to, and a run of a control MUST be a record of the control, what it found, when and the evidence, annotated append-only.
- **FR-004**: A consent MUST be a record of a pseudonymous subject, a purpose, whether it is granted or withdrawn and the instants between which it holds.
- **FR-005**: A canary token MUST be a record of the made-up value, where it was planted, when and what its appearance would mean.
- **FR-006**: The status of a contract, of a period, the result of a control run and the status of a consent MUST be closed code lists, and every concept MUST be defined.
- **FR-007**: The quality vocabulary MUST have `temporal` (a concept, the member that says from when a record holds and the one that says until when), the contracts, the periods and the consents MUST carry it, and lint MUST find a member it names that the concept does not have.
- **FR-008**: `compatibility` MUST compare the fields of two versions of a contract with a matrix that says for each kind of change (a field added optional or required, removed, retyped, made nullable or required, a label raised or lowered) whether a reader and a writer of the old version still work, and say whether readers or writers break; `fieldsOf` MUST read the fields of a version.
- **FR-009**: `holdsAt` MUST be the predicate that says a record holds at an instant (it began at or before and has no end or ends after, the end not being included) in a typed query on every engine, for instants written as the same text form.
- **FR-010**: `closePeriod` MUST close a period and keep who and when; `reopenPeriod` MUST refuse without a reason; and `place` MUST put a change in its own period where that takes changes, as an adjustment of the next open period where its own is closed, and nowhere where no period holds its date.
- **FR-011**: `recordRun` MUST add a run of a control, and `matrix` MUST give for each control, from its latest run at the time asked, passing, failing (a failure or a run that was due and not made), waived, overdue where a pass is older than the frequency, or never run.
- **FR-012**: `permits` MUST say whether a consent that is granted holds for a subject and purpose at an instant, and `unconsented` MUST return the uses that no consent covers, so that a policy is a test that fails with them.
- **FR-013**: `plant` MUST record a canary token and `scanCanaries` MUST return where a planted token is found in text, other than the place it was planted in.
- **FR-014**: `propagate` MUST give the highest of a set of labels, and `labelViolations` MUST find each dataset that is labelled lower than the highest of the datasets it is made from at any distance on the lineage, and name what makes it so.
- **FR-015**: `layerReport` MUST say by table, in words, where the physical layer disagrees with the logical one (from `drift`), and give nothing where they agree.

## Out of scope

- Enforcing a contract on an incoming file, or on a stream: a later stage uses the contract; the codecs of `commons/integrations` read the messages.
- Generating a contract from a table, or a table from a contract: the layers already do the second, and the first is `adopt`.
- Reports for an auditor in the format of a framework: `commons/grc`'s.

## Edge cases

- Instants are compared as the text they are written in; write them with `toISOString()`, per FR-009.
- A period whose next ones are all closed has no place for an adjustment, per FR-010.
- A control that was due and recorded `not_run` is failing, per FR-011.

## Assumptions

- The tables are made by `bind` from the model on any of SQLite, DuckDB and PostgreSQL; the fixtures of the tests are synthetic.

## Open questions

- **OQ-1**: Whether the compatibility matrix should be data (a table) so that a project can tighten it, or stay a constant of the library.

## Key entities

- **Data contract** - what a dataset promises, in one version.
- **Period** - a span of time that takes changes until it is closed.
- **Control** - what must hold, with the history of its runs.
- **Consent** - a subject's permission for a purpose between two dates.

## Success criteria

- **SC-001**: Whether two versions of a contract break a reader, which period a late change belongs to, which controls are failing or overdue and which uses had no consent are each one call, and a derived dataset cannot be labelled lower than its sources without a finding.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
