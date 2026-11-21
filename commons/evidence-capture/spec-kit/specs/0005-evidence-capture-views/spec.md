# Feature Specification: Reading back what was captured

**Spec ID:** 0005-evidence-capture-views
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The evidence of a fleet is kept on a branch of Git; this is how it is read back and attested: the structured difference of a state, the changes over a period, what was known at an instant, whether the journal holds, the timer that runs the collector, and the seal and export with a signer's key, over a store and a policy that the caller gives. This library knows no kind of machine and no layout of a repository.

## Requirements

- **FR-001**: Spans MUST be read as `30m`, `7d`, `1h`, `30s` or ISO 8601 and shown in the largest whole unit (`1h`, `90m`, `1d`, and milliseconds where none is whole).
- **FR-002**: The difference of the state of an asset MUST be the last change by default (the state before the newest and the newest), or between two revisions given as commits or instants, or since a span (the state at the instant that far back and the newest); it MUST be nothing where there is nothing to compare, and an error naming the branch where the asset has no state; what a state is and how two differ MUST be the caller's codec.
- **FR-003**: The changes of every asset's state MUST be listed newest first, each with its difference from the state before it and marked as the first where there is none, since an instant or span or all of them.
- **FR-004**: What was known at an instant MUST be the state of each asset as the branch held it then and the last look at it that the journal holds up to then with its age, and a batch committed later MUST NOT change it; an instant before anything was kept MUST give nothing.
- **FR-005**: Whether the journal holds MUST be answered with its entry count and its head, or the first entry that does not follow, and a branch that does not exist MUST say that nothing was captured.
- **FR-006**: The one timer that runs the collector MUST fire in the largest whole step of the clock (1, 2, 3, 4, 5, 6, 10, 12, 15, 20 or 30 minutes) that is not longer than the shortest cadence of the capture policy, every hour where the shortest is an hour or more, MUST give the freshness window of the policy, and MUST be planned for a scheduler (systemd, launchd or Task Scheduler) with the argument vector and the folder the caller gives; installing and removing it MUST be by the scheduler code of the commons.
- **FR-007**: A seal MUST be made only with a key that is a signer's of the fleet (by its public key) and, where the policy names one signer for the seal, only that one; an export MUST be refused without a key where the policy asks for a seal with an export, and MUST be signed with such a key otherwise.
- **FR-008**: A bundle MUST be verified offline with the signers of a file (a JSON list of `{name, role, key}` or an object with `signers`, refused where it is not one), or with its own where no file is given, and MUST NOT verify with signers that did not sign it; the seals of the journal MUST be reported against the signers with when the last good seal was made.

## Acceptance scenarios

1. **Given** a state that changed twice, **When** the difference is asked with no revision, **Then** it is the last change, per FR-002.
2. **Given** a key that is not a signer's, **When** the journal is sealed with it, **Then** it is refused, per FR-007.

## Out of scope

- Where the policy, the signers and the store are kept: the program's.
- What a state is: the codec.

## Edge cases

- A file of signers that is not a list: refused with its name, per FR-008.

## Assumptions

- The branch holds the layout of the collector (`state/<asset>.json`, the journal and the seals).

## Open questions

- None.

## Key entities

- **State codec**, **Timer**, **Signer**.

## Success criteria

- **SC-001**: What was known on any date is answered from the branch, and a stranger verifies a bundle offline.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
