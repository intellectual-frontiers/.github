# Feature Specification: Findings: the lifecycle

**Spec ID:** 0004-findings-lifecycle
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The life of a finding as an item of Planning (commons planning 0037-planning), of its item kind `finding`: its history is Planning's events, which say who did what and why, and its state is Planning's fold of them, never stored; what this specification says is how a finding and what is done with it are put in Planning's words, how the state of an item is read back as a security review says it, the retest that settles a claim of a fix, and the controls a finding is evidence against. No kind of item, event or term is added to Planning's.

## Requirements

- **FR-001**: A finding MUST be opened as an item of the kind `finding` with the origin `derived` (so that it is open at once), the severity of Planning that matches the report's (`critical` and `high` are `error`, `medium` `warning`, `low` and `info` `note`) with the report's own word kept as the source severity, a label for the tool, the rule, the severity, the asset and each weakness and vulnerability it names, its fingerprint, rule, asset, place, tool and file in the source, the place as its target, the evidence it holds and its fingerprint as an external id; and an action MUST be Planning's events: a triage `confirmed` a comment and a label, a false positive a comment and the closing `not-planned`, a duplicate a comment and the closing `duplicate`, an acceptance a comment, a label and a deferral until its day, a claim of a fix a comment and a label, a retest that finds it a comment and the removal of the claim and one that does not the closing `completed`, and a reopening a comment, the removal of the labels of what was closed and Planning's reopening.
- **FR-002**: The state of an item MUST be read back, at an instant, as: closed `completed` is `verified`, `not-planned` a `false-positive`, `duplicate` a `duplicate`; deferred with the label of an accepted risk is `accepted` until its day, the last day included, and `open` again after it, saying the acceptance lapsed; and otherwise a claimed fix is `fixed`, a reopening `reopened`, a triage `confirmed` and else `open`; the states in which a finding still counts against the system are `open`, `confirmed`, `reopened` and `fixed`. A deferral that carries the label of an accepted risk but no day (Planning keeps a deferral's day optional, commons 0037-planning OQ-12) is not an acceptance: it is `open`, with the acceptance lapsed, so that no risk is accepted without an end.
- **FR-003**: An action MUST be refused, with every reason, where it does not say who, when (an instant, not in the future) or, for a triage, an acceptance or a reopening, why; where an acceptance has no end day, ends on or before the day it is made, or lasts more than a year; where a duplicate does not say of which finding; where the finding does not exist; and where it cannot follow the state of the finding.
- **FR-004**: A retest MUST give, for each finding claimed fixed, `still-present` where the new report has its fingerprint and `not-found` where it does not, and for no other finding: a report is not a complete picture, and a finding absent from it is not thereby fixed.
- **FR-005**: The controls of NIST SP 800-53 a finding is evidence against MUST be RA-5 for every finding, SI-2 for one that names a CVE, and those the table of weaknesses gives for its CWE; and the rows of an asset's posture MUST be `fail` for a finding that still counts, `accepted` for one whose risk is accepted, and none for a false positive, a duplicate or a verified fix.

## Acceptance scenarios

1. **Given** a finding claimed fixed and a retest that finds it, **When** its state is read, **Then** it is `reopened`, per FR-001 and FR-002.
2. **Given** an acceptance until a day that has passed, **When** its state is worked out, **Then** it is `open` and the acceptance lapsed, per FR-002.

## Out of scope

- Where the events are kept (the tenant's Git, signed, as Planning's records) and the commands that add to them.

## Edge cases

- A retest of a finding not claimed fixed is no action, per FR-004.

## Assumptions

- The table of weaknesses is the estate's own reading of the standard, and may be refined by adding.

## Open questions

- None.

## Key entities

- **Item**, **View**, **Action**, **Row**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
