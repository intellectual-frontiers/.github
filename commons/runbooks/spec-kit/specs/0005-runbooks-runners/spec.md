# Feature Specification: Runbooks runners

**Spec ID:** 0005-runbooks-runners
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The physical layer: the executors behind ports. The verb runner calls a registered verb by id, the agent runner decodes the answer of a judge into its type, ask and gate steps are parked as planning events, a store is attached and detached by capability, and a failure runs the compensations. Real input and output is a port; the tests use fakes.

## Requirements

- **FR-001**: The verb runner MUST call a verb only by its registered id with inputs decoded against the verb's declared inputs, MUST refuse an id that is not registered and an effect that exceeds the verb's, and MUST NOT take or run a shell string.
- **FR-002**: The agent runner MUST pass a judge step to an agent port, MUST decode what comes back into the step's declared type, MUST refuse what does not decode, and MUST give the agent port no way to call a verb, so that a judge's result is only a proposal recorded as an event.
- **FR-003**: An `ask` or a `gate` step MUST park the run as a planning event that names the approver and the deadline, and the run MUST go on only when an event of a person answers it; an answer of an agent or a tool MUST be refused.
- **FR-004**: The runner MUST attach a store only where the store offers every capability the attachment needs, MUST refuse with the missing capability otherwise, and MUST detach every store it attached when the run ends, whether it ended well, failed or was parked past its deadline.
- **FR-005**: WHEN a step fails, the runner MUST run the `undo` steps of the steps that succeeded, in the reverse order, and MUST record each compensation as an event.
- **FR-006**: The runner MUST hold the actor to the derived autonomy of each step: an agent MUST NOT apply a `human-only` step (the run parks and hands back), MUST propose and wait for an answer on an `agent-proposes` step, and MAY apply the others; a person MAY apply any step except one that needs another person.
- **FR-007**: The runner MUST write every fact of a run as an event of planning on the work order, as one `commented` event whose body is a run event decoded at the boundary, and MUST keep no state that is not the fold of those events.
- **FR-008**: The program of the library MUST be `runbooks`, with the verbs `check`, `plan`, `project`, `explain` and `verb`; `verb <id>` MUST check the id against the registry and refuse an id that is not registered with its code, and for a registered id MUST say that a host registers the binding that runs it (a verb is bound by the host that has the pinned package) and exit non-zero until it does; and every refusal MUST print the code and the fix.

## Acceptance scenarios

1. **Given** a step that names an unregistered verb id, **When** it is run, **Then** it is refused and nothing is called, per FR-001.
2. **Given** a judge whose agent answers with a wrong shape, **When** it is run, **Then** the answer is refused and nothing is applied, per FR-002.
3. **Given** a gate, **When** it is run and an agent answers it, **Then** the answer is refused, and a person's answer lets the run go on, per FR-003.
4. **Given** a store that lacks `history`, **When** it is attached for a step that needs it, **Then** it is refused and names `history`, per FR-004.
5. **Given** a run whose fourth step fails, **When** it is run, **Then** the undo of the third step runs, then of the second, per FR-005.
6. **Given** an agent and a destroy of a durable store, **When** the run reaches it, **Then** the run is parked and hands back, per FR-006.
7. **Given** a finished run, **When** its state is asked, **Then** it is the fold of its events and nothing else, per FR-007.
8. **Given** an unknown verb id and a registered one with no binding on the command line, **When** `runbooks verb` is run, **Then** each prints its code or its reason and exits non-zero, per FR-008.

## Out of scope

- Machines for a disposable workshop (`commons/lab`, a later slice) and the storage of events beyond memory: the port is given, a file store is not.

## Edge cases

- A deadline that passes with no answer is an event, `expired`, the run ends as parked and every store it attached is detached, per FR-003.
- A detach that fails is recorded and the run reports it, because a store left attached makes the workshop not disposable, per FR-004.

## Assumptions

- The planning store that holds the events is a port the host gives; the tests use a store in memory.

## Open questions

- None.

## Key entities

- **Port** - what the host provides: verbs, an agent, a store of events, a catalog of stores.
- **Park** - stop a run at a step that needs a person and record who and by when.
- **Compensation** - the `undo` that takes back a step that succeeded.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| W3C PROV-O (read 2026-11-25) | The run is recorded as events of an activity with its agent and the person the agent acts for; the run's actor is the actor of planning, which already states `prov:actedOnBehalfOf` | Section 4.1, entry `prov:actedOnBehalfOf` |
| Saga pattern (Garcia-Molina and Salem, 1987) | On a failure, the compensations of the steps that succeeded run in the reverse order | Named from the literature, not read in this session; no section or IRI is given |

## Success criteria

- **SC-001**: Every requirement of 0005-runbooks-runners is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
