# Feature Specification: Findings: the lifecycle

**Spec ID:** 0004-findings-lifecycle
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The life of a finding as a log of events that says who did what and why, from which the state of a finding is worked out; the retest that settles a claim of a fix; and the controls a finding is evidence against.

## Requirements

- **FR-001**: The state of a finding MUST be worked out from the events of a log in order, never stored: it is `open` when first read; a triage makes it `confirmed`, `false-positive` or `duplicate`; an acceptance `accepted`; a fix `fixed`; a retest that still finds it `reopened` and one that does not `verified`; and a reopening `reopened`; an event that cannot follow the state the finding is in MUST be ignored and kept apart from the history.
- **FR-002**: An acceptance MUST end on a day, and once the day has passed the finding MUST be `open` again and say that the acceptance lapsed; the states in which a finding still counts against the system are `open`, `confirmed`, `reopened` and `fixed`.
- **FR-003**: An event MUST be refused, with every reason, where it does not say who, when (an instant, not in the future) or, for a triage, an acceptance or a reopening, why; where an acceptance has no end day, ends on or before the day it is made, or lasts more than a year; where a duplicate does not say of which finding; where the finding does not exist; and where it cannot follow the state of the finding.
- **FR-004**: A retest MUST give, for each finding claimed fixed, `still-present` where the new report has it and `not-found` where it does not, and for no other finding: a report is not a complete picture, and a finding absent from it is not thereby fixed.
- **FR-005**: The controls of NIST SP 800-53 a finding is evidence against MUST be RA-5 for every finding, SI-2 for one that names a CVE, and those the table of weaknesses gives for its CWE; and the rows of an asset's posture MUST be `fail` for a finding that still counts, `accepted` for one whose risk is accepted, and none for a false positive, a duplicate or a verified fix.

## Acceptance scenarios

1. **Given** a finding claimed fixed and a retest that finds it, **When** its state is worked out, **Then** it is `reopened`, per FR-001.
2. **Given** an acceptance until a day that has passed, **When** its state is worked out, **Then** it is `open` and the acceptance lapsed, per FR-002.

## Out of scope

- Where the log is kept (the tenant's Git, signed) and the commands that add to it.

## Edge cases

- A retest of a finding not claimed fixed is no event, per FR-004.

## Assumptions

- The table of weaknesses is the estate's own reading of the standard, and may be refined by adding.

## Open questions

- None.

## Key entities

- **Event**, **State**, **Row**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
