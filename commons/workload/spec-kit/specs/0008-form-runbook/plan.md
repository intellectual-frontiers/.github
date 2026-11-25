# Plan: 0008-form-runbook

**Spec:** 0008-form-runbook. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| EARS and Gherkin as Mizan states them (`commons/docs/guides/mizan-writing-a-spec.md`, read in this repository) | The requirements are `WHEN/WHILE/IF ... MUST`; a workload is projected as a scenario of Given, When and Then that cites the requirements it exercises | The Mizan guide, section on scenarios; the Gherkin reference itself was not fetched, so no Gherkin version is claimed |
| NIST OSCAL, the implementation layer concept page (`https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/`) | A control is addressed by a framework and a control id; the control reference is the one of grc (`urn:grc:<framework>:<version>:<control>`), which the catalogs of NIST SP 800-53, SP 800-171, CSF 2.0 and SOC 2 already use | The page names two models of the implementation layer (component definition and system security plan); it names no field of a statement, and none is claimed |
| The workbench contract (`commons/workbench/src/governance/contract.ts` and `logical/compose.ts`, read in this repository) | A requirement is of one of six kinds; a unit's contribution is composed only where the unit is selected, and a requirement only where a task needs it | The files themselves |
| Saga pattern (Garcia-Molina and Salem, Sagas, 1987) | A compensating action paired with a step, run in the reverse order when a later step fails | Named from the literature; the paper was not read in this session, so no section, no IRI and no quotation is given |
| W3C PROV-O (read 2026-11-25) | The run is recorded as events of an activity with its agent and the person the agent acts for; the run's actor is the actor of planning, which already states `prov:actedOnBehalfOf` | Section 4.1, entry `prov:actedOnBehalfOf` |

## What is built and what is reused

Reused: `Result`, `absurd`, `Brand` and the decoders of core; `ControlRef` and the control URN of grc; the core of this library (effects, autonomy, the registry of verbs, the dialects, the envelope). New: the step type, the decoder of a runbook, the checks of the form, the dry run, the run events and their fold, the view the projections are made from, and the runner.
