# Feature Specification: Form runbook

**Spec ID:** 0008-form-runbook
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The runbook form: a workload that is a procedure. Its nodes, which it calls steps, are a closed sum of eight kinds (a deterministic verb, a check, an ask of a person, a judge that only proposes, a branch, a fan out, a gate and an undo) with the checks, the dry run, the run events and the native runner that hold it. A drill or a game day is a runbook with a schedule trigger and an expected outcome. This form is the former library of runbooks, generalized: what it shares with every form (effects, autonomy, the verb registry, the dialects, the envelope of events) is the core's.

## Requirements

- **FR-001**: A step MUST be one of eight kinds, `verb`, `check`, `ask`, `judge`, `branch`, `each`, `gate` and `undo`, a closed list from which the type of a step is made, and every function over steps MUST be an exhaustive `switch` that ends in `absurd`.
- **FR-002**: A runbook MUST be a workload of the form `runbook`: the head every workload has (an id, a title, a version, a summary, the ids of the workbench requirements it is given, what it needs, its inputs, the stores it attaches, its trigger and optionally the outcome it is expected to have) and its steps in order, and a value of another form MUST NOT decode as a runbook.
- **FR-003**: `decodeRunbook` MUST turn a value that came from outside into a runbook or into every reason it is not one, with no `any`, no non-null assertion and no cast outside the decoders.
- **FR-004**: A `verb` step MUST name a registered verb id, give typed inputs (a literal, a store reference or the output of an earlier step) and declare its effect; a `check` step MUST name what it asserts and the evidence it yields; an `ask` step MUST name the approver and the deadline; a `judge` step MUST name the typed output it decodes into; a `branch` step MUST name the earlier step whose output it reads; an `each` step MUST name what it fans out over; a `gate` step MUST name the authority it needs and the steps it guards; an `undo` step MUST name the step it compensates.
- **FR-005**: Every step MUST carry `spec` citations, each a spec id and a requirement id, and MAY carry `controls`, each the control reference of grc (a framework, a version and a control id, with the URN of grc as its text), so that one step cites the controls of several frameworks by their own ids and a crosswalk of grc can relate them; the library MUST NOT define a control vocabulary of its own.
- **FR-006**: A runbook MUST be refused where a step id is used twice, a step names a step that is not before it, an `undo` compensates a step that is not in the runbook, a `gate` guards a step that is not after it, or a step names a store the runbook does not declare.
- **FR-007**: A runbook and each of its steps MUST declare what they need as requirements of the workbench (a program, a credential, a network host, a Git state, an install or an authority, the `Requirement` type of `@intellectual-frontiers/workbench/governance`), and MUST NOT name an installer or a way to obtain a program: obtaining it is the workbench's port.
- **FR-008**: The autonomy of a step MUST be derived: of a `verb` and an `undo` from its effect by the table of the core, of a `check` `agent-autonomous`, of a `judge` `agent-proposes`, of an `ask` and a `gate` `human-only`, and of a `branch` or an `each` the least autonomous of the steps it holds; a gate only raises the control over the steps it guards.
- **FR-009**: The static check MUST find a step that is not reversible and has neither a gate that guards it nor an `undo` that compensates it (`E-RB-STEP-IRREVERSIBLE-UNGUARDED`), a `mutate` of a `transactional` store with no checkpoint step of that store before it (`E-RB-STORE-NO-CHECKPOINT`) and a store attached and never detached (`E-RB-STORE-NOT-DETACHED`); an effect on an `ephemeral` store is reversible by its nature and is never a finding of the first.
- **FR-010**: The static check MUST find a disposal of a workshop while a store that is not `ephemeral` is attached (`E-RB-WORKSHOP-NOT-DISPOSABLE`).
- **FR-011**: A `judge` that carries an effect MUST be refused with `E-WL-JUDGE-EFFECT`, and a `verb` step that uses the output of a `judge` step as an input and whose derived autonomy is above `agent-proposes` MUST be a finding (`E-WL-JUDGE-APPLIED`) unless a `gate` or an `ask` stands between them, so that nothing a model proposed is applied without a person.
- **FR-012**: The static check MUST find a runbook that is not well formed (`E-RB-RUNBOOK-MALFORMED`).
- **FR-013**: The catalog of the runbook form MUST be closed and its codes MUST be `E-RB-<CONCEPT>-<KIND>`, each with its concept, its fixer, its fix and whether it is a safety rule; what the form shares with every form is a code of the core.
- **FR-014**: The starter runbook `restore-drill` MUST pass the static checks, MUST run on a schedule trigger and MUST say that a run is expected to complete.
- **FR-015**: A run event of a runbook MUST be one of `started`, `step-started`, `step-succeeded` (with the digests of its evidence and what it gave for later steps to read), `step-failed`, `parked` (with the approver and the deadline), `answered`, `proposed` (the decoded output of a judge), `attached`, `detached`, `compensated`, `expired` and `finished`, in the envelope of the core with the form `runbook`, and decoded on entry into the closed union or refused; the fold MUST give the status of each step, the stores attached, whether the workshop is disposable (computed), what is parked and for whom, and whether the run is finished.
- **FR-016**: A run MUST be refused its `finished` event while a store is attached or a step is parked.
- **FR-017**: An `ask` or a `gate` step MUST park the run (by the native runner) as a planning event that names the approver and the deadline, and the run MUST go on only when an event of a person answers it; an answer of an agent or a tool MUST be refused.
- **FR-018**: The native runner MUST attach a store only where the store offers every capability the attachment needs, MUST refuse with the missing capability otherwise, and MUST detach every store it attached when the run ends, whether it ended well, failed or was parked past its deadline.
- **FR-019**: WHEN a step fails, the native runner MUST run the `undo` steps of the steps that succeeded, in the reverse order, and MUST record each compensation as an event.
- **FR-020**: The native runner MUST hold the actor to the derived autonomy of each step: an agent MUST NOT apply a `human-only` step (the run parks and hands back), MUST propose and wait for an answer on an `agent-proposes` step, and MAY apply the others; a person MAY apply any step except one that needs another person.
- **FR-021**: The native runner MUST write every fact of a run as an event of planning on the work order, as one `commented` event in the envelope of the core, and MUST keep no state that is not the fold of those events.
- **FR-022**: What a run finished with MUST be said in the three words every form shares (`completes` for `succeeded`, `parks` for `parked`, `fails` for `failed`), so that the outcome a workload is expected to have can be met or not.
- **FR-023**: A runbook MUST say what it needs of a runner (`runnerNeedsOf`), derived from its steps by the rule of 0010-workload-runners FR-004, and MUST lower to a plan of calls (`callsOf`) only where every step is a `verb`, a `check` or an `each` over a literal fixed list that the caller gives, with inputs that are literals, stores or inputs of the run; any other step, an input that is the output of an earlier step and an `each` inside an `each` MUST be refused with `E-WL-RUNNER-EMIT-UNSUPPORTED`, and a source that is no literal list with `E-WL-RUNNER-EACH-UNLISTED`.

## Acceptance scenarios

1. **Given** a value with a ninth kind of step, **When** it is decoded, **Then** the decoder gives the reason and no runbook, per FR-001.
2. **Given** a value of the form `reconcile`, **When** it is decoded as a runbook, **Then** it is refused, per FR-002.
3. **Given** a runbook as plain data, **When** it is decoded, **Then** it is a runbook with the same steps, or every reason it is not one, per FR-003.
4. **Given** a `judge` step that names no output type, **When** it is decoded, **Then** it is refused, per FR-004.
5. **Given** a step with a control of two frameworks, **When** it is read, **Then** each control is a reference of grc with its URN, per FR-005.
6. **Given** a runbook whose gate guards an earlier step, **When** it is decoded, **Then** it is refused, per FR-006.
7. **Given** a need that names an installer, **When** the runbook is decoded, **Then** it is refused, per FR-007.
8. **Given** each kind of step, **When** its autonomy is derived, **Then** it is the one FR-008 says, per FR-008.
9. **Given** a step that cannot be undone and has no gate or undo, **When** the runbook is checked, **Then** it is a finding, per FR-009.
10. **Given** a disposal of the workshop with a durable store attached, **When** the runbook is checked, **Then** it is a finding, per FR-010.
11. **Given** a verb step that uses the output of a judge with no gate between, **When** the runbook is checked, **Then** it is a finding, per FR-011.
12. **Given** a runbook with a step id used twice, **When** it is checked, **Then** it is malformed, per FR-012.
13. **Given** the catalog of the form, **When** it is read, **Then** each code is `E-RB-<CONCEPT>-<KIND>` with its fixer and fix, per FR-013.
14. **Given** the starter drill, **When** it is checked, **Then** it has no finding, a monthly schedule and an expected outcome, per FR-014.
15. **Given** each run event, **When** it is encoded and decoded, **Then** it is the same event, per FR-015.
16. **Given** a run with a store attached, **When** it is given its `finished` event, **Then** the fold refuses it, per FR-016.
17. **Given** a gate, **When** it is run and an agent answers it, **Then** the answer is refused, and a person's answer lets the run go on, per FR-017.
18. **Given** a store that lacks `history`, **When** it is attached for a step that needs it, **Then** it is refused and names `history`, per FR-018.
19. **Given** a run whose fourth step fails, **When** it is run, **Then** the undo of the third step runs, then of the second, per FR-019.
20. **Given** an agent and a destroy of a durable store, **When** the run reaches it, **Then** the run is parked and hands back, per FR-020.
21. **Given** a finished run, **When** its state is asked, **Then** it is the fold of its events and nothing else, per FR-021.
22. **Given** a drill that completes, **When** it is judged against its expectation, **Then** it is met, per FR-022.
23. **Given** the restore drill and the bootstrap runbook, **When** their needs are derived and they are lowered, **Then** the drill needs the native runner and is refused by an emit, and the bootstrap runbook is a plan of calls, per FR-023.

## Out of scope

- Machines for a disposable workshop (`commons/lab`, a later slice) and the storage of events beyond memory: the port is given, a file store is not.
- The core: effects, the table of autonomy, the registry of verbs, the dialects and the envelope are 0001 to 0007.

## Edge cases

- An empty runbook has no step and is refused: a procedure with nothing to do is a mistake of its author, per FR-003.
- A control id the catalogs do not hold is not decided here: the check of citations asks the catalog, per FR-005.
- A deadline that passes with no answer is an event, `expired`, the run ends as parked and every store it attached is detached, per FR-017.
- A detach that fails is recorded and the run reports it, because a store left attached makes the workshop not disposable, per FR-018.

## Assumptions

- The type of a control is the one of `@intellectual-frontiers/grc` (`ControlRef`, `controlUrn`, `parseControlUrn`); where grc changes it, this library follows.
- The planning store that holds the events is a port the host gives; the tests use a store in memory.

## Open questions

- None.

## Key entities

- **Step** - one element of the algebra of a runbook.
- **Verb** - a deterministic operation of the pinned packages, named by an id.
- **Judge** - a bounded judgement of an agent whose output is typed and which has no effect.
- **Citation** - a requirement of a spec or a control of a catalog that a step answers to.
- **Park** - stop a run at a step that needs a person and record who and by when.
- **Compensation** - the `undo` that takes back a step that succeeded.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| EARS and Gherkin as Mizan states them (`commons/docs/guides/mizan-writing-a-spec.md`, read in this repository) | The requirements are `WHEN/WHILE/IF ... MUST`; a workload is projected as a scenario of Given, When and Then that cites the requirements it exercises | The Mizan guide, section on scenarios; the Gherkin reference itself was not fetched, so no Gherkin version is claimed |
| NIST OSCAL, the implementation layer concept page (`https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/`) | A control is addressed by a framework and a control id; the control reference is the one of grc (`urn:grc:<framework>:<version>:<control>`), which the catalogs of NIST SP 800-53, SP 800-171, CSF 2.0 and SOC 2 already use | The page names two models of the implementation layer (component definition and system security plan); it names no field of a statement, and none is claimed |
| The workbench contract (`commons/workbench/src/governance/contract.ts` and `logical/compose.ts`, read in this repository) | A requirement is of one of six kinds; a unit's contribution is composed only where the unit is selected, and a requirement only where a task needs it | The files themselves |
| Saga pattern (Garcia-Molina and Salem, Sagas, 1987) | A compensating action paired with a step, run in the reverse order when a later step fails | Named from the literature; the paper was not read in this session, so no section, no IRI and no quotation is given |
| W3C PROV-O (read 2026-11-25) | The run is recorded as events of an activity with its agent and the person the agent acts for; the run's actor is the actor of planning, which already states `prov:actedOnBehalfOf` | Section 4.1, entry `prov:actedOnBehalfOf` |

## Success criteria

- **SC-001**: Every requirement of 0008-form-runbook is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
