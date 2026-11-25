# Plan: 0014-runner-github-actions

**Spec:** 0014-runner-github-actions. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| GitHub Actions workflow syntax (JSON Schema of SchemaStore, the copy of commons/libraries) | The keys of a workflow and its validation | The schema validates the emitted files; the documentation pages were not fetched |

## What is built and what is reused

Reused: the plan of calls, the plan hash, the hand-off and the receipt of 0010-workload-runners, and the typed model and writer of workflows of commons/libraries (the dependency runs from workload to libraries, never back: 0016-ci-on-graph FR-001). New: the emitter, the pin table, the ingest of a run into a receipt and the measure of how far a workflow is from what the emitter writes.
