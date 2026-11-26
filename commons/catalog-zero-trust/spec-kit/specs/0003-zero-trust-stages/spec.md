# Feature Specification: Zero trust stages from readings

**Spec ID:** 0003-zero-trust-stages
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** How the stage of a function of the CISA maturity model is computed from readings (commons 0047-zero-trust FR-020 and FR-022), as data and as a pure function of the catalog: the thresholds, and the stage that a set of indicators and the ages of their readings give. The model describes its stages in words and gives no numbers, so the thresholds are ours and are published with the catalog.

## Requirements

- **FR-001**: The catalog MUST publish the thresholds of the three stages a reading can show (initial, advanced, optimal) as data: for each, the share of the indicators that need a reading and the longest age in days of a reading; the traditional stage MUST have none.
- **FR-002**: The thresholds MUST be monotone: a later stage MUST NOT ask for a smaller coverage or a longer age than an earlier one, and the age of every stage MUST be a positive whole number of days.
- **FR-003**: The stage of a function MUST be computed by a pure function of its indicators and the thresholds, with the age of each reading given as an argument and no clock: a function none of whose indicators has a reading MUST be `unmeasured` and never `traditional`; a function with some reading MUST be at least `traditional`; and it MUST be at the highest stage for which that stage has an indicator of its own and the indicators of every stage up to it have enough readings within that stage's age.
- **FR-004**: The computation MUST be monotone under refresh: a reading that is made, or that is replaced by a younger one, MUST NOT lower the stage of any function.
- **FR-005**: A stage that is computed MUST be shown with the statement that it was computed by the thresholds of the catalog, which are ours and not the model's, and MUST NOT be shown as a judgement of the model or of an assessor.

## Acceptance scenarios

1. **Given** no reading, **When** the stage is computed, **Then** it is `unmeasured`, per FR-003.
2. **Given** an initial indicator read three days ago, **When** the stage is computed, **Then** it is `initial`; **Given** the same reading 200 days old, **Then** it is `traditional`, per FR-003.
3. **Given** a younger reading in place of an older one, **When** the stage is computed again, **Then** it is not lower, per FR-004.

## Out of scope

- Which properties are the indicators of a function and of a stage: the property sets of the pillars (commons 0047-zero-trust FR-025).
- The thresholds of the Department of Defense model: not read.

## Edge cases

- A stage with no indicator of its own cannot be reached, per FR-003.
- A reading with a negative age is not a reading, per FR-003.

## Assumptions

- The thresholds are a proposal until the owner confirms them (commons 0047-zero-trust, decision 4 of the plan).

## Open questions

- Whether the coverage of the advanced and optimal stages should be below 1 for functions with many indicators: left for the owner with the property sets.

## Key entities

- **Threshold**, **Indicator**, **Computed stage**.

## Success criteria

- **SC-001**: A pillar can show its stage, its coverage and the age of its readings without any figure that is the model's own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
