# Feature Specification: AnyFS Mirror: governance

**Spec ID:** 0002-mirror-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a mirror does when a secondary does not take a change the primary took, and what it reports of the stores it keeps in step.

## Requirements

- **FR-001**: The ways a mirror may answer a secondary that did not take a change MUST be a closed list of two, `record` (answer as the primary did and record the path as lagging) and `report` (record the path as lagging and answer that the secondary did not take the change), and the default MUST be `record`.
- **FR-002**: Each way MUST be describable in a sentence, and a text MUST be tested for whether it names one.
- **FR-003**: The drift of a secondary from the primary MUST be three lists in the order of the paths, the paths it lacks, the paths it holds at another revision and the paths it holds that the primary does not, and a secondary MUST be in step exactly where the three are empty.
- **FR-004**: A lag MUST name the secondary, the path and the reason, and a drift and a lag MUST each be said in one sentence.
- **FR-005**: What a reconcile did for a secondary MUST name the drift it started from, the paths it copied, the paths it removed and the paths it could not make the same with the reason for each.

## Acceptance scenarios

1. **Given** the policies, **When** the list is read, **Then** it is `record` and `report` and the default is `record`, per FR-001 and FR-002.
2. **Given** a drift with nothing in it, **When** it is asked whether it is in step, **Then** it is, and the sentence says so, per FR-003 and FR-004.

## Out of scope

- Merging replicas: a mirror has one primary that decides.

## Edge cases

- A text that is not the name of a policy is not one (FR-002).

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Policy**, **Lag**, **Drift**, **Reconciled**.

## Success criteria

- **SC-001**: Every report is a value a program can read and a sentence a person can read.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
