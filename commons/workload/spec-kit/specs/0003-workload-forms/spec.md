# Feature Specification: Workload forms

**Spec ID:** 0003-workload-forms
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A workload has a form and a form is a module. The form says what kind of work a workload is and how it executes; it is a closed sum of kinds of node over a shared core, with a static check, a dry run, a fold of run events and a native runner behind a port (0010-workload-runners). Two forms have code, the runbook (a procedure, 0008-form-runbook) and the reconcile loop (0009-form-reconcile); two are reserved with no code and the criteria for building them. The form is orthogonal to the dialect (a harness projection, 0007-workload-harness) and to the trigger (what starts the workload), which is a field of every workload.

## Requirements

- **FR-001**: A form MUST be declared by its contract and by nothing else: its id, the closed sum of its kinds of node (a function over them is an exhaustive `switch` that ends in `absurd`), `validate` (the static check), `plan` (the dry run), `fold` (the run events to a state) and a native runner behind a port; the contract MUST be a type of the core (`FormLogic`, `NativeRunner` and `Form`). What a form's workload needs of a runner and how it lowers to calls are functions of the form that the physical layer puts side by side, and are no key of the contract (0010-workload-runners FR-004).
- **FR-002**: The core (the governance entry and the shared logical entry) MUST import nothing from a form: no source of either MUST name a form by a path or by the entry of a form, and the table of the manifest MUST give the core no row that lets it import a unit of the forms.
- **FR-003**: A form MUST import nothing from another form: each form MUST be an instance of the unit of the forms, so that the shared checker finds `instances/sibling` where one imports another, and the native runners of two forms MUST NOT import each other.
- **FR-004**: The forms MUST be a closed registry of the core, one entry for each, with the status `built` (it has code) or `reserved` (a named slot with no code and the criteria for building it); a workload that names a form that is reserved or is none MUST be refused with `E-WL-WORKLOAD-UNKNOWN-FORM`.
- **FR-005**: A workload MUST have a trigger, a field of its head and never a form: one of `manual`, `schedule` (with a cadence of `daily`, `weekly`, `monthly`, `quarterly` or `yearly`), `event` (a name) or `alert` (a name), a closed sum decoded at the boundary; the trigger MUST NOT change what a form does, so that the same workload is started by any trigger.
- **FR-006**: A workload MAY say the outcome a run is expected to have, one of `completes`, `parks` and `fails`, so that a drill or a game day is a workload with a schedule trigger and an expected outcome and not a form of its own; each form MUST say what its run finished with in those three words (the runbook's `succeeded`, `parked` and `failed`; the reconcile form's `converged`, `parked` and `failed`) so that a run can be judged against the expectation.
- **FR-007**: The forms `graph` and `campaign` MUST be specified here as named slots and MUST have no code. `graph` is a directed acyclic graph of jobs with freshness, a projection to an external runner (an integration runner, 0010-workload-runners); its first consumer will be CI/CD and the generated GitHub workflows, which GitHub executes from YAML and which today are generated from typed definitions (`commons/libraries/src/workflows/definitions.ts`) and stay so until a second concrete user needs the same graph of jobs. `campaign` is a collection over a period with sampling. Each MUST be built only where a second concrete user needs it, and the criterion for building it MUST be in the registry of the core; no folder, no entry of the package and no source MAY name a reserved form but the registry.

## Acceptance scenarios

1. **Given** the starter runbook's form, **When** its keys are read, **Then** they are its id, its kinds of node, `validate`, `plan` and `fold`, and its native runner names the same form, per FR-001.
2. **Given** the sources of the core and the table, **When** they are read, **Then** no source names a form and the core has no row that imports one, per FR-002.
3. **Given** the sources of each form, **When** their imports are read, **Then** none is of another form, per FR-003.
4. **Given** the registry, **When** it is read, **Then** the runbook and the reconcile form are built, the graph and the campaign are reserved with their criteria, per FR-004.
5. **Given** a trigger of each kind and a trigger that is none, **When** they are decoded, **Then** the four are workloads' triggers and the others are refused, and no form is a trigger, per FR-005.
6. **Given** the starter drill, **When** it is read, **Then** it has a schedule trigger and an expected outcome, and a run is judged against it in the three words every form shares, per FR-006.
7. **Given** the reserved forms, **When** the registry, the folders and the spec are read, **Then** each has its criterion and none has code, per FR-007.

## Out of scope

- Code for the forms `graph` and `campaign`: they are specified here as slots and built when their criteria are met.

## Edge cases

- A shared function that two forms need is moved to the shared logical layer, never imported from one form by the other, per FR-003.
- A form that needs a new kind of effect extends the core's table for every form, never its own, per FR-001.

## Assumptions

- A second concrete user is what builds a form (the rule of two): a form with one user is a runbook or a function of that user, not a form.

## Open questions

- None.

## Key entities

- **Form** - what kind of work a workload is and how it executes.
- **Contract** - the id, the kinds of node, validate, plan, fold and the port of a native runner.
- **Reserved form** - a named slot with no code and the criteria for building it.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Kanon (commons 0033-kanon, read in this repository) | Three layers; a unit imports only the units of a layer above its own and, of its own layer, only the units its row lists; a class of units has instances that import no sibling (`instances/sibling`); an extension reaches a library through its public entries | FR-001 to FR-006 of 0033-kanon, and FR-012 of `kanon 0001-kanon-checker` (`commons/kanon/spec-kit`) |
| The workbench (`commons/workbench/src/governance/contract.ts`, `logical/compose.ts` and `logical/matrix.ts`, read in this repository) | A requirement is of one of six kinds; a unit's contribution is composed only where the unit is selected; a dialect answers each requirement as expressed, carried or unexpressed | The files themselves |

## Success criteria

- **SC-001**: Every requirement of 0003-workload-forms is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
