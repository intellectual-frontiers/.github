# Plan: 0012-runner-powershell

**Spec:** 0012-runner-powershell. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| PowerShell 7 (as run: PowerShell 7.4.6 for Linux of the machine of the tests) | `#Requires -Version`, `Set-StrictMode`, `$ErrorActionPreference` and `$LASTEXITCODE` | The behavior was run by the tests; the documentation was not fetched |

## What is built and what is reused

Reused: the plan of calls and the plan hash of 0010-workload-runners, and the golden comparison with the `bash` script of 0011-runner-bash. New: the renderer of the plan of calls as a PowerShell script and its tests, which run it against a fake verb command where `pwsh` is installed.
