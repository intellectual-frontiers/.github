# Feature Specification: Runner bash

**Spec ID:** 0011-runner-bash
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The `bash` integration runner (0010-workload-runners): it emits a plan of calls as a script of super-safe modern Bash 5 or later, and nothing else. There is no POSIX `sh` subset and no backward compatibility. The script is only a sequence of calls to pinned CLI verbs by id, a loop over a fixed list and the order of the steps; every meaning stays in typed TypeScript.

## Requirements

- **FR-001**: The script MUST begin with `#!/usr/bin/env bash`, MUST fail fast, before any call, where `BASH_VERSINFO` is below 5, and MUST then set `set -Eeuo pipefail` and `shopt -s inherit_errexit`.
- **FR-002**: Every call MUST go through one function of the script that runs the pinned verb command with an array of arguments, as `verb`, the verb id and the inputs given as `--in name=value`, so that an id is never built from text, and every expansion MUST be quoted: the script MUST hold no `eval`, no backtick, no command substitution and no `source`, no unquoted expansion and no string built into a command.
- **FR-003**: An `each` MUST be a loop over an array literal of the fixed list, as `for member in "${members[@]}"`, and a call inside it MUST pass the member as `--member`.
- **FR-004**: An input of the run MUST be read from the environment variable `WORKLOAD_INPUT_<NAME>` with the unset check of `set -u`, a credential MUST appear only as a comment that names it, and the script MUST hold no secret and no value of a credential.
- **FR-005**: The script MUST set a trap on `EXIT` that writes one receipt line to the standard error, with the plan hash, the workload, the runner, the exit status and the step that was running, so that a failure leaves a receipt for ingest to pull.
- **FR-006**: The script MUST carry the plan hash and the derived autonomy of each step as comments, and the same plan MUST give the same bytes.
- **FR-007**: The emitter MUST be an instance of the unit `src/physical/runners/` that imports no other emitter and renders the plan of calls it is given, quoting every value so that no value changes how the script is read.

## Acceptance scenarios

1. **Given** the script, **When** its first lines are read, **Then** they are the shebang, the version check, the strict mode and `inherit_errexit`, and run with a lower version it fails before any call, per FR-001.
2. **Given** the script, **When** it is linted, **Then** it has no `eval`, no unquoted expansion and no command substitution, and `bash -n` and the shell linter accept it, per FR-002.
3. **Given** the bootstrap runbook, **When** the script is run against a fake verb command, **Then** the calls are the plan's, in order, with the member of the loop, per FR-003.
4. **Given** an input in the environment and none, **When** the script runs, **Then** the first is passed and the second fails before the call, and no value of a credential is in the script, per FR-004.
5. **Given** a call that fails, **When** the script runs, **Then** it stops, exits with that status and writes the receipt line with the step, per FR-005.
6. **Given** the same plan twice, **When** it is emitted, **Then** the bytes and the comments are the same, per FR-006.
7. **Given** the emitter, **When** its imports are read, **Then** it imports no other emitter, per FR-007.

## Out of scope

- Any shell other than Bash 5 or later, and any host that cannot run it.
- Installing the verb command: the host binds it.

## Edge cases

- A value with a single quote is quoted so that the quote cannot end the string, per FR-007.
- A value that is not printable ASCII is refused by the emit before it can reach the script (0010-workload-runners), and the quoting holds for the rest, per FR-007.

## Assumptions

- The verb command is on the `PATH` of the host under the name the emitter is given (`workload` by default), and it runs `verb <id> [--in name=value]... [--member m]`.

## Open questions

- None.

## Key entities

- **Script** - the artifact of the `bash` runner.
- **Receipt line** - the line the trap writes, which ingest pulls.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The Bash reference manual (as run: GNU bash 5.2.21 of this machine, whose `BASH_VERSINFO`, `set -Eeuo pipefail` and `shopt -s inherit_errexit` the tests run; `inherit_errexit` is Bash 4.4 or later) | Strict mode, the version array and the trap on `EXIT` | The behavior was run by the tests; the manual was not fetched, so no section is cited |
| ShellCheck (installed from the distribution's package, version 0.9.0) | A linter that finds an unquoted expansion and other hazards in a script | The tests run the program; its wiki was not fetched |

## Success criteria

- **SC-001**: Every requirement of 0011-runner-bash is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
