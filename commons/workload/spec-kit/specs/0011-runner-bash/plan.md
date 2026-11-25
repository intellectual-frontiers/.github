# Plan: 0011-runner-bash

**Spec:** 0011-runner-bash. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The Bash reference manual (as run: GNU bash 5.2.21 of this machine) | Strict mode, the version array and the trap on `EXIT` | The behavior was run by the tests; the manual was not fetched |
| ShellCheck (distribution package, version 0.9.0) | A linter for unquoted expansions and other hazards | The tests run the program |

## What is built and what is reused

Reused: the plan of calls and the plan hash of 0010-workload-runners. New: the renderer of the plan of calls as a Bash script and its tests, which run it against a fake verb command.
