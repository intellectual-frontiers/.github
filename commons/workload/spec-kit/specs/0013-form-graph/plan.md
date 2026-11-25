# Plan: 0013-form-graph

**Spec:** 0013-form-graph. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| GitHub Actions workflow syntax (JSON Schema of SchemaStore, the copy of commons/libraries) | Jobs with `needs`, `environment`, `permissions`, a matrix and `concurrency` | The schema validates the emitted files; the documentation pages were not fetched |

## What is built and what is reused

Reused: the nodes, effects, autonomy table, gates, verbs registry and the checks of the shared logical layer; the plan of calls, the plan hash, the hand-off and the receipt of 0010-workload-runners. New: the logical form (`src/logical/forms/graph`: nodes, order, cycle and reachability, checks, catalog, lowering to jobs, events and view), its native runner (`src/physical/forms/graph`) and its starters.
