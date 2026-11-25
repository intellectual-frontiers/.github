# Feature Specification: Workload runs

**Spec ID:** 0005-workload-runs
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** How a run is recorded and read, in every form: a work order is a planning item of kind `task` labelled with the workload, each fact of the run is a planning event in one envelope that names its form, the state of a run is a fold of its events and never a stored fact, a dry run says what would happen with no effect, and a workload is a unit that contributes to the workbench lazily.

## Requirements

- **FR-001**: A work order MUST be a planning item of the kind `task` carrying the label `workload:<id>` (the id of the workload it runs), the library MUST add no kind of item, and the id of a run MUST be the id of its work order.
- **FR-002**: A run event MUST be carried as a planning `commented` event whose body is `workload.event/1 ` and a canonical JSON object that names the form it is of and holds the event of that form; the envelope MUST be decoded at the boundary into its form and a payload, a body that is not an envelope or that names a form that has no code MUST be refused, and the payload MUST be decoded by the form into its own closed union.
- **FR-003**: An actor of a run event MUST be the actor of planning: an agent acts on behalf of a person, and the fold MUST take the answer to a gate as passed only where its actor is a person.
- **FR-004**: The state of a run MUST be the fold of its events in the order of their ids: the same events in any arrival order give the same state, an event repeated is one event, an event of another item or of another form is left out, and no state MUST be stored; the fold MUST be pure.
- **FR-005**: A dry run MUST return, with no effect and no event, the plan of the nodes in order with the derived autonomy of each, the preconditions the workbench would evaluate against given facts for the needs of the nodes that read and of the workload only (a dry run MUST NOT demand what a node that applies something needs), and the finding of every check; and a workload with a finding MUST give no plan.
- **FR-006**: A workload MUST be a unit contribution of the workbench: `workloadContribution(workload, nodes, selected)` MUST return the contribution for the nodes selected for a run, namely the needs of the workload and of each selected node and nothing of a node not selected, so that a node behind a branch that is not taken, or a fan out with no member, needs nothing, and the workbench's `compose` MUST compose it lazily for the unit named for the workload.

## Acceptance scenarios

1. **Given** a workload, **When** its work order is opened, **Then** it is a task labelled `workload:<id>` and the kinds of item are the four of planning, per FR-001.
2. **Given** an event of a run, **When** it is written, **Then** its body starts with the prefix, names its form and is the same bytes each time, and a body that is not one is refused, per FR-002.
3. **Given** an answer to a gate by an agent, **When** the run is folded, **Then** the gate is not passed and the answer is refused, per FR-003.
4. **Given** the events of a run in two orders and with a repeat, **When** they are folded, **Then** the state is the same, per FR-004.
5. **Given** a starter workload, **When** it is planned, **Then** the nodes have their autonomy and the preconditions are the workbench's findings, and a workload with a finding gives none, per FR-005.
6. **Given** a workload with a branch and a fan out, **When** its contribution is made for the nodes selected, **Then** only what they need is composed, per FR-006.

## Out of scope

- The events of a plan other than a run: the planning library's.
- The events of each form and what each fold makes of them: the form's own specification (0008-form-runbook).

## Edge cases

- Two events with the same id are one event, per FR-004.
- An event of a run that names a node the workload has not is kept in the fold as an unknown node, per FR-004.

## Assumptions

- The clock and the ids of events are given by the host (a port), so that the fold and the tests are pure.

## Open questions

- None.

## Key entities

- **Run** - one execution of a workload, recorded on a work order.
- **Work order** - the planning `task` item a run is of.
- **Dry run** - what would happen, said with no effect.
- **Envelope** - the body of a planning comment that names the form of the event it holds.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Planning's own specification (`commons/planning/spec-kit`, 0001 to 0005, read in this repository) | An item has a kind of the closed list `issue`, `task`, `todo` and `finding`; the history is events and the state a fold; an agent acts on behalf of a person; a person alone confirms | `src/governance/actor.ts`, `event.ts`, `vocab.ts` |
| W3C PROV-O (read 2026-11-25) | A run is an activity; the run's agent acts on behalf of a person | Section 4.1 |
| The workbench evaluation (`commons/workbench/src/logical/evaluate.ts`) | The preconditions of a dry run are the requirements of the workbench evaluated against facts | The file itself |

## Success criteria

- **SC-001**: Every requirement of 0005-workload-runs is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
