# Feature Specification: Evidence against assessment objectives

**Spec ID:** 0002-objective-evidence
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** An assessor of SP 800-171 (CMMC Level 2) or SP 800-53 determines each assessment objective of SP 800-171A or SP 800-53A, by examining, interviewing and testing, and a requirement is met when its objectives are. This library records the evidence against each objective, says how each objective and requirement stands from it, and keeps the rule that a tool's result supports an objective and a person determines it. It reads the objectives from a framework's data (commons catalog-nist-sp800) and knows nothing of any one company.

## Requirements

- **FR-001**: A record of evidence MUST name its framework and objective, a method (`examine`, `interview` or `test`), a result (`pass`, `fail` or `not-applicable`), who made it (a `tool` or a `person`, and a name), when it was gathered (an instant), a source where it can be looked at, and whether a person determines the objective from it; it MAY say until when it holds and carry a note. A record MUST be refused where a tool determines, where `not-applicable` is not a person's word with a reason in the note, where its validity does not end after it began, or where its source or its maker is not named.
- **FR-002**: An objective's standing MUST be worked out from the records of it at an instant: within one source and method only the latest record counts; with none the standing is `no-evidence`; where every record has expired it is `stale`; where any live record fails it is `not-met`; where a person's determining record passes it is `met`, and where a person's determining record says not-applicable it is `not-applicable`; otherwise, with a live passing record, it is `supported`.
- **FR-003**: A requirement's roll-up MUST be worked out from the standings of its objectives and shown with their counts: `not-met` where any objective is not met; `no-evidence` where none has evidence; `not-applicable` where all are; `met` where every objective is met or not applicable; otherwise `partial`. The assessment of a framework MUST give no single percentage.
- **FR-004**: The assessment MUST list, apart, the evidence that names an objective the framework does not have (a stray) and MUST NOT count it.
- **FR-005**: The results of a machine's policies MUST give evidence by binding: each policy bound to objectives gives one record of the method `test` by a tool for each, from a result that passes or fails; a result that waits, that warns, or whose risk is accepted gives none; and no such record determines an objective.
- **FR-006**: The assessment and the binding MUST be pure functions of their inputs: the same inputs give the same output, with no clock and no network (the instant is an input).
- **FR-007**: A record MUST be a JSON5 file of its own, at `<framework>/<objective>/<id>.json5` (the brackets of an objective written `_a`), so that Git shows each piece of evidence as a change; a store MUST read the records under a folder in the order of their paths, reporting each file that is not a valid record without losing the others, and MUST refuse to write over a record that is there.

## Acceptance scenarios

1. **Given** an objective with a passing test by a probe, **When** no person has determined it, **Then** it is `supported`; **When** an assessor records a determining examine that passes, **Then** it is `met`, per FR-002 and FR-005.
2. **Given** an objective with a person's pass and a later failing test from the same source, **When** it is worked out, **Then** it is `not-met`, per FR-002.
3. **Given** a requirement whose objectives are met but for one with no evidence, **When** it is rolled up, **Then** it is `partial` with the counts, per FR-003.

## Out of scope

- Scoring schemes (the DoD Assessment Methodology's weights, SPRS): a later library or plugin that reads this one.
- Which policies bind to which objectives: data of the program that uses the library.
- Reports and sites made from the assessment.

## Edge cases

- Two records of one source and method at the same instant: the greater id counts, per FR-002.
- A record that expires on the instant asked about is not live, per FR-002.

## Assumptions

- An instant is written `YYYY-MM-DDThh:mm:ssZ`, so that instants compare as text.

## Open questions

- None.

## Key entities

- **Evidence**, **Objective**, **Standing**, **Roll-up**.

## Success criteria

- **SC-001**: For each objective of SP 800-171A or SP 800-53A it is plain what supports it, what a person has determined, and what is missing.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
