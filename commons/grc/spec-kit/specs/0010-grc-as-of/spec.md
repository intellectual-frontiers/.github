# Feature Specification: GRC as-of view

**Spec ID:** 0010-grc-as-of
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** The state of every control at an instant, computed only from what was recorded up to that instant, so that an auditor can ask what was true on a day and get the same answer however many events came after.

## The view

- **FR-001**: `asOf(input, at)` MUST be a pure, deterministic function that gives, for every control of the frameworks of the input, its status, coverage, freshness, the exceptions in force and its risk at the instant `at`, with the head and length of the ledger up to it; an `at` that is not an ISO 8601 instant MUST be an error value.
- **FR-002**: Events after the instant MUST be ignored: a result counts where its `observedAt` is not after `at`, a risk and a ledger entry where its `createdAt` is not after `at`, an exception where it is granted at or before `at`; the ledger up to the instant MUST be the longest prefix, in sequence order, of entries created at or before it.
- **FR-003**: Expirations MUST be evaluated at the instant: an exception is in force where `grantedAt <= at < expiresAt`, freshness is that of `freshness(newest, duration, at)`, and a risk is due where its `reviewBy` is not after `at`.
- **FR-004**: The status of a control MUST be the `join` of the newest results of the checks that show it, with the exceptions of the instant applied, `gap` where none shows it; the coverage MUST be `coverage` at the instant over the results up to it; the freshness MUST be the worst of its checks' (`unobserved` where there is none); the risk MUST be the highest level of the risks up to the instant that name the control.
- **FR-005**: The view MUST be the same for any order of the results, entries, exceptions and risks, and `currentView(input, now)` MUST be the same computation without the filter of FR-002.
- **FR-006**: The as-of view at the end of the ledger, that is at the latest instant any event of the input has, MUST equal the current view at that instant, and adding an event later than `at` to the input MUST NOT change the as-of view at `at`.

## Scenarios

- **Given** a failing result on the 10th and an exception granted on the 12th, **When** the view at the 11th is made, **Then** the control is `fail` and no exception is in force, per FR-002.
- **Given** an exception that expires on the 20th, **When** the view at the 20th is made, **Then** it is not in force, per FR-003.

## Out of scope

- Where the events are read from: the caller gives them.

## Edge cases

- An instant before every event: every control is `gap` and `unobserved`, per FR-004.

## Assumptions

- The recording time of an event is its own instant, as above.

## Open questions

- **OQ-1**: Whether a bitemporal view (recorded versus observed) is needed.

## Key entities

- **As-of view**, **Control state**.

## Success criteria

- **SC-001**: The same events give the same view at an instant, in any order and with any later events.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
