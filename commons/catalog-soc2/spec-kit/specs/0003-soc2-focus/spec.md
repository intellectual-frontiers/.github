# Feature Specification: SOC 2 matters to show

**Spec ID:** 0003-soc2-focus
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Under each criterion the AICPA prints points of focus: the several things an assessor looks for. Those are the AICPA's copyright and were not read, so they are not carried (commons catalog-soc2 0002-soc2-package FR-005). Reports, evidence and crosswalks still need a finer grain than the criterion, so the package holds our own list of the matters an organization shows for each criterion, shaped like the points of focus (several under each criterion) and written from our understanding of what the criterion is about. It is not a reading of the points of focus.

## Requirements

- **FR-001**: The package MUST hold a second `grc.framework`, `soc2-focus` (version `2017`), whose controls are the matters to show: each has the identifier `<criterion>-<n>` (for example `CC6.1-1`), a title, a statement and its criterion as its family. Every one of the 61 criteria of `soc2-tsc` MUST have at least two matters, and no matter may belong to a criterion that `soc2-tsc` does not hold.
- **FR-002**: The matters MUST be a source file of the package (`src/governance/focus.ts`) whose SHA-256 the manifest records beside that of the criteria, and the generator MUST make the file of the framework from it and find a difference with `--check`.
- **FR-003**: The manifest MUST carry a notice that says the points of focus of the AICPA are not carried and were not read, that `soc2-focus` is our own list and not a reading of them, and that a person who holds the publication decides which of its points of focus a matter answers.
- **FR-004**: No matter may be a sentence of the AICPA's publication or long enough to be a transcription of a passage; each statement MUST be a short sentence of ours, and no identifier of a matter may repeat.
- **FR-005**: Every identifier of a matter MUST be a token that OSCAL accepts as an identifier.

## Acceptance scenarios

1. **Given** the matters, **When** the package is made, **Then** `soc2-focus` has 122 matters under the 61 criteria and `CC6.1-1`, `CC6.1-2`, `P6.6-2` and `A1.3-2` are among them, per FR-001.
2. **Given** the manifest, **When** its notice is read, **Then** it says the points of focus were not read, per FR-003.

## Out of scope

- The AICPA's points of focus and its illustrative controls.
- A mapping of a matter to a point of focus: a decision of a person who holds the publication.

## Edge cases

- A matter whose criterion is not in `soc2-tsc` is a failure of the test, per FR-001.

## Assumptions

- Each criterion is about two matters wide; a criterion that needs more is a later change of the source.

## Open questions

- Whether a person who holds the AICPA's publication will map each matter to its points of focus, as a crosswalk.

## Key entities

- **Matter to show**, **Criterion**, **Package**.

## Success criteria

- **SC-001**: A report or a crosswalk can name a matter under a criterion by its identifier, without the AICPA's text.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
