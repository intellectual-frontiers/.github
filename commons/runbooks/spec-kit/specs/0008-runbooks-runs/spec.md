# Feature Specification: Runbooks runs

**Spec ID:** 0008-runbooks-runs
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** How a run is recorded and read: a work order is a planning item of kind `task`, each fact of the run is a planning event, the state of a run is a fold of its events and never a stored fact, and a dry run says what would happen with no effect.

## Requirements

- **FR-001**: A work order MUST be a planning item of the kind `task` and the library MUST add no kind of item; the id of a run MUST be the id of its work order.
- **FR-002**: A run event MUST be one of `started`, `step-started`, `step-succeeded` (with the digests of its evidence and what it gave for later steps to read), `step-failed`, `parked` (with the approver and the deadline), `answered`, `proposed` (the decoded output of a judge), `attached`, `detached`, `compensated`, `expired` and `finished`, carried as a planning `commented` event whose body is `runbooks.run-event/1 ` and a canonical JSON line, and decoded at the boundary into the closed union or refused.
- **FR-003**: An actor of a run event MUST be the actor of planning: an agent acts on behalf of a person, and the fold MUST take an `answered` event of a gate as passed only where its actor is a person.
- **FR-004**: The state of a run MUST be the fold of its events in the order of their ids: the status of each step, the stores attached, whether the workshop is disposable (computed), what is parked and for whom, and whether the run is finished; the fold MUST be pure and give the same state for the same events in any arrival order, and no state MUST be stored.
- **FR-005**: A dry run MUST return, with no effect and no event, the plan of the steps in order with the derived autonomy of each, the preconditions the workbench would evaluate against given facts for the needs of the steps that read and of the runbook only (a dry run MUST NOT demand what a step that applies something needs), and the finding of every check; and a runbook with a finding MUST give no plan.
- **FR-006**: A run MUST be refused its `finished` event while a store is attached or a step is parked.
- **FR-007**: A runbook MUST be a unit contribution of the workbench: `runbookContribution(runbook, selected)` MUST return the contribution for the steps selected for a run, namely the needs of the runbook and of each selected step and nothing of a step not selected, so that a step behind a `branch` that is not taken, or an `each` with no member, needs nothing, and the workbench's `compose` MUST compose it lazily for the unit named for the runbook.

## Acceptance scenarios

1. **Given** a work order, **When** a run is opened, **Then** the item is a `task` and the run id is its id, per FR-001.
2. **Given** an event with a body that is not a run event, **When** it is decoded, **Then** it is refused, per FR-002.
3. **Given** an `answered` event of a gate by an agent, **When** the state is folded, **Then** the gate is not passed, per FR-003.
4. **Given** the events of a run in two orders, **When** they are folded, **Then** the state is the same, per FR-004.
5. **Given** the starter runbook and facts with no `sqlite3`, **When** a dry run is made, **Then** the plan and the finding of the missing program are returned and nothing is called, per FR-005.
6. **Given** a run with a store attached, **When** it is finished, **Then** the event is refused, per FR-006.
7. **Given** a facts set that lacks the program only a mutating step needs, **When** a dry run is made, **Then** that program is not a finding, per FR-005.
8. **Given** a step that needs a program and a runbook that needs a credential, **When** the contribution is made for a run that selects the step and for one that does not, **Then** the first holds both needs and the second only the runbook's, per FR-007.

## Out of scope

- The events of a plan other than a run: the planning library's.

## Edge cases

- Two events with the same id are one event, per FR-004.
- An event of a run that names a step the runbook has not is kept in the fold as an unknown step and is a finding of the state, per FR-004.

## Assumptions

- The clock and the ids of events are given by the host (a port), so that the fold and the tests are pure.

## Open questions

- None.

## Key entities

- **Run** - one execution of a runbook, recorded on a work order.
- **Work order** - the planning `task` item a run is of.
- **Dry run** - what would happen, said with no effect.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Planning's own specification (`commons/planning/spec-kit`, 0001 to 0005, read in this repository) | An item has a kind of the closed list `issue`, `task`, `todo` and `finding`; the history is events and the state a fold; an agent acts on behalf of a person; a person alone confirms | `src/governance/actor.ts`, `event.ts`, `vocab.ts` |
| W3C PROV-O (read 2026-11-25) | A run is an activity; the run's agent acts on behalf of a person | Section 4.1 |
| The workbench evaluation (`commons/workbench/src/logical/evaluate.ts`) | The preconditions of a dry run are the requirements of the workbench evaluated against facts | The file itself |

## Success criteria

- **SC-001**: Every requirement of 0008-runbooks-runs is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
