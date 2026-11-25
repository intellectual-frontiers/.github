# Plan: 0008-runbooks-runs

**Spec:** 0008-runbooks-runs. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Planning's own specification (`commons/planning/spec-kit`, 0001 to 0005, read in this repository) | An item has a kind of the closed list `issue`, `task`, `todo` and `finding`; the history is events and the state a fold; an agent acts on behalf of a person; a person alone confirms | `src/governance/actor.ts`, `event.ts`, `vocab.ts` |
| W3C PROV-O (read 2026-11-25) | A run is an activity; the run's agent acts on behalf of a person | Section 4.1 |
| The workbench evaluation (`commons/workbench/src/logical/evaluate.ts`) | The preconditions of a dry run are the requirements of the workbench evaluated against facts | The file itself |

## What is built and what is reused

Reused: `ItemEvent`, `makeEvent`, `Actor`, `ItemId` and `EventId` of planning and `evaluate` of the workbench. New: the run event, its codec and the fold.
