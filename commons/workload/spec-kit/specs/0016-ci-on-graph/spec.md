# Feature Specification: CI on the graph form

**Spec ID:** 0016-ci-on-graph
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The generated workflows of this repository (`.github/workflows/*.auto.yml`, made from the typed definitions of `commons/libraries/src/workflows/definitions.ts`, commons 0030-generated-workflows) are the first consumer of the form `graph` (0013-form-graph) and of the emitter of GitHub Actions (0014-runner-github-actions). They move onto them only as far as their bytes stay exactly what they are. This specification fixes the direction of the dependency between the libraries, the guard of the migration, the measure of what can move, and records what moved and what stayed and why.

## Requirements

- **FR-001**: The dependency MUST run from workload to libraries and never back: the emitter of GitHub Actions imports the typed model of workflows and its writer from `commons/libraries` (`workflows/model` and `workflows/render`, which are pure and import nothing of workload), and `commons/libraries` MUST import nothing of workload, by package name or by path. `libraries` sits low (every library's `verify` runs its checks, and the verify of workload runs them too), so the reverse would close a cycle through the verification of both and put workload, workbench, planning and the rest under every library's CI. The definitions of CI therefore stay in `commons/libraries`; a workflow that is made from a graph would have its graph in workload with its own generator registered in `repoctl.config.ts`, and `libraries` would be told the names of the files made elsewhere, so that its check does not find them extra.
- **FR-002**: A workflow MUST move from its typed definition onto the graph form only with zero difference: before and after the move the golden test of commons 0030-generated-workflows FR-014 MUST pass unchanged, `generate-workflows.ts --check` MUST report nothing and the file MUST be byte for byte what it was; a workflow that cannot be said as a graph without changing its bytes MUST stay on the old generator, and its CI behavior MUST NOT change.
- **FR-003**: What can move MUST be measured, not claimed: the measure `thinBlockers` finds, for a workflow and for each of its jobs, every reason it is not what the emitter writes (a script of several lines, a line with shell logic, a condition, `continue-on-error`, an action that moves data, a matrix a job gives at run time, a job output, a step id, a working directory, an expression other than the references of the thin rule, a trigger no workload trigger has, a runner other than Linux, an environment with an address, a checkout with options), each from a closed list; a job with none MAY move, and a workflow moves only where every job does.
- **FR-004**: Where a workflow is thin, the file the emitter writes MUST be exactly what `renderWorkflow` writes of the same typed value: the emitter, without provenance, MUST give the same bytes as the typed model for a graph and the equivalent value of the model.
- **FR-005**: The record of the migration MUST be this specification and be kept true by a test: at this release no workflow moved, the seven stay on the old generator, and the reasons are those the measure finds for the real definitions (the table below), so that a change of a definition that makes a job thin, or a new workflow, fails the test until the record says so.

## The record: what moved and what stayed

Nothing moved. Every job of every workflow has at least one blocker, so the seven workflows stay on the old generator, byte for byte, and `ci.auto.yml`, `conformance.auto.yml`, `evidence.auto.yml`, `maintenance.auto.yml`, `release.auto.yml`, `site.auto.yml` and `tests.auto.yml` are unchanged. The kinds of blocker each has (the measure of FR-003, computed by `suite/ci-graph.test.ts` from the definitions):

| Workflow | Jobs | Jobs that could move | What blocks them |
| --- | --- | --- | --- |
| ci | 5 | 0 | triggers push, pull request and the CI paths; a matrix a job gives at run time; job outputs; conditions; `continue-on-error`; scripts of several lines; the upload and download of artifacts; macOS and Windows runners |
| conformance | 4 | 0 | triggers; conditions; `continue-on-error`; scripts of several lines and with shell logic; the upload of artifacts; macOS and Windows runners |
| evidence | 7 | 0 | a matrix a job gives at run time; job outputs; step ids; conditions; `continue-on-error`; scripts; the upload and download of artifacts; checkouts with a depth |
| maintenance | 2 | 0 | conditions on the jobs; `continue-on-error` on the checkout; the two scripts of several lines; a checkout with a depth |
| release | 5 | 0 | a matrix a job gives at run time; job outputs; conditions; `continue-on-error`; scripts; the upload and download of artifacts; checkouts with options |
| site | 5 | 0 | triggers; conditions; `continue-on-error`; scripts; the pages actions and an environment with an address read at run time |
| tests | 8 | 0 | triggers; conditions; `continue-on-error`; scripts; the upload and download of artifacts; macOS and Windows runners |

What it would take to move one is a change of the workflow and not of the emitter: the policy wrapper of the build policy (commons 0038-build-policy) puts a script of several lines, `continue-on-error` and a condition on every step and job of findings, and the gather and keep jobs of every workflow are scripts; each would first have to become a verb of a pinned package called by one line, which changes the bytes of the file and so is a change of CI that a later release makes behind the golden test, not a migration. The emitter is complete and tested for the day a workflow, or a new one, is written as a graph first.

## Acceptance scenarios

1. **Given** the sources of `commons/libraries` and the package of workload, **When** their imports are read, **Then** libraries imports nothing of workload and workload imports only the pure model and writer of workflows from libraries, per FR-001.
2. **Given** the golden copies and the generator, **When** the golden test and `--check` run, **Then** every file is byte for byte what it was, per FR-002.
3. **Given** a typed workflow that is thin and one with a script of several lines, **When** the measure reads each, **Then** the first has no blocker and the second names its kinds, per FR-003.
4. **Given** a thin graph and the equivalent typed value, **When** both are written, **Then** the bytes are the same, per FR-004.
5. **Given** the real definitions, **When** the measure reads every workflow, **Then** no job is movable and each workflow of the table has the kinds the table says, and this specification names every workflow, per FR-005.

## Out of scope

- Changing any CI behavior, any generated workflow or any golden copy: this specification moves nothing.
- Making a verb of the scripts of the workflows: a later change, behind the golden test.
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
