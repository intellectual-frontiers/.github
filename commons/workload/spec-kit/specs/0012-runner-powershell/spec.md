# Feature Specification: Runner powershell

**Spec ID:** 0012-runner-powershell
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The `pwsh` integration runner (0010-workload-runners): it emits a plan of calls as a script of modern PowerShell 7 or later, and nothing else. There is no Windows PowerShell 5.1. The script is only a sequence of calls to pinned CLI verbs by id, a loop over a fixed list and the order of the steps, and it sequences the same verbs as the `bash` script of the same plan (0011-runner-bash).

## Requirements

- **FR-001**: The script MUST begin with `#Requires -Version 7.0` and MUST then set `Set-StrictMode -Version Latest` and `$ErrorActionPreference = 'Stop'`.
- **FR-002**: Every call MUST go through one function of the script that runs the pinned verb command with an array of arguments, as `verb`, the verb id and the inputs given as `--in name=value`, MUST check `$LASTEXITCODE` after the native call and MUST stop the script with that status where it is not 0; the script MUST hold no `Invoke-Expression`, no `iex`, no `Start-Process` with a built string, no string built into a command and no dot-sourcing, and every value MUST be a single-quoted string.
- **FR-003**: An `each` MUST be a `foreach` over an array literal of the fixed list, and a call inside it MUST pass the member as `--member`.
- **FR-004**: An input of the run MUST be read from the environment variable `WORKLOAD_INPUT_<NAME>` and a missing one MUST stop the script before the call; a credential MUST appear only as a comment that names it, and the script MUST hold no secret and no value of a credential.
- **FR-005**: The script MUST write one receipt line to the error stream, with the plan hash, the workload, the runner, the exit status and the step that was running, from a `finally` block, so that a failure leaves a receipt for ingest to pull, and the script MUST exit with the status of the failed call.
- **FR-006**: The script MUST carry the plan hash and the derived autonomy of each step as comments, and the same plan MUST give the same bytes.
- **FR-007**: The emitter MUST be an instance of the unit `src/physical/runners/` that imports no other emitter and renders the plan of calls it is given, doubling every single quote of a value so that no value changes how the script is read.
- **FR-008**: The script MUST call the same verbs in the same order, with the same inputs and members, as the `bash` script of the same plan.

## Acceptance scenarios

1. **Given** the script, **When** its first lines are read, **Then** they are the version requirement, the strict mode and the stop preference, per FR-001.
2. **Given** the script, **When** it is read, **Then** it has no `Invoke-Expression`, no string built into a command and a check of `$LASTEXITCODE` after the one native call, per FR-002.
3. **Given** the bootstrap runbook, **When** the script is run against a fake verb command, **Then** the calls are the plan's, in order, with the member of the loop, per FR-003.
4. **Given** an input in the environment and none, **When** the script runs, **Then** the first is passed and the second stops the script before the call, per FR-004.
5. **Given** a call that fails, **When** the script runs, **Then** it stops with that status and writes the receipt line with the step, per FR-005.
6. **Given** the same plan twice, **When** it is emitted, **Then** the bytes are the same, per FR-006.
7. **Given** the emitter, **When** its imports are read, **Then** it imports no other emitter, per FR-007.
8. **Given** the two scripts of the bootstrap runbook run against the same fake command, **When** the calls are compared, **Then** they are the same, per FR-008.

## Out of scope

- Windows PowerShell 5.1, and any shell other than PowerShell 7 or later.
- Installing the verb command: the host binds it.

## Edge cases

- A value with a single quote has it doubled, which PowerShell reads as one quote inside a single-quoted string, per FR-007.
- A value that is not printable ASCII is refused before it reaches the script, which also keeps the typographic quotes that PowerShell reads as quotes out of a string, per FR-007.
- In PowerShell 7.3 and later the arguments of a native command are passed as the array gives them; the version the script requires is 7.0, and the tests run it on the version installed on the machine that runs them, per FR-002.

## Assumptions

- The verb command is on the `PATH` of the host under the name the emitter is given (`workload` by default), and it runs `verb <id> [--in name=value]... [--member m]`.

## Open questions

- None.

## Key entities

- **Script** - the artifact of the `pwsh` runner.
- **Receipt line** - the line the `finally` block writes, which ingest pulls.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| PowerShell 7 (as run: PowerShell 7.4.6 for Linux installed on the machine of the tests from its published release, whose archive was checked against the SHA-256 the release publishes) | `#Requires -Version`, `Set-StrictMode`, `$ErrorActionPreference` and `$LASTEXITCODE` | The behavior was run by the tests; the documentation was not fetched, so no section is cited |

## Success criteria

- **SC-001**: Every requirement of 0012-runner-powershell is proved by a test of the library, with synthetic names and no network. Where `pwsh` is not installed the tests that run the script are skipped and say so, and the structural checks still run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
