# Plan: 0002-workload-effects

**Spec:** 0002-workload-effects. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The capability model of AnyFS (`commons/anyfs/src/governance/capability.ts`, read in this repository) | A store is attached by the capabilities it must offer (`read`, `write`, `append`, `history`, `cas` and the rest); a store that lacks one is refused with a reason, and the capability names are the ones of that closed union and no others | The file itself |
| The autonomy levels and the person-only actions of the workbench (`commons/workbench/src/governance/roles.ts`) | The four levels, from `human-only` to `agent-autonomous`, and the actions `approve` and `tag` which are a person's at every level | The file itself |
| Saga pattern (Garcia-Molina and Salem, 1987) | A step that cannot be taken back is paired with a compensation or guarded by a person | Named from the literature, not read in this session; no section or IRI is given |

## What is built and what is reused

Reused: `Autonomy`, `AUTONOMY`, `PERSON_ONLY` and `agentMay` of the workbench and `Capability` of AnyFS. New: the effect type, the table that derives autonomy (in the core, called by every form), the attachment set and its computed disposability.
