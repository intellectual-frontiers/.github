# Feature Specification: Form reconcile

**Spec ID:** 0009-form-reconcile
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The reconcile form: a workload that is a loop toward a desired state. It observes the actual state and the desired state, diffs them, plans the changes, has a person approve the plan by its hash, applies it and verifies that the state converged. It is level-triggered: a pass starts from what is observed now and never from a log of what changed, so that a missed trigger is repaired by the next pass. The first real user is the converge of a fleet toward its declared state; this library holds the form and a fake native runner for its tests and nothing of any fleet.

## Requirements

- **FR-001**: A reconcile MUST be a workload of the form `reconcile` with its nodes in order, each one of six kinds, `observe`, `diff`, `plan`, `approve`, `apply` and `verify`, a closed list from which the type of a node is made, and every function over nodes MUST be an exhaustive `switch` that ends in `absurd`; `decodeReconcile` MUST turn a value that came from outside into a reconcile or into every reason it is not one, and a value of another form or of a seventh kind MUST be refused.
- **FR-002**: An `observe` node MUST say whether it observes the `actual` state or the `desired` state, the verb that reads and the evidence it yields; a `diff` node MUST name the observation of the actual state and the observation of the desired state; a `plan` node MUST name the diff it plans; an `approve` node MUST name the plan, the approver, the level it demands and the nodes it guards; an `apply` node MUST name the plan, a registered verb, its inputs and its effect; a `verify` node MUST name what it asserts, the verb that reads and the evidence it yields.
- **FR-003**: A loop MUST be refused where a node id is used twice, a node names a node that is not before it or is not of the kind it must be (a diff names observations, one of the actual state and one of the desired state; a plan names a diff; an approve and an apply name a plan), an approve guards a node that is not an apply after it, a store is named that the loop does not declare, or the loop does not observe both states.
- **FR-004**: The static check MUST find an `apply` whose effect is not `agent-autonomous` and that no `approve` of the same plan before it guards (`E-RC-APPLY-UNAPPROVED`, a safety rule) and an `apply` that no `verify` follows (`E-RC-VERIFY-MISSING`), and MUST hold the nodes to the checks every form shares: a verb that is not registered, inputs that do not fit, an effect above its verb's, a system of record changed with no idempotency key, a node that cites nothing, a need nobody declares, an observation or a verification that does more than read, and an approval that guards nothing.
- **FR-005**: The autonomy of a node MUST be derived: of an `apply` from its effect by the table of the core, the same table the runbook form calls, so that the same effect gives the same autonomy in every form; of an `observe`, a `diff`, a `plan` and a `verify` `agent-autonomous`; of an `approve` `human-only`; and an `approve` only raises the control over the applies it guards.
- **FR-006**: The diff MUST be a pure function of two states, each named values: the creates, updates and deletes that make the first the second, in the order of their names; the plan MUST be their canonical text, the same bytes for the same changes, and its hash the SHA-256 of that text; and the least mode of effect that can apply a plan MUST follow from its actions (a create appends, an update mutates, a delete destroys).
- **FR-007**: A pass MUST be level-triggered: each run MUST observe the actual and the desired state again, and a run with nothing to change MUST apply nothing and verify; a pass that is parked MUST be resumed by the next run and not started again; a run after a finished pass MUST start a new pass, and what belonged to a pass (its plan, its approvals, what it applied) MUST NOT carry over to the next.
- **FR-008**: A plan MUST be approved by its hash and by nothing else: an `approve` node MUST park the pass as a planning event that names the approver, the deadline and the hash of the plan; an approval MUST be the answer of a person that carries the hash as its evidence (`digest`); an approval of another hash MUST NOT pass, a plan that changed since it was approved MUST be parked again, an answer of an agent MUST be refused, and a plan that is declined or not answered by its deadline MUST NOT be applied.
- **FR-009**: An `apply` MUST be made once for a hash of the plan in a pass, with the hash as its idempotency key, only where the plan has been approved by a person or the autonomy of its effect is `agent-autonomous`, and only for changes its declared effect covers: a plan with a change above the mode of the effect MUST fail the pass with `E-RC-APPLY-EXCEEDS-PLAN` and apply nothing; a `verify` that does not hold MUST fail the pass.
- **FR-010**: A run event of a reconcile MUST be one of `pass-started`, `observed`, `diffed`, `planned` (with the hash), `parked` (with the approver, the deadline and the hash), `answered` (with the digest of the plan as evidence), `applied`, `verified`, `failed`, `expired` and `finished`, in the envelope of the core with the form `reconcile`, decoded on entry into the closed union or refused; the state MUST be the fold of the events in the order of their ids, the same in any arrival order, with the plan in hand, the hashes approved, declined and applied, whether the plan in hand is approved, what is parked and whether the pass is finished, and a pass MUST be refused its `finished` event while a node is parked.
- **FR-011**: The catalog of the reconcile form MUST be closed and its codes MUST be `E-RC-<CONCEPT>-<KIND>`, each with its concept, its fixer, its fix and whether it is a safety rule; what the form shares with every form is a code of the core.
- **FR-012**: A dry run MUST return, with no effect and no event, the nodes in order with the derived autonomy of each, what stops for a person, and the preconditions the workbench would evaluate for the needs of the nodes that read, and a loop with a finding MUST give no plan.
- **FR-013**: What a pass finished with MUST be said in the three words every form shares (`completes` for `converged`, `parks` for `parked`, `fails` for `failed`), so that the outcome a workload is expected to have can be met or not.
- **FR-014**: The starter reconcile `converge-settings` MUST pass the static checks, MUST run on a schedule trigger and MUST use only registered verbs, with synthetic names.
- **FR-015**: A reconcile MUST say what it needs of a runner (`runnerNeedsOf`) by the rule of 0010-workload-runners FR-004: its diff and its plan need `logic` and its approval needs `approval` and `interactive`, so that a reconcile is run by the native runner and is refused by every integration runner with `E-WL-RUNNER-UNSUITABLE`, and it MUST NOT lower to a plan of calls.

## Acceptance scenarios

1. **Given** a loop of six kinds of node, **When** it is decoded, **Then** it is a reconcile, and a seventh kind or the form `runbook` is refused, per FR-001.
2. **Given** an observe that names no verb, **When** it is decoded, **Then** it is refused, per FR-002.
3. **Given** a diff that names the same observation twice, **When** the loop is defined, **Then** it is refused, per FR-003.
4. **Given** a loop whose apply changes a system of record with no approval, **When** it is checked, **Then** it is a finding, per FR-004.
5. **Given** each kind of node, **When** its autonomy is derived, **Then** it is the one FR-005 says, per FR-005.
6. **Given** two states, **When** they are diffed, **Then** the changes are in the order of their names and the plan is the same bytes, per FR-006.
7. **Given** a drift, a person's approval and a second run, **When** the loop is run, **Then** the second pass observes again and applies nothing, per FR-007.
8. **Given** a plan approved, **When** the world changes before it is applied, **Then** the new plan is parked and the old approval does not apply it, per FR-008.
9. **Given** a plan with a delete and an apply that mutates, **When** it is run, **Then** it fails with its code and applies nothing, per FR-009.
10. **Given** each event of a pass, **When** it is encoded and decoded, **Then** it is the same event, per FR-010.
11. **Given** the catalog, **When** it is read, **Then** each code is `E-RC-<CONCEPT>-<KIND>`, per FR-011.
12. **Given** the starter loop, **When** it is planned, **Then** the approval stops for a person, per FR-012.
13. **Given** a pass that converged and one that expired, **When** they are judged, **Then** they complete and park, per FR-013.
14. **Given** the starter loop, **When** it is checked, **Then** it has no finding, per FR-014.
15. **Given** the starter loop and each runner, **When** the runner is chosen, **Then** only the native runner carries it and no integration runner does, per FR-015.

## Out of scope

- Any real native runner host: the first real user binds the verbs `state.observe`, `state.apply` and `state.verify` in its own host; this library holds the form and a fake for its tests.
- A reconcile of many members (a fleet): one loop of a workload is one target, and a fan out over members is the business of a form that has one, which a second concrete user would ask for.
- Compensation: a loop is level-triggered, so the next pass repairs what a pass left, and there is no undo node.

## Edge cases

- A state that is empty is a state: a diff of an empty actual state with a desired one is all creates, per FR-006.
- A plan hash that is the same as a hash approved earlier in an earlier pass is not approved again: approvals belong to a pass, per FR-007.
- An apply of a plan that is empty is skipped and the pass verifies, per FR-007.

## Assumptions

- A state is named values, strings, numbers or booleans: what a real system has more of is the host's to flatten into named values, as the verb that observes it does.
- The idempotency key of the apply is the hash of the plan, an input of the node named by `idempotencyKey`, and the system of record is told it by the host that binds the verb.

## Open questions

- None.

## Key entities

- **Observation** - the state of a store read by a verb that only reads.
- **Change** - one difference between the actual and the desired state.
- **Plan hash** - the SHA-256 of the canonical text of the changes: what a person approves.
- **Pass** - one evaluation of the loop from observation to verification.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Level-triggered control loops (the controller pattern of container orchestrators) and plan-then-apply tools | A loop acts on the state it observes now and not on a log of what changed, so that a missed event is repaired by the next pass; a plan is shown to a person before it is applied, and what is applied is what was shown | Named from the literature and from common practice; no page was read in this session, so no section, no IRI and no quotation is given |
| Planning's own specification (`commons/planning/spec-kit`, 0001 to 0005, read in this repository) | An item has a kind of the closed list `issue`, `task`, `todo` and `finding`; the history is events and the state a fold; an agent acts on behalf of a person; a person alone confirms | `src/governance/actor.ts`, `event.ts`, `vocab.ts` |
| SHA-256 through `@intellectual-frontiers/crypto` (`commons/crypto/src/sha256.ts`, read in this repository) | A digest is 64 lower case hexadecimal digits, made by Web Crypto and typed apart from any other string | The file itself; the algorithm is the library's and none is written here |
| The workbench contract and matrix (read in this repository, see 0003-workload-forms) | An approval is an authority a human dialect expresses and an agent dialect leaves to a person | The files themselves |

## Success criteria

- **SC-001**: Every requirement of 0009-form-reconcile is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
