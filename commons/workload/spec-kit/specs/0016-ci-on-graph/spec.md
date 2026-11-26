# Feature Specification: CI on the graph form

**Spec ID:** 0016-ci-on-graph
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The generated workflows of this repository (`.github/workflows/*.auto.yml`, made from the typed definitions of `commons/libraries/src/workflows/definitions.ts`, commons 0030-generated-workflows) are the first consumer of the form `graph` (0013-form-graph) and of the emitter of GitHub Actions (0014-runner-github-actions). A workflow is written as a graph only where its bytes are exactly what the typed definition writes. This specification fixes the direction of the dependency between the libraries, the guard of the bytes, the measure of what a graph can say, and records which workflows are thin and why the seven generated workflows are written from their typed definitions.

## Requirements

- **FR-001**: The dependency MUST run from workload to libraries and never back: the emitter of GitHub Actions imports the typed model of workflows and its writer from `commons/libraries` (`workflows/model` and `workflows/render`, which are pure and import nothing of workload), and `commons/libraries` MUST import nothing of workload, by package name or by path. `libraries` sits low (every library's `verify` runs its checks, and the verify of workload runs them too), so the reverse would close a cycle through the verification of both and put workload, workbench, planning and the rest under every library's CI. The definitions of CI therefore live in `commons/libraries`.
- **FR-002**: A workflow MUST be written from a graph only with zero difference from its typed definition: the golden test of commons 0030-generated-workflows FR-014 MUST pass, `generate-workflows.ts --check` MUST report nothing and the file MUST be byte for byte the golden copy; a workflow that cannot be said as a graph without changing its bytes is written from its typed definition.
- **FR-003**: What a graph can say MUST be measured, not claimed: the measure `thinBlockers` finds, for a workflow and for each of its jobs, every reason it is not what the emitter writes (a script of several lines, a line with shell logic, a condition, `continue-on-error`, an action that moves data, a matrix a job gives at run time, a job output, a step id, a working directory, an expression other than the references of the thin rule, a trigger no workload trigger has, a runner other than Linux, an environment with an address, a checkout with options), each from a closed list; a job with none MAY be written as a graph, and a workflow only where every job is.
- **FR-004**: Where a workflow is thin, the file the emitter writes MUST be exactly what `renderWorkflow` writes of the same typed value: the emitter, without provenance, MUST give the same bytes as the typed model for a graph and the equivalent value of the model.
- **FR-005**: The record of the workflows MUST be this specification and be kept true by a test: no job of the seven is thin, so the seven are written from their typed definitions, and the reasons are those the measure finds for the real definitions (the table below), so that a change of a definition that makes a job thin, or a new workflow, fails the test until the record says so.

## The record: the seven workflows

No job is thin. Every job of every workflow has at least one blocker, so `ci.auto.yml`, `conformance.auto.yml`, `evidence.auto.yml`, `maintenance.auto.yml`, `release.auto.yml`, `site.auto.yml` and `tests.auto.yml` are written from their typed definitions, byte for byte the golden copies. The kinds of blocker each has (the measure of FR-003, computed by `suite/ci-graph.test.ts` from the definitions):

| Workflow | Jobs | Jobs that are thin | What blocks them |
| --- | --- | --- | --- |
| ci | 6 | 0 | triggers push, pull request and the CI paths; a matrix a job gives at run time; job outputs; conditions; `continue-on-error`; scripts of several lines; the upload and download of artifacts; macOS and Windows runners |
| conformance | 5 | 0 | triggers; job outputs; conditions; `continue-on-error`; scripts of several lines and with shell logic; the upload of artifacts; macOS and Windows runners |
| evidence | 7 | 0 | a matrix a job gives at run time; job outputs; step ids; conditions; `continue-on-error`; scripts; the upload and download of artifacts; checkouts with a depth |
| maintenance | 2 | 0 | conditions on the jobs; `continue-on-error` on the checkout; the two scripts of several lines; a checkout with a depth |
| release | 5 | 0 | a matrix a job gives at run time; job outputs; conditions; `continue-on-error`; scripts; the upload and download of artifacts; checkouts with options |
| site | 5 | 0 | triggers; conditions; `continue-on-error`; scripts; the pages actions and an environment with an address read at run time |
| tests | 8 | 0 | triggers; conditions; `continue-on-error`; scripts; the upload and download of artifacts; macOS and Windows runners |

The policy wrapper of the build policy (commons 0038-build-policy) puts a script of several lines, `continue-on-error` and a condition on every step and job of findings, and the gather and keep jobs of every workflow are scripts; a workflow is thin only where each of these is a verb of a pinned package called by one line. The emitter is complete and tested for a workflow written as a graph first.

## Acceptance scenarios

1. **Given** the sources of `commons/libraries` and the package of workload, **When** their imports are read, **Then** libraries imports nothing of workload and workload imports only the pure model and writer of workflows from libraries, per FR-001.
2. **Given** the golden copies and the generator, **When** the golden test and `--check` run, **Then** every file is byte for byte its golden copy, per FR-002.
3. **Given** a typed workflow that is thin and one with a script of several lines, **When** the measure reads each, **Then** the first has no blocker and the second names its kinds, per FR-003.
4. **Given** a thin graph and the equivalent typed value, **When** both are written, **Then** the bytes are the same, per FR-004.
5. **Given** the real definitions, **When** the measure reads every workflow, **Then** no job is thin and each workflow of the table has the kinds the table says, and this specification names every workflow, per FR-005.

## Out of scope

- Changing any CI behavior, any generated workflow or any golden copy.
- A release, a version or a tag: these are the owner's.

## Edge cases

- A new workflow added to the definitions is unknown to the table: the test fails until this record names it, per FR-005.
- A workflow made from a graph gets a header that says workload made it, unless it is written without provenance, as the golden files are, per FR-004.

## Assumptions

- The model of workflows of `commons/libraries` stays pure and importable by name from workload, which `commons/libraries/library.ts` exports (`./workflows/model` and `./workflows/render`).

## Open questions

- None.

## Key entities

- **Blocker** - one reason a job or a workflow is not what the emitter writes.
- **Golden copy** - a generated workflow kept byte for byte under `tests/fixtures/workflows-golden/`.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| GitHub Actions workflow syntax (the JSON Schema of SchemaStore, copied in `commons/libraries`) | The keys a job and a step may have | The schema validates the emitted files; the documentation was not fetched |

## Success criteria

- **SC-001**: Every requirement of 0016-ci-on-graph is proved by a test, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
