# Feature Specification: A policy gate for changes

**Spec ID:** 0002-policy-gate
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Policy as code, applied where a change is made: before an estate, a cloud plan or a set of endpoints is changed, the rules of the organization are run over what the change adds or alters, and the change goes on only where nothing that blocks is left unwaived. A person may waive a rule for a subject, for a reason and a time, and the waiver is a record, not a switch. The library is the rules, the evaluation and the verdict; reading a plan or an estate into subjects, and acting on the verdict in a merge or a pipeline, belong to the programs that use it.

## Requirements

- **FR-001**: A subject MUST have an id, a kind and attributes of plain values (text, numbers, booleans or lists of text); a change MUST be the subjects as they were and as they will be.
- **FR-002**: Only the subjects a change adds or alters MUST be checked: a subject in `after` that `before` lacks, or has with another kind or other attributes; a subject only in `before` (removed) or unchanged MUST NOT be.
- **FR-003**: A rule MUST have an id, a title, a severity (`block` or `warn`), optionally the kinds it applies to and the controls it gives evidence for, and a check that gives the problems of a subject; a rule MUST be evaluated only on the kinds it names, and a check that throws MUST be a violation of its rule and never a pass.
- **FR-004**: A waiver MUST name a rule, a subject, a reason, the person who granted it and an instant it ends at; a violation with a waiver for its rule and subject that has not ended MUST NOT block and MUST be listed as waived with the waiver; a waiver that has ended, or that has no reason, no person or no valid end MUST NOT count, and a waiver no violation used MUST be listed as unused.
- **FR-005**: The verdict MUST pass only where no violation of severity `block` is left unwaived; it MUST list the blocking violations, the warnings, the waived ones, the unused waivers and the number of subjects checked, each list in a stable order.
- **FR-006**: The library MUST give builders for rules (`require`, `forbid`, `oneOf`) and a baseline of rules that holds for any estate: no cleartext on an endpoint, no administrative port open to the world, storage encrypted at rest, an owner named, a certificate not within 30 days of its end, no floating image reference.
- **FR-007**: The evaluation MUST be a pure function of the change, the rules, the waivers and the instant.
- **FR-008**: The verdict MUST be given as SARIF 2.1.0: a result for each violation (`error` where it blocks, `warning` where it warns) at its subject, and a waived violation as a suppressed result with the waiver's reason.

## Acceptance scenarios

1. **Given** a change that adds a database open to `0.0.0.0/0` on port 5432, **When** it is evaluated, **Then** the verdict does not pass and names the rule, per FR-005 and FR-006.
2. **Given** a waiver for that rule and subject that ends tomorrow, **When** it is evaluated today, **Then** the verdict passes with the violation listed as waived; **When** it is evaluated after the waiver ended, **Then** it does not pass, per FR-004.

## Out of scope

- Reading a plan, an estate or a repository into subjects.
- Where waivers are kept and how they are approved (the program's change control).
- Rules of one organization: they are theirs, written as code with these builders.

## Edge cases

- A subject that breaks one rule twice is two violations, per FR-005.
- A removed subject is not checked even where it would break a rule, per FR-002.

## Assumptions

- Instants are written `YYYY-MM-DDThh:mm:ssZ`, so that they compare as text.

## Open questions

- None.

## Key entities

- **Subject**, **Rule**, **Waiver**, **Violation**, **Verdict**.

## Success criteria

- **SC-001**: A change that breaks a blocking rule does not go on unless a person has waived it, and CI shows each violation where a developer looks.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
