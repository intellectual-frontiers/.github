# Feature Specification: Runbooks deterministic and probabilistic split

**Spec ID:** 0006-runbooks-split
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The principle of the library and the static checks that hold it: the probabilistic layer (an agent in Claude Code or Codex, or a person) orchestrates, and every effect is a deterministic verb of the pinned packages. A `judge` step has no effect and only proposes; only a `verb` step applies anything. It matters for regulated and audited work (CMMC, FedRAMP, SOC 2, HIPAA), where what was done must be a record of a program and never of a model.

## Requirements

- **FR-001**: The library MUST state and enforce one principle: an agent or a person orchestrates, and every effect on a store is the effect of a `verb` step, which calls a deterministic verb of the pinned packages by its id; a `judge` step MUST have no effect, its output MUST decode into the type it declares, and it MUST only propose.
- **FR-002**: The catalog of problems MUST be closed: each code is `E-RB-<CONCEPT>-<KIND>` with the concept it belongs to, who fixes it (`agent`, `person`, `environment` or `ci`), one fix, and whether it is a safety rule, and a failure in no entry MUST be `E-RB-UNKNOWN`, which says to classify it by adding an entry, a check and a test.
- **FR-003**: The static check MUST find a step that is not reversible and has neither a gate that guards it nor an `undo` that compensates it (`E-RB-STEP-IRREVERSIBLE-UNGUARDED`), a `mutate` of a `transactional` store with no checkpoint step of that store before it (`E-RB-STORE-NO-CHECKPOINT`), a `judge` that carries an effect (`E-RB-JUDGE-EFFECT`), a store attached and never detached (`E-RB-STORE-NOT-DETACHED`), a step that cites no requirement and no control (`E-RB-CITATION-MISSING`) and a verb id the registry does not hold (`E-RB-VERB-UNKNOWN`); an effect on an `ephemeral` store is reversible by its nature and is never a finding of the first.
- **FR-004**: The static check MUST also find a disposal of a workshop while a store that is not `ephemeral` is attached (`E-RB-WORKSHOP-NOT-DISPOSABLE`), an effect that exceeds its verb's (`E-RB-EFFECT-EXCEEDS-VERB`), an effect on an `external` store with no idempotency key (`E-RB-EXTERNAL-NO-KEY`) and a `gate` whose action is a person's but whose guard is empty (`E-RB-GATE-GUARDS-NOTHING`).
- **FR-005**: A `verb` step that uses the output of a `judge` step as an input and whose derived autonomy is above `agent-proposes` MUST be a finding (`E-RB-JUDGE-APPLIED`) unless a `gate` or an `ask` stands between them, so that nothing a model proposed is applied without a person.
- **FR-006**: The check of a runbook MUST return every finding, in the order of the steps, each with its code, its step, its fixer and its fix, and a runbook with a finding MUST NOT be run: the runner and the plan MUST refuse it.
- **FR-007**: The starter runbook `restore-drill` MUST pass the static checks.
- **FR-008**: The static check MUST find a `verb` step whose verb is registered with needs (a program or a credential) that neither the step nor its runbook declares (`E-RB-NEED-MISSING`), so that the workbench is told what a step needs before it is run.
- **FR-009**: The static check MUST also find a runbook that is not well formed (`E-RB-RUNBOOK-MALFORMED`), inputs that do not fit the verb (`E-RB-VERB-INPUTS-INVALID`), a `check` that uses a verb that does more than read (`E-RB-CHECK-NOT-READ`) and a need that names an installer (`E-RB-NEED-INSTALLER`).

## Acceptance scenarios

1. **Given** a `judge` step whose data carries an effect, **When** it is decoded, **Then** it is refused with `E-RB-JUDGE-EFFECT`, per FR-001.
2. **Given** a failure that no entry names, **When** it is explained, **Then** it is `E-RB-UNKNOWN` and says to classify it, per FR-002.
3. **Given** a destroy of a durable store with no gate and no undo, **When** the runbook is checked, **Then** `E-RB-STEP-IRREVERSIBLE-UNGUARDED` is found, per FR-003.
4. **Given** a mutate of a transactional store with no checkpoint before it, **When** the runbook is checked, **Then** `E-RB-STORE-NO-CHECKPOINT` is found, per FR-003.
5. **Given** a store attached and never detached, **When** the runbook is checked, **Then** `E-RB-STORE-NOT-DETACHED` is found, per FR-003.
6. **Given** an unregistered verb id and a step that cites nothing, **When** the runbook is checked, **Then** `E-RB-VERB-UNKNOWN` and `E-RB-CITATION-MISSING` are found, per FR-003.
7. **Given** a dispose while a durable store is attached, **When** the runbook is checked, **Then** `E-RB-WORKSHOP-NOT-DISPOSABLE` is found, per FR-004.
8. **Given** a verb that applies the proposal of a judge with no person between, **When** the runbook is checked, **Then** `E-RB-JUDGE-APPLIED` is found, per FR-005.
9. **Given** a runbook with a finding, **When** it is planned or run, **Then** it is refused, per FR-006.
10. **Given** the starter runbook, **When** it is checked, **Then** no finding is made, per FR-007.
11. **Given** a verb step whose verb needs `sqlite3` and a runbook that declares no such need, **When** the runbook is checked, **Then** `E-RB-NEED-MISSING` is found, per FR-008.
12. **Given** a verb call whose inputs do not fit the verb and a check that uses a verb that mutates, **When** the runbook is checked, **Then** `E-RB-VERB-INPUTS-INVALID` and `E-RB-CHECK-NOT-READ` are found, per FR-009.

## Out of scope

- Whether a model's proposal is good: a person's judgement, at a `gate` or an `ask`.

## Edge cases

- A `judge` with a bounded scope is still a proposal: the bound is in the type of its output, per FR-001.
- A check of a citation does not read the spec files: it checks the shape of the citation and that a control reference parses, and the trace check of the library does the rest, per FR-003.

## Assumptions

- Every finding is an error: a runbook is data a regulated operation depends on, and none of these is a hint.

## Open questions

- None.

## Key entities

- **Finding** - one problem the static check made, with its code.
- **Proposal** - the typed output of a judge, recorded and applied by no one without a person.
- **Safety rule** - a code that is an error whatever the severity table says.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The error catalog of the workbench (`commons/workbench/src/governance/catalog.ts`, read in this repository) | Codes made as `E-<LIB>-<CONCEPT>-<KIND>`, each with a fixer (`agent`, `person`, `environment`, `ci`), one fix, and an `UNKNOWN` entry; a finding that is in no entry is itself classified | The file itself |
| The controls and the requirements the library cites | A step's citation is checked against the specs of this repository and the controls against the catalogs of grc, never by a vocabulary of this library | `ControlRef` of grc |
| Saga pattern (Garcia-Molina and Salem, 1987) | An irreversible step needs a compensation or a gate | Named from the literature, not read in this session; no section or IRI is given |

## Success criteria

- **SC-001**: Every requirement of 0006-runbooks-split is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
