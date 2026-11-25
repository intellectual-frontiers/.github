# Plan: 0007-runbooks-harness

**Spec:** 0007-runbooks-harness. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The matrix of requirement by dialect of the workbench (`commons/workbench/src/logical/matrix.ts`, read in this repository) | Each dialect answers every requirement as expressed, carried or unexpressed with a reason; a cell no dialect answers is `dropped`; an agent dialect that needs a person for a requirement no human dialect expresses is `no-person` | The file itself |
| Claude Code skills and settings; Codex `AGENTS.md` (read 2026-11-25, see 0004-runbooks-projections) | What each of the two harnesses reads; no other harness is named, and a harness added later is one registered dialect | As in 0004-runbooks-projections |
| W3C PROV-O (read 2026-11-25) | The operator's choice of a harness is a choice of the agent that is associated with the activity, and does not change the activity | Section 4.1 |

## What is built and what is reused

Reused: `Dialect`, `matrixOf`, `matrixFindings` of the workbench. New: the registry of dialects, the policy and its resolution, and the suitability check.
