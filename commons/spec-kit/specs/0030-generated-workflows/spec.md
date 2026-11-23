# Feature Specification: Generated workflows

**Spec ID:** 0030-generated-workflows
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** The workflows of a repository (`.github/workflows/*.yml`) are configuration in a format the compiler cannot check, and this repository's rule is code over configuration: a format with no type is written only as a generated file for a tool that reads nothing else. The workflows are therefore typed values in TypeScript (a workflow, its jobs, its steps, its triggers, its matrix, its permissions), the files GitHub reads are made from them as `<name>.auto.yml`, and the workflow of each library of commons is made from the library's manifest (0027-commons-libraries FR-012). A check finds a file that is not what the model makes and a workflow that is written by hand, so that the files cannot drift from the model.

## What a workflow is

- **FR-001**: Every file in `.github/workflows/` MUST be made by `commons/libraries/src/generate-workflows.ts` and named `<name>.auto.yml`, and a check MUST fail, naming the file, where the folder holds a file that is not.
- **FR-002**: A workflow MUST be written as a typed value (`Workflow`, with its triggers, its jobs, their steps, matrices, permissions and concurrency), in which a step is a `uses` step or a `run` step, a job has at least one step, a permission is `read`, `write` or `none` and an expression is a value of its own type, and a mistake that the types do not say (a job that needs a job that is not there, a step that runs nothing, a workflow with no trigger) MUST be a finding of the model's validation, which stops the generator before it writes.
- **FR-003**: The files that the generator writes MUST be valid by the JSON Schema of GitHub workflows that SchemaStore publishes (`https://json.schemastore.org/github-workflow.json`, the copy kept in `commons/libraries/src/workflows/schema/`), and a test MUST check each file against it with a validator that is not this repository's.
- **FR-004**: `generate-workflows.ts --check` MUST write nothing and exit with status 1, naming each file that is not what the model makes and each generated file that no workflow makes, and the `check` job of the `tests` workflow MUST run it.
- **FR-005**: The version of every action a workflow uses MUST be written once, in one table of the model, and each `uses` of a workflow MUST be `./path` or `owner/name@version` with the version a tag or a commit, and the model's validation MUST find one that is not.
- **FR-006**: The libraries MUST be proved by one workflow, `ci.auto.yml`, made from the libraries' manifests (the name, the folder and the `verify` command of each) and the record of the facts of CI that a manifest does not hold (the tests on Node 26, a command after `verify`, and the systems other than Linux where the library has code of its own), so that a library is given its place in CI by being registered, with no file written by hand and no workflow of its own: a job `plan` says which libraries the push or the pull request affects (commons 0001-libraries FR-012), a matrix of those runs `verify` and the tests on Linux, a second matrix runs the libraries whose record names Windows or macOS on those systems, and a job `ci` is the one result that fails where a job failed.
- **FR-007**: The workflow that plans which libraries a change affects, and the one job that gates the rest, MUST be made by the same model, as the jobs `plan` and `ci` of the workflow of FR-006.
- **FR-008**: The composite actions of `.github/actions/` MUST be made by the same generator from the same model, and a file whose name GitHub fixes (`action.yml`), which cannot carry `.auto.`, MUST begin with the line that says it is generated and by what, and be compared by `--check` like the others. The Bun action MUST install the root tooling from the frozen lockfile after Bun is available, so shared parsers also resolve in jobs that install only a library’s own dependencies.
- **FR-009**: The libraries whose manifests name npm among their registries MUST be published by one workflow, `release.auto.yml`, made by the same model and run by hand from main (never by a push or a tag), that reads the release record (`commons/generated/release.auto.json`, commons libraries 0001-libraries FR-014), leaves out what is tagged, proves each library and packs it with the library's own `tools/pack.ts`, and, where the run is asked to publish, sends the tarballs in the order of the record (a library after the libraries it imports) to npm with provenance by npm's trusted publishing (the run's id-token), or with the repository's secret `INFRO_NPMJS_TOKEN` where the repository has it, and to the GitHub package registry with the workflow's own token, skips a version a registry has already, and makes the tag `<name>-v<version>` with the runner's token; the generator MUST find a library published to npm that has no `tools/pack.ts`, and MUST write no workflow of a library's own.
- **FR-010**: A script of a `run` step whose shell is `bash` (which GitHub runs with `pipefail`) MUST NOT pipe a command that writes more than the reader takes into `head`, because the reader's closing of the pipe ends the writer with a failure and fails the step; a listing is cut with `sed -n '1,N p'`, which reads all of its input. The generated workflows are held to it by a test that reads every script.
- **FR-011**: Every step of every workflow of the model MUST carry a policy of the build policy (commons 0038-build-policy FR-003): a red cause, a step whose output is read into findings, a gate or plumbing, given by the ordered rules of `commons/libraries/src/ci/inventory.ts`; a step of findings MUST run through the step wrapper with a time limit below its job's, no matrix MAY fail fast, a job after a matrix MUST run with `always()`, plumbing MUST be `continueOnError`, and the generator MUST write nothing while a step has no policy or one of these rules is broken (commons 0002-libraries-ci-findings FR-005).
- **FR-012**: The model MUST hold a workflow `maintenance` that is run by hand only (`workflow_dispatch`), for the housekeeping of the releases that the owner asks for, with two jobs and no other trigger: `package-clean`, with `packages: write` and no other write permission, which lists the versions of the npm package `commons` of the organization on the GitHub package registry and deletes the superseded ones by the pure selection of commons 0001-libraries FR-033 (its inputs `keep`, the number of newest versions to keep, 1 by default, and `dry-run`, true by default: where `dry-run` is true it MUST delete nothing and say what it would delete, and where it is false it MUST say each deletion and its result; it MUST use no action of a third party), and `tag`, with `contents: write` and no other write permission, which makes the tag of a release (its inputs `tag`, a name of the form `commons-v<major>.<minor>.<patch>`, `sha`, a full commit that is on `main`, and `method`, `git-push` by default or `refs-api`) and MUST refuse a name or a commit that does not fit, MUST keep a tag that is there, and MUST print the exact text of the error where it cannot make the tag. A step of this workflow is a step of the gate `maintenance` (commons 0038-build-policy FR-003): its own result is the run's, because it says nothing about a module.

## Acceptance scenarios

1. **Given** a repository whose workflows are made from the model, **When** `generate-workflows.ts --check` runs, **Then** it writes nothing, names nothing and exits 0, per FR-001 and FR-004.
2. **Given** a workflow file edited by hand, **When** `--check` runs, **Then** it exits 1 and names the file, and running the generator writes it again, per FR-004.
3. **Given** a file `.github/workflows/extra.yml` written by hand, **When** `--check` runs, **Then** it exits 1 and names it as written by hand, per FR-001.
4. **Given** a job that needs a job that is not in the workflow, **When** the model is validated, **Then** the finding names the workflow, the job and the job it needs, and the generator writes nothing, per FR-002.
5. **Given** a step that uses `actions/checkout` with no version, **When** the model is validated, **Then** the finding names the step, per FR-005.
6. **Given** folders `commons/alpha/` and `commons/beta/` with manifests, **When** the generator runs, **Then** one `ci.auto.yml` is written, whose plan names the libraries a change affects, whose matrix runs the manifest's `verify` in the folder of each, and no `alpha.auto.yml` or `beta.auto.yml` is written, per FR-006.
7. **Given** the files the generator wrote, **When** a JSON Schema validator that is not this repository's reads each against the schema of GitHub workflows, **Then** none has an error, per FR-003.
8. **Given** the composite action `bun`, **When** the generator runs, **Then** `.github/actions/bun/action.yml` begins with the line that says it is generated, and `--check` compares it, per FR-008.
9. **Given** a library whose manifest names npm and that has a `tools/pack.ts`, **When** the generator runs, **Then** the one `release.auto.yml` proves and packs it, and publishes and tags it in the order of the record when it is run by hand from main and asked to publish, and a library with no `tools/pack.ts` is a finding, per FR-009.

## Out of scope

- Running a workflow, or asking GitHub whether it accepts one: the schema's validation is the check, and a run is CI's.
- Which libraries a change affects: `commons/libraries/src/affected.ts` (0027-commons-libraries FR-019 to FR-022), which the plan of FR-007 reads.
- Another repository's workflows: `erga` has none today, and when it has, the model is the one it imports.

## Edge cases

- A workflow written by hand in the folder: found, never deleted, per FR-001.
- A generated file that no workflow makes (a workflow removed from the model, a library unregistered): found, per FR-004.
- A manifest that cannot be read: named, and the generator writes nothing, per FR-006.
- A Windows checkout of a file (CRLF line ends): the same file, per FR-004.
- A job with no step, an unknown trigger, a permission that is not `read`, `write` or `none`: refused by the compiler, per FR-002.
- A step that runs a script in a composite action and names no shell: found, per FR-002.
- An action pinned by a branch (`@main`): found, per FR-005.
- A library with no record of CI facts: `verify` on Linux alone, per FR-006.
- A library that names npm and has no `tools/pack.ts`: found, and nothing is written, per FR-009.
- A run of the release workflow from a branch other than main: it stops before anything is sent, per FR-009.

## Assumptions

- GitHub reads `*.yml` in `.github/workflows/`, so `<name>.auto.yml` is a workflow like any other, and the name of a workflow (`name:`), which a check's name begins with, is the model's `name`, so the checks that a branch rule names do not change when a workflow becomes generated.
- The schema of SchemaStore is the published description of the workflow format that tools use; GitHub's own is not published as a schema. Its edition is the copy kept here, fetched on 2026-11-19, and a newer one replaces it by a decision.
- The model's first workflows are the ones that were written by hand; they were compared with their files before the files were removed (what a YAML reader makes of each, in a one-time comparison reported in the commit that made them generated), and one thing changed on purpose: the job `tests` installs PyYAML, which the test of FR-003 uses.
- A workflow's `needs` with one job is written as a list; GitHub reads it as it reads the scalar.

## Open questions

- None.

## Key entities

- **Workflow** - a typed value: its name, its triggers, its jobs by id, their steps, matrices, permissions and concurrency.
- **Model** - `commons/libraries/src/workflows/`: the types, the validation, the YAML writer and the workflows of this repository.
- **Generator** - `commons/libraries/src/generate-workflows.ts`: writes the files, or with `--check` compares them.
- **Library CI record** - the facts of a library's CI that its manifest does not hold (the steps after `verify`, the command that runs its tests on Node).

## Success criteria

- **SC-001**: No file in `.github/workflows/` is written by hand, and a change to a workflow is a change to TypeScript that the compiler has checked.
- **SC-002**: Registering a library gives it its workflow with no file written by hand.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
