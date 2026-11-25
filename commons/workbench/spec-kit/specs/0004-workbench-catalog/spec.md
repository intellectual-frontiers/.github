# Feature Specification: Workbench catalog

**Spec ID:** 0004-workbench-catalog
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The closed catalog of what can go wrong, so that every failure an operator meets has a code, a concept, a fixer and one fix, and a new one is added once, with its check and its test.

## Requirements

- **FR-001**: The catalog MUST have one entry for each code, `E-WB-<CONCEPT>-<KIND>`, each with its concept, a title, what it says, who fixes it (`agent`, `person`, `environment` or `ci`), one fix that may name the requirement's `{name}`, `{minimum}`, `{host}`, `{ref}`, `{folder}`, `{gate}` or `{install}`, and whether it is a safety rule; codes MUST be unique.
- **FR-002**: A finding MUST be a hint before the day the contract's `enforceFrom` names and from that day a warning where the agent can fix it and an error where it cannot, except that a safety rule (a secret in a file) MUST be an error on every day.
- **FR-003**: Asking about a code that is none MUST give the entry `E-WB-UNKNOWN`, which says to classify the failure by adding an entry, a check and a test in one change, and MUST NOT be an error of the question.
- **FR-004**: Evaluation MUST give one finding for each requirement that is not met, with its code, the fix filled in and who fixes it, and none for one that is met; a credential MUST be met by the presence of its name or an alias in the environment, the facts MUST hold names and never values, and a gate MUST NOT be a failure.
- **FR-005**: Versions MUST be compared by their dotted numbers, a suffix after them ignored, so that `26.13.1` is after `26.2.0`.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is checked, **Then** it holds, per FR-001.
2. **Given** the case of FR-002, **When** it is checked, **Then** it holds, per FR-002.
3. **Given** the case of FR-003, **When** it is checked, **Then** it holds, per FR-003.
4. **Given** the case of FR-004, **When** it is checked, **Then** it holds, per FR-004.
5. **Given** the case of FR-005, **When** it is checked, **Then** it holds, per FR-005.

## Out of scope

- Everything of the library that another of its specifications states.

## Edge cases

- A name that is not a name is refused where it is made, never later, per FR-001.

## Assumptions

- The shared checker of Kanon and the manifest check of the libraries are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **Workbench**, **Contract**, **Contribution**, **Dialect**.

## Success criteria

- **SC-001**: Every requirement of 0004-workbench-catalog is proved by a test of the library, with made-up names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
