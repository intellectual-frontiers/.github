# Feature Specification: Findings of the build, in the libraries library

**Spec ID:** 0002-libraries-ci-findings
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The build policy of the repository (commons 0038-build-policy) is written once, as code, in `commons/libraries/src/ci/`: the closed list of red causes, the finding and its status, the parsers of the tools, the step wrapper, the inventory and validation of the workflows, the collector, the history branch and the release gate. These files import no package, so that they run in a cell of the matrix before the cell's packages are installed. The workflows are made from them by `src/workflows/definitions.ts` (commons 0030-generated-workflows).

## The policy as code

- **FR-001**: `src/ci/policy.ts` MUST hold, as values with no import, the closed list of red causes and the sentence that justifies each, the closed table of tools, the gates, the union `StepPolicy` (a red cause, a step of findings with its tool, time limit, module and `errexit`, a gate, or plumbing), the list of approvers, the longest an acceptance lasts, and the release policy with its function `releaseDecision`, which publishes regardless on every day, carries the finding `owner-review-due` after the day of the policy until the owner has reviewed it, and holds only by a recorded decision of the owner (the owner's login, from the day it names) and never by itself (commons 0038-build-policy FR-002, FR-008, FR-010).
- **FR-002**: `src/ci/findings.ts` MUST hold the finding with its identity made from the tool, the code, the module, the file and the key and from nothing that changes between runs, the file of a run (`build-findings/1`) and its decoder, the rules of an acceptance, and the derivation of the status of each finding from a history of runs and the acceptances: open, fixed or accepted, a module that did not run keeping the status of the last run in which it did, and an acceptance that has ended leaving the finding open with the note (commons 0038-build-policy FR-006, FR-007, FR-008).
- **FR-003**: `src/ci/parsers.ts` MUST read the output of each tool of the table into findings, purely, with the file, the line, the code and a key that is not a line; it MUST read the output the tools print (kept as fixtures of the tests), make nothing up, give a finding no more than once, and give a step that failed with nothing a parser reads the finding `no-output`, one that could not be started `tool-error` and one stopped by its limit `timeout` (commons 0038-build-policy FR-013).
- **FR-004**: `src/ci/step.ts` MUST run one command with a time limit that stops its whole process group, print what the command printed as it was printed, write the file of the step, give the later steps of the job the outputs `outcome`, `detail` and `findings`, and exit 0 whatever the command's status was; the one status that is not 0 is 2, for a call with no command, an unknown tool, a bad id or a limit that is not a number (commons 0038-build-policy FR-002, FR-004, FR-013).
- **FR-005**: `src/ci/inventory.ts` and `src/ci/wrap.ts` MUST give every step of every workflow of the model its policy by an ordered list of rules with their reasons, make the table of steps with the count of each policy, put the wrapper on the steps of findings (the script moves into the environment of the step), end each job that makes findings by keeping them, make the job that gathers a workflow's findings, and find in a workflow a step with no policy, a step of findings that is not wrapped or whose limit is not below its job's, a matrix that fails fast, plumbing that is not `continueOnError` and a job after a matrix that does not run with `always()`; the generator MUST write nothing while there is one (commons 0038-build-policy FR-003, FR-004, FR-005).
- **FR-006**: `src/ci/collect.ts` MUST merge the files the steps wrote into one file of the run, make sure that every cell that ran left its file and end 2 (the red cause `reports-not-produced`) where one did not and in no other case, write the merged file and a summary, give the commit the check `findings` with the conclusion `neutral` or `success` and never `failure`, and add the finding `owner-review-due` where the release policy has ended and the owner has not reviewed it; it MUST NOT write the history (commons 0038-build-policy FR-005, FR-011, FR-012).
- **FR-007**: `src/ci/history.ts` MUST keep a run as one new file of the orphan branch `findings-history` at `runs/YYYY/MM/DD/<workflow>-<run id>.json` by a commit that adds a file and changes none, never replace a file that is there, push as a fast-forward and, where the branch moved, retry from its new tip and never force; and MUST read the files of the branch, oldest first; as a program (`history.ts --file FILE --remote URL`) it is what the job `keep-findings` runs, says where the file is not a findings file and is never a failure (commons 0038-build-policy FR-012).
- **FR-008**: `src/ci/release-gate.ts` MUST say what the release policy lets the run do on a day, list the open findings of each module of the history, and end 1, as the release's own decision, only where a recorded decision of the owner holds the package (commons 0038-build-policy FR-010).

- **FR-009**: `src/ci/accepted.ts` MUST read the accepted risks of `commons/spec-kit/accepted-findings/` (typed files with an export `acceptance`) and find an acceptance with no reason, an end that is not a day or is more than 366 days ahead, an approver who is not on the list, a file not named for its finding's id and two acceptances of one finding, and end 1 for any; the check MUST be one of `repoctl check` (commons 0038-build-policy FR-008).
- **FR-010**: `src/ci/policy.ts` MUST hold, as the one typed table that Repoctl, Agora and the generated workflows read, the class of each check a repository runs before a release (`CHECKS`, `CHECK_CLASS`): `blocking` for exactly a file the parser refuses (`syntax`), a type error including the type surface of the exports (`types`), a package that does not pack, install or import (`pack`) and a credential in what is published (`secret-scan`, kept blocking until the owner decides otherwise), and `finding` for every other check (size, style, the coverage of requirements, the shape of the repository, the state of the installed packages and a failing test), each with the sentence that says why. A check of class `finding` MUST still run and MUST be recorded and printed, and MUST NOT end a release or its tag; failing tests MUST be said loudly in the summary and MUST keep holding acceptance, which is a stage of its own. The owner's hold of the release policy and the approvals of a person are stages of a workflow and MUST NOT be in the table.

## Acceptance scenarios

1. **Given** the output of `tsc`, `bun test`, the linter, the formatter, `repoctl check`, the checks of Mizan and Kanon and the generator's check as the tools printed it, **When** the parsers read it, **Then** each gives its findings with the file, the line and the code, per FR-003.
2. **Given** a command that fails, prints nothing, does not exist or does not end, **When** the wrapper runs it, **Then** it exits 0 and the file says `findings`, `no-output`, `tool-error` or `timeout`, per FR-004.
3. **Given** a step added to a workflow with no rule that matches it, **When** the generator runs, **Then** it writes nothing and names the step, per FR-005.
4. **Given** a cell of the matrix that ran and left no file, **When** the gathering job runs, **Then** it ends 2 and no other case ends it red, per FR-006.
5. **Given** two runs that push at once, **When** the second finds the branch moved, **Then** it retries from the new tip and both files are on the branch, per FR-007.

## Out of scope

- The verb `repoctl ci step` and the page of findings: the specifications of repoctl and of the documentation generator.

## Edge cases

- A findings file that is not one: named by the gathering job and left out of the merge, per FR-006.
- A history branch that is not there: made orphan by the first run, per FR-007.

## Assumptions

- Real `git` and `gh` are on the runner.

## Open questions

- None.

## Key entities

- **Policy** - `src/ci/policy.ts`.
- **Finding** - `src/ci/findings.ts`.
- **Wrapper** - `src/ci/step.ts`.

## Success criteria

- **SC-001**: A failing module's words are findings and never a red run, shown by a test over the typed workflows and by a run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
