# Plan: 0016-ci-on-graph

**Spec:** 0016-ci-on-graph. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| GitHub Actions workflow syntax (JSON Schema of SchemaStore) | The keys of a job and a step | Not read beyond the schema |

## What is built and what is reused

Reused: the typed model, the writer and the definitions of workflows of commons/libraries, and the golden test of 0030-generated-workflows FR-014. New: the measure of what can move (`thinBlockers`) and the record of the migration.
