# Feature Specification: Machine probe state

**Spec ID:** 0005-machine-probe-state
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The state of a machine as it is kept in Git: what was observed of it and how each policy judges it, with nothing that changes only because the time does, written so that a machine that did not change gives the same bytes and so no change in Git; and the structured difference of two states. When the state was looked at is not part of it: that is the journal's, which records every look.

## Requirements

- **FR-001**: `stateOf` MUST give the keyed records of the observation (`observedState`) and the finding of each policy, and MUST NOT hold the time of the observation, the version of the probe, a counter that changes on its own (the memory, the disk in use, the updates waiting) or the policy about how old the observation is.
- **FR-002**: `stateText` MUST give JSON with the keys of every object in order, indented by two spaces, ending with a line break, the same text for the same state whatever the order the keys were made in; and `readState` MUST give back the state of a text that `stateText` made and MUST refuse a text that is not JSON or not a state, saying which.
- **FR-003**: Two observations of a machine that did not change, taken at different times, MUST give the same text.
- **FR-004**: `diffStates` MUST say a state equal to itself, and between two states MUST name each key added, removed and changed (with the path of the field and both values) as `grc` tells drift, and each policy whose finding moved with the finding before and after, in the order of the policies' ids; and a difference of the time alone MUST NOT be one.

## Acceptance scenarios

1. **Given** the output of a real probe, **When** its state is made, **Then** it holds no time, per FR-001.
2. **Given** the same machine observed an hour later with other counters, **When** the two states are written, **Then** the texts are equal, per FR-003.
3. **Given** a machine whose firewall was turned on, **When** the two states are compared, **Then** the path and both values are named and the policy moved from `fail` to `pass`, per FR-004.

## Out of scope

- Keeping the state in Git and journaling each look: the evidence branch and the journal.

## Edge cases

- A policy that exists in one state and not in the other moves from or to nothing, per FR-004.

## Assumptions

- A policy about the age of an observation is judged by the journal, which knows when the machine was looked at.

## Open questions

- None.

## Key entities

- **Machine state** - the records observed of a machine and the finding of each policy, with no time.

## Success criteria

- **SC-001**: A machine that did not change gives no difference in Git, however often it is observed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
