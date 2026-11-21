# Feature Specification: Grading evidence

**Spec ID:** 0003-evidence-grading
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Evidence is not all worth the same. A record read from a system by a tool, or a signed record that a system produced, is stronger than a person's word, which is stronger than a screenshot; and all of it weakens with age. An assessor and a buyer should see that a control rests on a screenshot, without being given a percentage. This builds on the records of 0002-objective-evidence.

## Requirements

- **FR-001**: A record MAY say how it was obtained: `machine` (read from the system by a tool), `signed-record` (a record a system signed), `attestation` (a person's word) or `screenshot`; where it does not, a tool's record is `machine` and a person's is `attestation`. A tool's record MUST NOT be an attestation or a screenshot, and the origin MUST be kept in the record's file.
- **FR-002**: The grade of a record at an instant MUST be: `expired` where its validity has ended; otherwise from its origin, `strong` for `machine` and `signed-record`, `moderate` for `attestation`, `weak` for `screenshot`; one grade lower where its age is over the days its origin keeps its grade (machine 7, signed record 90, attestation 365, screenshot 90), and `weak` where it is over twice that.
- **FR-003**: The grade of an objective MUST be that of the best of the latest records of it that do not fail, with the record it rests on, its origin and its age in days; `expired` where only expired records are left; `none` where there is no such record. A failing record does not give a grade.
- **FR-004**: Grades MUST be counted and never averaged or turned into a percentage: the grades of the objectives of a requirement are given as a count of each grade.
- **FR-005**: Grading MUST be a pure function of the records and the instant.

## Acceptance scenarios

1. **Given** an objective whose only evidence is a screenshot a week old, **When** it is graded, **Then** it is `weak` and rests on that screenshot, per FR-002 and FR-003.
2. **Given** a tool's reading of a machine that is ten days old, **When** it is graded, **Then** it is `moderate`, per FR-002.

## Out of scope

- What grade a buyer or an auditor accepts: a policy of theirs.
- Grading controls across frameworks: a report over the grades of their objectives.

## Edge cases

- A record that expires on the instant asked about is `expired`, per FR-002.
- Records of one source and method: only the latest counts, per FR-003.

## Assumptions

- Ages are whole days between the instant the evidence was gathered and the instant asked about.

## Open questions

- None.

## Key entities

- **Origin**, **Grade**.

## Success criteria

- **SC-001**: A control that rests on screenshots or on old evidence is shown as weak or moderate beside a control that rests on a fresh reading of the system.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
