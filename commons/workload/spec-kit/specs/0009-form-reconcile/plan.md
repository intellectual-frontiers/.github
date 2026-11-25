# Plan: 0009-form-reconcile

**Spec:** 0009-form-reconcile. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Level-triggered control loops (the controller pattern of container orchestrators) and plan-then-apply tools | A loop acts on the state it observes now and not on a log of what changed, so that a missed event is repaired by the next pass; a plan is shown to a person before it is applied, and what is applied is what was shown | Named from the literature and from common practice; no page was read in this session, so no section, no IRI and no quotation is given |
| Planning's own specification (`commons/planning/spec-kit`, 0001 to 0005, read in this repository) | An item has a kind of the closed list `issue`, `task`, `todo` and `finding`; the history is events and the state a fold; an agent acts on behalf of a person; a person alone confirms | `src/governance/actor.ts`, `event.ts`, `vocab.ts` |
| SHA-256 through `@intellectual-frontiers/crypto` (`commons/crypto/src/sha256.ts`, read in this repository) | A digest is 64 lower case hexadecimal digits, made by Web Crypto and typed apart from any other string | The file itself; the algorithm is the library's and none is written here |
| The workbench contract and matrix (read in this repository, see 0003-workload-forms) | An approval is an authority a human dialect expresses and an agent dialect leaves to a person | The files themselves |

## What is built and what is reused

Reused: the core (effects, the table of autonomy, the registry of verbs, the dialects, the envelope), the shared checks, the dry run, the fold's order and the projections; the digest of `@intellectual-frontiers/crypto`. New: the six kinds of node, the diff and the plan, the checks, the events and their fold, the view, the starter loop and the executor with its fake in the tests.
