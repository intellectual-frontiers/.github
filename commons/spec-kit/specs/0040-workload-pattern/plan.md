# Plan: 0040-workload-pattern

**Spec:** 0040-workload-pattern. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Kanon (commons 0033-kanon, read in this repository) | Three layers; a unit imports only the units of a layer above its own and, of its own layer, only the units its row lists; a class of units has instances that import no sibling; an extension reaches a library through its public entries | FR-001 to FR-006 of the specification; the checker is `commons/kanon` (`kanon 0001-kanon-checker` FR-012, read in this repository) |
| The libraries by concern and the roles of a library (`commons/spec-kit/specs/0032-libraries-by-concern`, `commons/libraries/src/readme.ts` and `metapackages.ts`, read in this repository) | A library has one role (`foundation`, `pattern`, `program` or `standard`); the metapackage of a role depends on each consumer-facing library of that role at one exact version, and the set is computed from the manifests, never written by hand | The files themselves |

## What is built and what is reused

Reused: Kanon and its checker, the patterns metapackage and the roles of the libraries. New: the pattern, stated once here and held by the table and the tests of the library `workload`.
