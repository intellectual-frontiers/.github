# Plan: 0005-workload-runs

**Spec:** 0005-workload-runs. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Planning's own specification (`commons/planning/spec-kit`, 0001 to 0005, read in this repository) | An item has a kind of the closed list `issue`, `task`, `todo` and `finding`; the history is events and the state a fold; an agent acts on behalf of a person; a person alone confirms | `src/governance/actor.ts`, `event.ts`, `vocab.ts` |
| W3C PROV-O (read 2026-11-25) | A run is an activity; the run's agent acts on behalf of a person | Section 4.1 |
| The workbench evaluation (`commons/workbench/src/logical/evaluate.ts`) | The preconditions of a dry run are the requirements of the workbench evaluated against facts | The file itself |

## What is built and what is reused

Reused: the planning events, the actor and the item kinds of `commons/planning`; the evaluation and the composition of the workbench. New: the envelope of run events, the order and the dedupe every fold starts from, the dry run built from what a form hands it and the composition of a workload's needs.
