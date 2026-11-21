# Feature Specification: The probe's policies as evidence for controls

**Spec ID:** 0006-machine-probe-grc
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What the policy pack of the probe finds on a machine, as the results of `grc` for the controls of a framework, so that a fleet's posture can be written as an assessment, an OSCAL document or a group view without each program making the bridge again.

## Requirements

- **FR-001**: The library MUST turn what the policies found on each machine into results of `grc`: one for each finding, for the controls it cites that the given framework has (written as their URNs), with the status the probe gave, the finding's detail as the reason and the time the machine was observed; a finding that cites no control of the framework MUST give no result.
- **FR-002**: A machine that was never observed MUST be in scope for every policy of the pack and show none of them: it MUST give a result with the status `gap` for each policy that cites a control of the framework, and MUST NOT give a pass.
- **FR-003**: Each policy that is cited MUST be one check of `grc` that asks one question of a machine, answers for the controls the policy cites and is fresh for a day, however many machines it is found on; and the same findings MUST give the same results and checks.

## Acceptance scenarios

1. **Given** a failing disk-encryption finding, **When** the results are made, **Then** a `fail` for the controls it cites that the framework has, per FR-001.
2. **Given** a machine never observed, **When** the results are made, **Then** every policy is a `gap`, per FR-002.

## Out of scope

- The catalog that holds the controls: a package of its own (commons grc 0008-grc-catalogs).
- Writing the assessment or the OSCAL: `grc`.

## Edge cases

- A control that the framework does not have is left out of the result, per FR-001.

## Assumptions

- A policy's controls are identifiers of the framework they were written against (NIST SP 800-53 Rev 5, per 0004-machine-probe-policies).

## Open questions

- None.

## Key entities

- **Finding**, **Result**, **Check**.

## Success criteria

- **SC-001**: A fleet's observations are evidence for the controls of a framework with no code of the fleet's own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
