# Feature Specification: Evidence capture collect

**Spec ID:** 0003-evidence-capture-collect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** One run of the collector over a branch of Git, with no person: the assets that are due are looked at a few at a time with a time limit each, the state of an asset is kept only where it differs from the one kept so that a machine that did not change is no commit and no diff, each look is journaled as the capture policy says, commits are made when a state changed or the journal's batch interval has run, and the branch is pushed as the policy says, never forced.

## Requirements

- **FR-001**: A run MUST keep the state of an asset on the branch (`state/<asset>.json`) in a commit where it is not yet kept or differs from the one kept, and MUST NOT write it, nor make a commit for it, where it is the same.
- **FR-002**: Each look MUST be journaled as the policy says in an entry chained to the one before it (the last of the branch, or of the entries waiting), the entries MUST wait in a file of the run's own until a commit is made, and a commit MUST be made when a state changed (the waiting entries committed with it) or, with entries waiting, when the journal's commit interval has run since the last journal commit; the commit MUST be made at the instant of the run and MUST name the assets that changed.
- **FR-003**: A look that fails (the asset could not be reached, refused or could not be read, or took longer than the time allowed) MUST be journaled as its kind of failure and MUST NOT change the state kept.
- **FR-004**: A run MUST look only at the assets that are due by their cadences, MUST say which were not, and MUST look at the assets it is told to, due or not, where it is told; at most the number of assets the limits say MUST be looked at at once.
- **FR-005**: A run MUST take a lock and MUST NOT wait for it: where another run holds it, the run MUST end with an error that says so and change nothing.
- **FR-006**: A run MUST push the branch only as the policy says: never, after a commit, or when the interval has run, to the remote the policy names and never forced; a push that fails MUST be an entry `push.failed` of the journal, MUST leave the remote as it was, and MUST be tried again by the next run; the branch checked out by a person MUST NOT be pushed.
- **FR-007**: The journal of the branch MUST be read back in order and verified with the ledger of `grc`, naming the first entry that does not follow, and the entries waiting for a commit MUST survive the end of a run and be committed by a later one.

## Acceptance scenarios

1. **Given** an asset looked at every 15 minutes, **When** it is looked at four times with the same state, **Then** one commit holds its state and the journal's entries are committed in a batch, per FR-001 and FR-002.
2. **Given** a change of state, **When** the asset is looked at, **Then** one commit holds the new state and the waiting entries, per FR-002.
3. **Given** an asset that cannot be reached, **When** it is looked at, **Then** the failure is journaled and the state kept is as it was, per FR-003.
4. **Given** a lock held by another run, **When** a run starts, **Then** it ends with an error and changes nothing, per FR-005.
5. **Given** a remote that has moved, **When** the branch is pushed, **Then** the push fails, the journal says so and the remote is as it was, per FR-006.

## Out of scope

- How an asset is observed: the program that supplies the observer.
- Signing: a seal is a person's act.

## Edge cases

- A run in which nothing is due makes no entry and no commit, per FR-004.

## Assumptions

- The folder of the run's own memory is outside the files the branch tracks.

## Open questions

- None.

## Key entities

- **Run** - one pass of the collector: what was due, what was looked at, what changed and what was committed and pushed.

## Success criteria

- **SC-001**: A collector run every minute makes a commit only when a state changed or the batch interval has run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
