# Feature Specification: Steps of a pipeline under the build policy

**Spec ID:** 0013-repoctl-ci
**Status:** Draft
**Owner:** if
**Domain:** repoctl

**Input:** A step of a pipeline that runs a module's command must not turn the run red for what the module says. The wrapper that makes a command a step of findings is a dependency-free program of the libraries library (commons 0002-libraries-ci-findings FR-004), run directly by the workflows; `repoctl ci step` is the same program as a verb, for a person who wants to see what the wrapper makes of a command and for a repository whose configuration turns it on (commons 0038-build-policy FR-013).

## The verb

- **FR-001**: The verb `ci step` MUST be declared once in the table of verbs (a local action of the contributor tier that is never served by a tool server, since it runs a command), MUST come only where the configuration turns the capability `ci` on, and MUST NOT need a configuration to run.
- **FR-002**: `repoctl ci step --id ID [--job JOB] [--module NAME] [--tool TOOL] [--timeout MINUTES] [--out DIR] -- COMMAND...` MUST run the command with the time limit, print what it printed, write the file of the step to the folder and end 0 whatever the command's own status was, saying how many findings the step has; and MUST end with the status of a usage error (2) only where the call is wrong: no command, an id that is not letters, digits, dots, hyphens and underscores, a tool outside the closed table, or a limit that is not a number of minutes above 0.

## Acceptance scenarios

1. **Given** a command that exits 1 after printing a failing test, **When** `repoctl ci step --tool bun-test -- COMMAND` runs it, **Then** it ends 0, the file of the step holds the finding and the output was printed, per FR-002.
2. **Given** a call with no command, **When** the verb runs, **Then** it ends 2 and says why, per FR-002.

## Out of scope

- The parsers, the file of a step and the history: commons 0002-libraries-ci-findings.

## Edge cases

- A configuration that does not turn `ci` on: the verb is not there, per FR-001.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Step** - one command of a pipeline, run so that what it says is a finding.

## Success criteria

- **SC-001**: A failing command is a finding and never a red step.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
