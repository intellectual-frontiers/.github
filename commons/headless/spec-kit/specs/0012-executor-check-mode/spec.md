# Feature Specification: Headless executor check mode

**Spec ID:** 0012-executor-check-mode
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** `archon` delegates convergence to real tools (Ansible, OpenTofu, DSC) through the `Executor` port and shows a person a plan before it applies one, with a hash a signature can cover (issue #11). The port ran one argument vector and returned when it ended. This increment gives it plan-versus-apply semantics: a plan of steps run in `check` or `apply` mode, a typed plan and result a surface can render, a canonical form and SHA-256 hash of a plan (no signing here), and typed events streamed to a surface while the run goes.

## Plan, mode and hash

- **FR-001**: A plan (`ExecutionPlan`, made only by `planOf`) MUST be a target and an ordered list of steps; each step MUST have a stable id (`StepId`, made only by `parseStepId`), a summary, an effect (`read`, `mutate`, `destructive`), the argument vector that applies it, the argument vector that checks it (none where the tool has no check mode) and, where the check signals a change by its exit status, that status (`changedExit`, 1 to 255). `planOf` MUST return every problem as a value (`plan/target`, `plan/empty`, `plan/duplicate-step`, `plan/argv`, `plan/destructive-no-check`, `plan/changed-exit`) and a destructive step MUST have a check vector, as a destructive action must preview itself (0002-headless-governance FR-003).
- **FR-002**: A plan MUST run in one of two modes: in `check` only the check vector of a step is run, never its apply vector, and a step with no check vector MUST be reported `unsupported` and not run; in `apply` the apply vector is run. A check step MUST end `unchanged` (it succeeded), `changed` (it ended with `changedExit`) or `failed`; an apply step `applied` or `failed`; a step after a failure MUST be `skipped` unless `stopOnFailure` is false, and so MUST every step after the run's signal is aborted.
- **FR-003**: The run MUST end in a typed result (`ExecutionResult`: the mode, the plan's hash, each step's result and the outcome `unchanged`, `changed`, `applied`, `failed` or `incomplete`), `failed` where a step failed, `incomplete` where one is unsupported or skipped; an executor that throws MUST make that step `failed` and MUST NOT make the run throw.
- **FR-004**: The canonical form of a plan (`canonicalOf`) MUST be JSON with the keys of every object in order, no space and the steps and vectors in their order, so that the same plan is the same text on every runtime; its hash (`PlanHash`, made only by `planHash` or `parsePlanHash`) MUST be `sha256:` and the 64 hexadecimal digits of the SHA-256 of that text (`sha256Hex`, pure and checked against the published vectors); a change to any step, vector, effect or the target MUST change the hash, and the environment and working folder a step runs with MUST NOT be part of the plan. This library MUST NOT sign or verify a signature and MUST hold no key.
- **FR-005**: An apply MUST name its approval: the hash of the plan approved (`hash`) or an explicit `unsigned`; where the hash is not the plan's the run MUST be refused with `plan-changed` and MUST run nothing, so that a signed hash cannot approve another plan and a replayed hash cannot approve a changed one.

## Streaming to a surface

- **FR-006**: A run MUST tell a surface as it goes, with typed events: `started` (the step, its summary, the mode, its index and the total), `line` (the step, the stream and a line of its output, as it comes, or from the output at the end for an executor that does not stream), `finished` (the step's result) and `progress` (steps done of the total), in the order a step started, its lines, finished, progress; no event MAY be lost or reordered, and each line MUST pass through the run's redaction before it is shown (the command forwards `progressOf`, and the run redacts progress, 0011-credential-prompt FR-005).
- **FR-007**: A surface MUST be able to render a plan and a result: `describePlan` gives the target, the hash and a line for each step with its effect and whether it can be checked, and `progressOf` gives the progress event of the command line for each execution event (the step, the live line, the item `ok`, `change`, `note` or `skip`, and a `fail` problem with the stable code `E1-EXEC-STEP`).

## Acceptance scenarios

1. **Given** a plan whose second step has no check vector, **When** it runs in `check`, **Then** the first step ran its check vector, the second is `unsupported` and not run, and the outcome is `incomplete`, per FR-002 and FR-003.
2. **Given** a signed hash of a plan, **When** the plan is changed by one word and applied with that hash, **Then** the run is `plan-changed` and nothing ran, per FR-005.
3. **Given** an executor that streams, **When** a step prints two lines, **Then** the events are started, line, line, finished, progress, per FR-006.
4. **Given** the text `abc`, **When** it is hashed, **Then** the digest is `ba7816bf...15ad`, per FR-004.
5. **Given** a destructive step with no check vector, **When** the plan is made, **Then** `plan/destructive-no-check`, per FR-001.

## Out of scope

- Signing, verifying and storing signatures (`signing`), and what a person must see before approving (`archon`).
- Rolling back an applied plan.
- Running the steps of a plan in parallel.

## Edge cases

- A check that exits with a status that is neither 0 nor `changedExit`: it is `failed`, per FR-002.
- An executor that ignores the `onLine` option: the lines come from its output at the end, per FR-006.

## Assumptions

- A tool's check mode is the tool's own (`--check`, `plan`), and its exit status says whether anything would change where it can.

## Open questions

- None.

## Key entities

- **Execution plan** - the steps, each with its check and apply vectors.
- **Plan hash** - the digest a signature covers.

## Success criteria

- **SC-001**: A person sees what would change, signs the hash of that plan, and the apply refuses anything else.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
