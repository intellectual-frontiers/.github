# Plan: 0006-workload-split

**Spec:** 0006-workload-split. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The error catalog of the workbench (`commons/workbench/src/governance/catalog.ts`, read in this repository) | Codes made as `E-<LIB>-<CONCEPT>-<KIND>`, each with a fixer (`agent`, `person`, `environment`, `ci`), one fix, and an `UNKNOWN` entry; a finding that is in no entry is itself classified | The file itself |
| The controls and the requirements the library cites | A node's citation is checked against the specs of this repository and the controls against the catalogs of grc, never by a vocabulary of this library | `ControlRef` of grc |
| Saga pattern (Garcia-Molina and Salem, 1987) | A step that cannot be taken back is paired with a compensation or guarded by a person | Named from the literature, not read in this session; no section or IRI is given |

## What is built and what is reused

Reused: the catalog shape of the workbench (a fixer, a fix, an unknown entry) and the workbench's `FIXERS`. New: the catalog helpers every owner of a catalog uses, the core catalog, the checks of a node's use of a verb, the verb runner and the agent runner.
