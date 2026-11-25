# Plan: 0005-runbooks-runners

**Spec:** 0005-runbooks-runners. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| W3C PROV-O (read 2026-11-25) | The run is recorded as events of an activity with its agent and the person the agent acts for; the run's actor is the actor of planning, which already states `prov:actedOnBehalfOf` | Section 4.1, entry `prov:actedOnBehalfOf` |
| Saga pattern (Garcia-Molina and Salem, 1987) | On a failure, the compensations of the steps that succeeded run in the reverse order | Named from the literature, not read in this session; no section or IRI is given |

## What is built and what is reused

Reused: `makeEvent` and the actors of planning. New: the ports, the runner, the parking and the command.
