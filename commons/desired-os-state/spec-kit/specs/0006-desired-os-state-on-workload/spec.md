# Feature Specification: Desired OS State on workload

**Spec ID:** 0006-desired-os-state-on-workload
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Desired OS State models what a fleet must be (requirements, layers, kinds, change classes, secret names) and nothing generic about changing it. Everything generic is the reconcile form of workload (commons workload 0009-form-reconcile): the diff of a state with a state, the plan and its hash, the approval of a plan by its hash by a person, the apply made once for a hash, the verification, the receipts and evidence, and a work order that parks and resumes. Desired OS State therefore depends on workload and never the reverse. `reconcileOf(order)` turns an order into a reconcile workload; Desired OS State supplies the states, the requirement semantics and the steps, and workload runs the loop.

## Requirements

- **FR-001**: Desired OS State MUST depend on `@intellectual-frontiers/workload` (its reconcile form, its governance and its logical layer) and workload MUST NOT import `@intellectual-frontiers/desired-os-state` or any package of the Desired OS State family, in its sources, its manifest or its tests.
- **FR-002**: `reconcileOf(order, options)` MUST return a workload of the form `reconcile` that workload's own `check` accepts, with the six kinds of node in this order: observe the actual state, observe the desired state, diff, plan, approve by the hash of the plan, apply, verify; the ids, stores and spec citations MUST be derived from the order's subject and no node MUST name a tool.
- **FR-003**: `desiredStateOf(order)` and `observedStateOf(order, observed)` MUST return a workload `State` whose keys are requirement ids and whose values are the canonical JSON text of the state of the resource; a requirement that `ensure` absent MUST have no key in the desired state and a resource that is not observed MUST have no key in the observed state.
- **FR-004**: `planOf(order, observed)` MUST be made from workload's `diffStates` and `planText` and MUST give, for each requirement that differs, one entry with the requirement id, its kind, its change class, its tier and its action (`create`, `update` or `remove`, where workload's `delete` is `remove`); entries MUST be in the order of workload's changes, and `planHash` MUST be workload's plan hash of the changes (the SHA-256 of `planText`).
- **FR-005**: The canonical form and the digest of a plan are workload's and MUST replace the former `desired-os-state-plan/1` text of Desired OS State, which is removed; a plan hash made by the former form MUST NOT be accepted, and the same order and the same observed state MUST give the same hash on every machine whatever the order of keys.
- **FR-006**: The `apply` node of `reconcileOf` MUST declare the effect `external` and the mode the plan can need at most: `append` where every requirement is additive, `mutate` where one is mutating and `destroy` where one is destructive or `ensure` absent, and it MUST declare the effect reversible only where every requirement's rollback is `reversible`; workload then derives the autonomy and refuses an apply whose plan exceeds the declared mode.
- **FR-007**: The approval of a plan MUST be workload's: always by the hash of the plan, only by a person, parked for the hours workload says; Desired OS State MUST NOT approve, and `stateGate` MUST keep only what workload does not say, namely a confirmation typed by a person for each destructive entry (the text is the requirement id) and a second approver where the profile asks for one for a destructive entry or for a tier above `operator`.
- **FR-008**: A run of `reconcileOf` through workload's native reconcile runner, given fixtures for the observe, apply and verify verbs, MUST observe, plan, park for approval, apply nothing before the plan is approved, apply once for the approved hash, verify and finish converged, and a second pass with nothing to change MUST apply nothing.
- **FR-009**: Where a dialect gives steps, each step MUST be an `ArgvStep` of `@intellectual-frontiers/core` (commons core 0001-core FR-009): words, the identity it runs as and the exit codes it expects, never a shell string, and a test MUST find no `sh -c`, `bash -c`, `cmd /c` or `powershell -Command` in what the dialects output.
- **FR-010**: The converge plugin, `approvals.ts`, `plan.ts` and their tests MUST be removed in favour of this specification, and what remains unique of the converge plugin MUST be said where it is removed.
- **FR-011**: Desired OS State MUST NOT carry a first-boot or install hook of a machine (the former dialect of cloud-init): enrolment and the first-boot hook belong to the ssh-server library.

## Acceptance scenarios

1. **Given** an order of two requirements, **When** `reconcileOf` is made and checked by workload, **Then** it is accepted with six kinds of node, per FR-002.
2. **Given** a requirement that ensures a package absent and the package observed, **When** the plan is made, **Then** the entry is `remove` and the apply mode is `destroy`, per FR-004 and FR-006.
3. **Given** the same order and observation with keys in another order, **When** the plan hash is taken, **Then** it is equal, per FR-005.
4. **Given** a destructive entry, **When** the gate is asked with no typed confirmation, **Then** it names the missing confirmation, per FR-007.
5. **Given** fixtures, **When** the loop is run, approved by a person and run again, **Then** it applies once and converges, per FR-008.
6. **Given** the sources of workload, **When** they are searched for an import of Desired OS State, **Then** there is none, per FR-001.

## Out of scope

- Observing hosts: spec 0007-desired-os-state-observe-osquery.
- Carrying the argv steps out: the executor of headless and the jobs of the ssh-server library.

## Edge cases

- An order with no requirement: the loop has no change and applies nothing, per FR-008.
- A requirement whose desired state is `null` JSON: a value, not an absence, per FR-003.

## Assumptions

- Workload's `State` holds scalars; JSON text is a scalar.

## Open questions

- The integration of Ansible and OpenTofu as runners of workload (a runner of the kind `integration` that renders an artifact from the plan, names the plan hash in it, checks drift and ingests a receipt) is not built: the dialects `ansible` and `opentofu` stay as they are, with their own plan digest, until it is. Decision: they will be separate small libraries (`runner-ansible`, `runner-opentofu`), because workload's registry of runners is closed data owned by workload and an emitter is registered by a package that depends on workload, not the reverse.

## Key entities

- **Reconcile workload** - the loop workload runs for an order.
- **Plan** - workload's changes decorated with the kind, class and tier of each requirement.

## Success criteria

- **SC-001**: Desired OS State holds no diff, hash, approval or runner logic of its own.
- **SC-002**: Workload imports nothing of Desired OS State.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
