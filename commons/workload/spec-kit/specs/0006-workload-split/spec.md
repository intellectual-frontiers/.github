# Feature Specification: Workload split

**Spec ID:** 0006-workload-split
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The principle of the library and the checks that hold it: the probabilistic layer (an agent in Claude Code or Codex, or a person) orchestrates, and every effect is a deterministic verb of the pinned packages. A judge has no effect and only proposes; only a verb applies anything. It matters for regulated and audited work (CMMC, FedRAMP, SOC 2, HIPAA), where what was done must be a record of a program and never of a model. The catalogs of problems are closed: the core has one for what is true of every form, and each form has its own.

## Requirements

- **FR-001**: The library MUST state and enforce one principle: an agent or a person orchestrates, and every effect on a store is the effect of a verb node, which calls a deterministic verb of the pinned packages by its id; a judge MUST have no effect, its output MUST decode into the type it declares, and it MUST only propose.
- **FR-002**: The catalogs of problems MUST be closed: the core's codes are `E-WL-<CONCEPT>-<KIND>` and each form's are of its own prefix (`E-RB-` for the runbook form, `E-RC-` for the reconcile form), each with the concept it belongs to, who fixes it (`agent`, `person`, `environment` or `ci`), one fix, and whether it is a safety rule, and a failure in no entry MUST be `E-WL-UNKNOWN`, which says to classify it by adding an entry, a check and a test.
- **FR-003**: The checks every form holds its nodes to MUST find a verb id the registry does not hold (`E-WL-VERB-UNKNOWN`), inputs that do not fit the verb (`E-WL-VERB-INPUTS-INVALID`), an effect that exceeds its verb's (`E-WL-EFFECT-EXCEEDS-VERB`), an effect on an `external` store with no idempotency key (`E-WL-EXTERNAL-NO-KEY`), a node that cites no requirement and no control (`E-WL-CITATION-MISSING`), a need of a verb that neither the node nor its workload declares (`E-WL-NEED-MISSING`), a need that names an installer (`E-WL-NEED-INSTALLER`), a node that reads with a verb that does more than read (`E-WL-CHECK-NOT-READ`) and a gate that guards nothing (`E-WL-GATE-GUARDS-NOTHING`).
- **FR-004**: The registry of verbs MUST be by id, each with the pinned package it comes from, its typed inputs, the classes of store it acts on and the greatest mode it does, and the verb runner MUST call a verb only by its registered id with inputs decoded against the verb's declared inputs, MUST refuse an id that is not registered and an effect that exceeds the verb's, and MUST NOT take or run a shell string.
- **FR-005**: The agent runner MUST pass a judge to an agent port, MUST decode what comes back into the declared type, MUST refuse what does not decode, and MUST give the agent port no way to call a verb, so that a judge's result is only a proposal recorded as an event.
- **FR-006**: The check of a workload MUST return every finding, in the order of the nodes, each with its code, its node, its fixer and its fix, and a workload with a finding MUST NOT be run: the executor and the dry run MUST refuse it.

## Acceptance scenarios

1. **Given** a judge that carries an effect, **When** it is decoded, **Then** it is refused with `E-WL-JUDGE-EFFECT`, per FR-001.
2. **Given** the catalogs, **When** they are read, **Then** each code is of its owner's prefix with a concept, a fixer and a fix, and an unknown code is `E-WL-UNKNOWN`, per FR-002.
3. **Given** nodes that break each shared check, **When** they are checked, **Then** each finding has its code, per FR-003.
4. **Given** a node that names an unregistered verb id, **When** it is run, **Then** it is refused and nothing is called, per FR-004.
5. **Given** a judge whose agent answers with a wrong shape, **When** it is run, **Then** the answer is refused and nothing is applied, per FR-005.
6. **Given** a workload with two findings, **When** it is checked, planned and run, **Then** both are given in order and it is neither planned nor run, per FR-006.

## Out of scope

- Whether a model's proposal is good: a person's judgement, at a gate or an ask.
- The checks that belong to one form (a missing checkpoint, a store not detached, a plan not approved): the form's own specification.

## Edge cases

- A judge with a bounded scope is still a proposal: the bound is in the type of its output, per FR-001.
- A check of a citation does not read the spec files: it checks the shape of the citation and that a control reference parses, and the trace check of the library does the rest, per FR-003.

## Assumptions

- Every finding is an error: a workload is data a regulated operation depends on, and none of these is a hint.

## Open questions

- None.

## Key entities

- **Finding** - one problem the static check made, with its code.
- **Proposal** - the typed output of a judge, recorded and applied by no one without a person.
- **Safety rule** - a code that is an error whatever the severity table says.
- **Verb** - a deterministic operation of the pinned packages, named by an id.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The error catalog of the workbench (`commons/workbench/src/governance/catalog.ts`, read in this repository) | Codes made as `E-<LIB>-<CONCEPT>-<KIND>`, each with a fixer (`agent`, `person`, `environment`, `ci`), one fix, and an `UNKNOWN` entry; a finding that is in no entry is itself classified | The file itself |
| The controls and the requirements the library cites | A node's citation is checked against the specs of this repository and the controls against the catalogs of grc, never by a vocabulary of this library | `ControlRef` of grc |
| Saga pattern (Garcia-Molina and Salem, 1987) | A step that cannot be taken back is paired with a compensation or guarded by a person | Named from the literature, not read in this session; no section or IRI is given |

## Success criteria

- **SC-001**: Every requirement of 0006-workload-split is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
