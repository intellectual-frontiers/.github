# Feature Specification: Runbooks algebra

**Spec ID:** 0002-runbooks-algebra
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The step algebra of a runbook: a closed sum of eight kinds of step, branded ids, errors as values, decoding at the boundary, the citations every step carries (requirements of a spec and the controls of a catalog) and the declaration of what a runbook and a step need.

## Requirements

- **FR-001**: A step MUST be one of eight kinds, `verb`, `check`, `ask`, `judge`, `branch`, `each`, `gate` and `undo`, a closed list from which the type of a step is made, and every function over steps MUST be an exhaustive `switch` that ends in `absurd`.
- **FR-002**: The ids of a runbook, a step, a verb, a store and a skill MUST be branded and made only by a smart constructor that returns a `Result`: a runbook, step or skill id is lower case words joined by hyphens, a verb id is lower case words joined by hyphens, a dot and lower case words, and a store reference is `synthetic-<kind>-NN` or a name of that shape.
- **FR-003**: A runbook MUST have an id, a title, a version, the ids of the workbench requirements it needs (its Given), the stores it attaches, and its steps in order, and `decodeRunbook` MUST turn a value that came from outside into a runbook or into every reason it is not one, with no `any`, no non-null assertion and no cast outside the decoders.
- **FR-004**: A `verb` step MUST name a registered verb id, give typed inputs (a literal, a store reference or the output of an earlier step) and declare its effect; a `check` step MUST name what it asserts and the evidence it yields; an `ask` step MUST name the approver and the deadline; a `judge` step MUST name the typed output it decodes into; a `branch` step MUST name the earlier step whose output it reads; an `each` step MUST name what it fans out over; a `gate` step MUST name the authority it needs and the steps it guards; an `undo` step MUST name the step it compensates.
- **FR-005**: Every step MUST carry `spec` citations, each a spec id and a requirement id, and MAY carry `controls`, each the control reference of grc (a framework, a version and a control id, with the URN of grc as its text), so that one step cites the controls of several frameworks by their own ids and a crosswalk of grc can relate them; the library MUST NOT define a control vocabulary of its own.
- **FR-006**: A runbook MUST be refused where a step id is used twice, a step names a step that is not before it, an `undo` compensates a step that is not in the runbook, or a `gate` guards a step that is not after it.
- **FR-007**: A runbook and each of its steps MUST declare what they need as requirements of the workbench (a program, a credential, a network host, a Git state, an install or an authority, the `Requirement` type of `@intellectual-frontiers/workbench/governance`), and MUST NOT name an installer or a way to obtain a program: obtaining it is the workbench's port.

## Acceptance scenarios

1. **Given** a value with a ninth kind of step, **When** it is decoded, **Then** the decoder gives the reason and no runbook, per FR-001.
2. **Given** a step id with a capital letter, **When** it is made, **Then** it is refused, per FR-002.
3. **Given** a runbook as plain data, **When** it is decoded, **Then** it is a runbook with the same steps, or every reason it is not one, per FR-003.
4. **Given** a `judge` step that names no output type, **When** it is decoded, **Then** it is refused, per FR-004.
5. **Given** a step with a control of two frameworks, **When** it is read, **Then** each control is a reference of grc with its URN, per FR-005.
6. **Given** a runbook whose gate guards an earlier step, **When** it is decoded, **Then** it is refused, per FR-006.
7. **Given** a need that names an installer, **When** the runbook is decoded, **Then** it is refused, per FR-007.

## Out of scope

- The effects of a step, the checks of the split between the probabilistic and the deterministic, the choice of a harness and the runs: the other specifications of this library.

## Edge cases

- An empty runbook has no step and is refused: a procedure with nothing to do is a mistake of its author, per FR-003.
- A control id the catalogs do not hold is not decided here: the check of citations (a later specification of this library) asks the catalog, per FR-005.

## Assumptions

- The type of a control is the one of `@intellectual-frontiers/grc` (`ControlRef`, `controlUrn`, `parseControlUrn`); where grc changes it, this library follows.

## Open questions

- None.

## Key entities

- **Step** - one element of the algebra of a runbook.
- **Verb** - a deterministic operation of the pinned packages, named by an id.
- **Judge** - a bounded judgement of an agent whose output is typed and which has no effect.
- **Citation** - a requirement of a spec or a control of a catalog that a step answers to.

## Standards considered

Each source below was read on 2026-11-25 unless it says it was not.

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| EARS and Gherkin as Mizan states them (`commons/docs/guides/mizan-writing-a-spec.md`, read in this repository) | The requirements are `WHEN/WHILE/IF ... MUST`; a runbook is projected as a scenario of Given, When and Then that cites the requirements it exercises | The Mizan guide, section on scenarios; the Gherkin reference itself was not fetched, so no Gherkin version is claimed |
| NIST OSCAL, the implementation layer concept page (`https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/`) | A control is addressed by a framework and a control id; the control reference is the one of grc (`urn:grc:<framework>:<version>:<control>`), which the catalogs of NIST SP 800-53, SP 800-171, CSF 2.0 and SOC 2 already use | The page names two models of the implementation layer (component definition and system security plan); it names no field of a statement, and none is claimed |
| The workbench contract (`commons/workbench/src/governance/contract.ts` and `logical/compose.ts`, read in this repository) | A requirement is of one of six kinds; a unit's contribution is composed only where the unit is selected, and a requirement only where a task needs it | The files themselves |
| Saga pattern (Garcia-Molina and Salem, Sagas, 1987) | A compensating action paired with a step, run in the reverse order when a later step fails | Named from the literature; the paper was not read in this session, so no section, no IRI and no quotation is given |

## Success criteria

- **SC-001**: Every requirement of 0002-runbooks-algebra is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
