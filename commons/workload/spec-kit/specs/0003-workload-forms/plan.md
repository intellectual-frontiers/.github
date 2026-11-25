# Plan: 0003-workload-forms

**Spec:** 0003-workload-forms. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Kanon (commons 0033-kanon, read in this repository) | Three layers; a unit imports only the units of a layer above its own and, of its own layer, only the units its row lists; a class of units has instances that import no sibling (`instances/sibling`); an extension reaches a library through its public entries | FR-001 to FR-006 of 0033-kanon, and FR-012 of 0001-kanon-checker (`commons/kanon/spec-kit`) |
| The workbench (`commons/workbench/src/governance/contract.ts`, `logical/compose.ts` and `logical/matrix.ts`, read in this repository) | A requirement is of one of six kinds; a unit's contribution is composed only where the unit is selected; a dialect answers each requirement as expressed, carried or unexpressed | The files themselves |

## What is built and what is reused

Reused: the instances of a unit of Kanon and its `instances/sibling` check. New: the contract of a form in the core, the registry of forms, the logic of the runbook form and its executor, and the static check of the sources.
