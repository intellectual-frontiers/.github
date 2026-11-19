# Feature Specification: Generated workflows

**Spec ID:** 0030-generated-workflows
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** The workflows of a repository (`.github/workflows/*.yml`) are configuration in a format the compiler cannot check, and this repository's rule is code over configuration: a format with no type is written only as a generated file for a tool that reads nothing else. The workflows are therefore typed values in TypeScript (a workflow, its jobs, its steps, its triggers, its matrix, its permissions), the files GitHub reads are made from them as `<name>.auto.yml`, and the workflow of each library of commons is made from the library's manifest (0027-commons-libraries FR-012). A check finds a file that is not what the model makes and a workflow that is written by hand, so that the files cannot drift from the model.

## What a workflow is

- **FR-001**: Every file in `.github/workflows/` MUST be made by `commons/ts/tools/generate-workflows.ts` and named `<name>.auto.yml`, and a check MUST fail, naming the file, where the folder holds a file that is not.
- **FR-002**: A workflow MUST be written as a typed value (`Workflow`, with its triggers, its jobs, their steps, matrices, permissions and concurrency), in which a step is a `uses` step or a `run` step, a job has at least one step, a permission is `read`, `write` or `none` and an expression is a value of its own type, and a mistake that the types do not say (a job that needs a job that is not there, a step that runs nothing, a workflow with no trigger) MUST be a finding of the model's validation, which stops the generator before it writes.
- **FR-003**: The files that the generator writes MUST be valid by the JSON Schema of GitHub workflows that SchemaStore publishes (`https://json.schemastore.org/github-workflow.json`, the copy kept in `commons/ts/githost/workflows/schema/`), and a test MUST check each file against it with a validator that is not this repository's.
- **FR-004**: `generate-workflows.ts --check` MUST write nothing and exit with status 1, naming each file that is not what the model makes and each generated file that no workflow makes, and the `check` job of the `tests` workflow MUST run it.
- **FR-005**: The version of every action a workflow uses MUST be written once, in one table of the model, and each `uses` of a workflow MUST be `./path` or `owner/name@version` with the version a tag or a commit, and the model's validation MUST find one that is not.
- **FR-006**: The workflow of each library of commons MUST be made from the library's manifest (its name, its folder and its `verify` command) and its record of the facts of CI that a manifest does not hold, so that a library is given a workflow by being registered, with no file written by hand.
- **FR-007**: The workflow that plans which libraries a change affects, and the one job that gates the rest, MUST be made by the same model when they are added.
- **FR-008**: The composite actions of `.github/actions/` MUST be made by the same generator from the same model, and a file whose name GitHub fixes (`action.yml`), which cannot carry `.auto.`, MUST begin with the line that says it is generated and by what, and be compared by `--check` like the others.

## Acceptance scenarios

1. **Given** a repository whose workflows are made from the model, **When** `generate-workflows.ts --check` runs, **Then** it writes nothing, names nothing and exits 0, per FR-001 and FR-004.
2. **Given** a workflow file edited by hand, **When** `--check` runs, **Then** it exits 1 and names the file, and running the generator writes it again, per FR-004.
3. **Given** a file `.github/workflows/extra.yml` written by hand, **When** `--check` runs, **Then** it exits 1 and names it as written by hand, per FR-001.
4. **Given** a job that needs a job that is not in the workflow, **When** the model is validated, **Then** the finding names the workflow, the job and the job it needs, and the generator writes nothing, per FR-002.
5. **Given** a step that uses `actions/checkout` with no version, **When** the model is validated, **Then** the finding names the step, per FR-005.
6. **Given** a folder `commons/alpha/` with a manifest, **When** the generator runs, **Then** `alpha.auto.yml` is written with a job that runs the manifest's `verify` in `commons/alpha`, and it runs when that folder or what the library imports changes, per FR-006.
7. **Given** the files the generator wrote, **When** a JSON Schema validator that is not this repository's reads each against the schema of GitHub workflows, **Then** none has an error, per FR-003.
8. **Given** the composite action `bun`, **When** the generator runs, **Then** `.github/actions/bun/action.yml` begins with the line that says it is generated, and `--check` compares it, per FR-008.

## Out of scope

- Running a workflow, or asking GitHub whether it accepts one: the schema's validation is the check, and a run is CI's.
- Which libraries a change affects and the planner and the gate that use it (FR-007 says only that they are made by this model).
- Another repository's workflows: `erga` has none today, and when it has, the model is the one it imports.

## Edge cases

- A workflow written by hand in the folder: found, never deleted, per FR-001.
- A generated file that no workflow makes (a workflow removed from the model, a library unregistered): found, per FR-004.
- A manifest that cannot be read: named, and the generator writes nothing, per FR-006.
- A Windows checkout of a file (CRLF line ends): the same file, per FR-004.
- A job with no step, an unknown trigger, a permission that is not `read`, `write` or `none`: refused by the compiler, per FR-002.
- A step that runs a script in a composite action and names no shell: found, per FR-002.
- An action pinned by a branch (`@main`): found, per FR-005.
- A library with no record of CI facts: given the job `verify` alone, per FR-006.

## Assumptions

- GitHub reads `*.yml` in `.github/workflows/`, so `<name>.auto.yml` is a workflow like any other, and the name of a workflow (`name:`), which a check's name begins with, is the model's `name`, so the checks that a branch rule names do not change when a workflow becomes generated.
- The schema of SchemaStore is the published description of the workflow format that tools use; GitHub's own is not published as a schema. Its edition is the copy kept here, fetched on 2026-11-19, and a newer one replaces it by a decision.
- The model's first workflows are the ones that were written by hand; they were compared with their files before the files were removed (what a YAML reader makes of each, in a one-time comparison reported in the commit that made them generated), and one thing changed on purpose: the job `tests` installs PyYAML, which the test of FR-003 uses.
- A workflow's `needs` with one job is written as a list; GitHub reads it as it reads the scalar.

## Open questions

- None.

## Key entities

- **Workflow** - a typed value: its name, its triggers, its jobs by id, their steps, matrices, permissions and concurrency.
- **Model** - `commons/ts/githost/workflows/`: the types, the validation, the YAML writer and the workflows of this repository.
- **Generator** - `commons/ts/tools/generate-workflows.ts`: writes the files, or with `--check` compares them.
- **Library CI record** - the facts of a library's CI that its manifest does not hold (the steps after `verify`, the command that runs its tests on Node).

## Success criteria

- **SC-001**: No file in `.github/workflows/` is written by hand, and a change to a workflow is a change to TypeScript that the compiler has checked.
- **SC-002**: Registering a library gives it its workflow with no file written by hand.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
