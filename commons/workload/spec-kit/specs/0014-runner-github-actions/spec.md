# Feature Specification: Runner GitHub Actions

**Spec ID:** 0014-runner-github-actions
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The `github-actions` integration runner (0010-workload-runners): it emits a plan of calls, and for a graph (0013-form-graph) its jobs, as a workflow of GitHub Actions that GitHub executes, and the library hands it off and ingests what the run did as a receipt. GitHub is the external executor. The emit is thin: every step is one call to a pinned command of a verb by its id, and the workflow holds nothing but what GitHub requires to wire the jobs (`needs`, a matrix over a fixed list, `permissions`, an `environment` that a person approves, `concurrency`, and references to inputs and to the names of secrets); every meaning stays in typed TypeScript.

## Requirements

- **FR-001**: The runner `github-actions` MUST be registered in the registry of runners as an integration runner that declares `calls`, `fan-out` and `approval` and no other capability, MUST have one emitter that is an instance of the unit `src/physical/runners/` (with the entry `./runners/github-actions`), and that emitter MUST import no other emitter and, besides the core and the logical layer of workload, only the typed model of workflows and its writer of `commons/libraries` (`workflows/model` and `workflows/render`).
- **FR-002**: The emitter MUST make the workflow as a value of the typed model of workflows and write it with the writer of that model, so that the bytes are the bytes the model writes, MUST find what is wrong with it with the validation of the model (an action with no version, a job that needs a job that is not there), and MUST give the same bytes for the same plan; with provenance (the default) the first line MUST say that the workload generated it, the second MUST be `# plan: <hash>` and the workflow MUST carry the hash in the environment variable `WORKLOAD_PLAN`, and without it the file MUST be exactly what the model writes.
- **FR-003**: Every step that calls MUST be one call of the pinned command of the verb by its id: the words of its entry in the pin table of the options where it has one, and `<command> verb <id>` otherwise, with the arguments as `--in name=value` and a member of a loop as `--member`; the workflow MUST hold no script of several lines, no `eval`, no command substitution and no condition, and no expression but the references to `inputs`, `secrets` and `matrix` that GitHub requires.
- **FR-004**: The permissions MUST be the least the plan asks for and typed: the workflow `contents: read`, each job exactly the scopes its plan names (`contents: read` and what the node asks for, each `read` or `write`), no scope more, and a scope that is no scope of the model refused at the decoder of the graph.
- **FR-005**: A credential MUST appear only as the reference `${{ secrets.<NAME> }}` of its name in the environment of the jobs that read it, and an input of the run only as `WORKLOAD_INPUT_<NAME>` set from `${{ inputs.<name> }}`; the workflow MUST hold no value of a secret and MUST NOT write one.
- **FR-006**: Every action MUST be pinned: the checkout and each setup action of the options MUST be `./path` or `owner/name@version` with the version a tag or a full commit, and one that is not MUST be refused with `E-WL-RUNNER-ACTION-UNPINNED`; so MUST a command of the pin table that is not a list of plain words.
- **FR-007**: The ingest of a run MUST be a pure function, with no network, that turns the result of a finished run (its address, its conclusion, the conclusion of each job, the digest of its log and the plan hash its workflow carries) into one `receipt` event of the core: the exit status 0 only where the run and every job concluded with success, skipped or neutral, 124 for a time out, 130 for a cancel and 1 otherwise; a run that is not finished, an address that is no address of a run, a digest or a plan hash that is none and a job with no conclusion in a finished run MUST be refused with `E-WL-RUNNER-RECEIPT-INVALID`; and the receipt MUST be matched to its hand-off by the plan hash by the fold of the core, which refuses a receipt that names no hand-off.
- **FR-008**: An approval of an environment MUST count only where a person gave it and a person records the receipt: an approval by an app, or in a receipt recorded by an agent or a tool, MUST be left out of the receipt and refused with `E-WL-RUNNER-APPROVAL-NOT-PERSON`, so that an agent never approves; and the fold of the core MUST refuse the approvals of a receipt recorded by anyone but a person.
- **FR-009**: A job that a gate guards MUST be written with the environment of the gate's id, in which a person approves it, and a plan with a gate MUST be carried only by a runner that declares `approval`, or be refused with `E-WL-RUNNER-UNSUITABLE`.
- **FR-010**: The emitted artifacts of the fixtures MUST be generated into `commons/workload/artifacts/` by `bun commons/workload/tools/runners.ts`, and a workflow that is not what its plan makes (edited by hand, of another plan or of another runner) MUST be found as `E-WL-RUNNER-DRIFT`, as the artifacts of the other runners are.
- **FR-011**: The emitted workflows MUST be valid by the JSON Schema of GitHub workflows (the copy of SchemaStore kept in `commons/libraries`) read by a validator that is not this repository's, and a plan that makes an invalid one is a bug of the emitter; where the validator is not installed the test says that the check was skipped.
- **FR-012**: A loop over a fixed list MUST be a job with `strategy.matrix.member` of the members and `fail-fast: false`, whose calls read the member from `matrix.member` through the environment of the step, and a plan with no jobs (a runbook) MUST be a chain of jobs, one for each step, each needing the one before.

## Acceptance scenarios

1. **Given** the registry, **When** the runner is read, **Then** it is an integration runner with `calls`, `fan-out` and `approval`, its emitter is an instance and imports no other emitter, per FR-001.
2. **Given** a plan, **When** it is emitted twice, **Then** the bytes are the same, equal to what the model writes, with the plan hash in the second line and in `WORKLOAD_PLAN`; without provenance the file is the model's, per FR-002.
3. **Given** the emitted workflow, **When** it is read, **Then** every step is one call of a pinned command, there is no multi-line script and the only expressions are references to inputs, secrets and the matrix, per FR-003.
4. **Given** the graph with a write permission, **When** it is emitted, **Then** each job has exactly its scopes and the workflow has `contents: read`, per FR-004.
5. **Given** a credential and an input, **When** the workflow is read, **Then** the credential is a reference to its name and no value is anywhere, per FR-005.
6. **Given** an unpinned checkout, a setup action by a branch and a pin table entry with a space, **When** they are emitted, **Then** each is refused with its code, per FR-006.
7. **Given** a finished run, a run still going, a bad address and a digest that is none, **When** each is ingested, **Then** the first gives a receipt of the plan hash with its status and the others are refused, per FR-007.
8. **Given** an approval by a person, one by an app and a receipt recorded by an agent, **When** they are ingested and folded, **Then** only the first counts, per FR-008.
9. **Given** the graph with a gate, **When** it is emitted for `github-actions` and for `bash`, **Then** the job has its environment and `bash` refuses it, per FR-009.
10. **Given** the artifacts in the folder, **When** one is edited, **Then** the check finds the drift, per FR-010.
11. **Given** the emitted workflows, **When** a JSON Schema validator reads them, **Then** none has an error, per FR-011.
12. **Given** the graph with a loop and a runbook, **When** they are emitted, **Then** the loop is a matrix job and the runbook a chain of jobs, per FR-012.

## Out of scope

- Running a workflow, or asking GitHub whether it accepts one: the schema's validation is the check, and a run is GitHub's.
- Fetching a run from GitHub: the caller does, and the library only ingests the result.
- Creating the environment in the repository's settings with its required reviewers: a person does, and no file of the library does it.
- Moving the repository's own CI onto this emitter: 0016-ci-on-graph.

## Edge cases

- A gate of a runbook is refused for lowering (it guards steps, not jobs); only the gates of a graph become environments, per FR-009.
- A run that GitHub reports as `skipped` entirely has status 0, because nothing failed; a job `skipped` inside a failed run does not hide the failure, per FR-007.
- A receipt that comes before its hand-off is kept by the fold and matched when the hand-off arrives, per FR-007.

## Assumptions

- The pinned command of a verb is on the `PATH` of the job after the setup actions of the options, under the name the emitter is given (`workload` by default).
- The jobs run on Linux (`ubuntu-24.04` or `ubuntu-latest`) with Bash, which GitHub runs with `pipefail`.

## Open questions

- None.

## Key entities

- **Workflow** - the artifact of the `github-actions` runner.
- **Pin table** - the command words of each verb that the workflow calls.
- **Run result** - what the caller pulled of a finished run, which the ingest turns into a receipt.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| GitHub Actions workflow syntax (the JSON Schema of GitHub workflows of SchemaStore, copied in `commons/libraries/src/workflows/schema/`) | The keys of a workflow, a job, a step, a strategy, an environment and permissions | The tests validate every emitted file against it with Python's jsonschema; the documentation pages were not fetched, so no section is cited |

## Success criteria

- **SC-001**: Every requirement of 0014-runner-github-actions is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
