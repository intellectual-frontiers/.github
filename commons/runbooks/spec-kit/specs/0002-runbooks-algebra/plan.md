# Plan: 0002-runbooks-algebra

**Spec:** 0002-runbooks-algebra. **Written:** 2026-11-25.

## Standards considered

Each source below was read on 2026-11-25 unless it says it was not.

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| EARS and Gherkin as Mizan states them (`commons/docs/guides/mizan-writing-a-spec.md`, read in this repository) | The requirements are `WHEN/WHILE/IF ... MUST`; a runbook is projected as a scenario of Given, When and Then that cites the requirements it exercises | The Mizan guide, section on scenarios; the Gherkin reference itself was not fetched, so no Gherkin version is claimed |
| NIST OSCAL, the implementation layer concept page (`https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/`) | A control is addressed by a framework and a control id; the control reference is the one of grc (`urn:grc:<framework>:<version>:<control>`), which the catalogs of NIST SP 800-53, SP 800-171, CSF 2.0 and SOC 2 already use | The page names two models of the implementation layer (component definition and system security plan); it names no field of a statement, and none is claimed |
| Saga pattern (Garcia-Molina and Salem, Sagas, 1987) | A compensating action paired with a step, run in the reverse order when a later step fails | Named from the literature; the paper was not read in this session, so no section, no IRI and no quotation is given |

## What is built and what is reused

Reused: `Result`, `absurd`, `Brand` and the decoders of core; `ControlRef` and the control URN of grc. New: the step type, the ids, `decodeRunbook` and the scenario projection.
