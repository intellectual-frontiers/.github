# Feature Specification: Workbench operate

**Spec ID:** 0007-workbench-operate
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A repository that is operated with a program (a fleet repository is the first) is set up by one command that a person types once and can type again: on Linux and macOS `curl ... | bash`, on Windows one line of PowerShell 7. Everything else is done by a generated script that checks before it acts, so that running it again changes nothing and says so. This specification is the typed plan and the two renderers of it; the product supplies the plan (its name, its pinned downloads, the steps that follow the install) and the library names no product.

## Requirements

- **FR-001**: An operate plan MUST be made by `defineOperate`, which MUST refuse, with every reason at once, a name or slug that is not a plain word, a version that is not `N.N.N`, a minimum above the version, a download that is not `https` or whose SHA-256 is not 64 hexadecimal digits, a platform other than `linux-x64` and `linux-arm64`, a name of an environment variable that is not upper case, a word of a command outside the safe alphabet (a command is an argument vector and never a shell line), a step named twice or with a name of a step of the library, and a text that looks like a secret; a credential MUST be only the NAME of an environment variable.
- **FR-002**: `operateSh` and `operatePs1` MUST be pure functions of the plan and of the digest the caller gives them: the same bytes for the same inputs, only printable ASCII, a first comment that says the file is generated and by what digest, and no value of a credential. The script for POSIX MUST assume Bash 5 or newer and stop with the line that installs it where it is older; the script for PowerShell MUST assume PowerShell 7 or newer (`#requires -Version 7`).
- **FR-003**: The two scripts MUST have the same steps in the same order, `git`, `gh`, `bun`, `sign-in`, `update`, `install` and then each converge step of the plan, and `operateSteps` MUST say them so that a test can hold that neither script has one the other lacks.
- **FR-004**: Every step MUST check before it acts and act only where the check fails; a run in which every check holds MUST change nothing and say `Nothing to do`; a step that acts MUST say what it did, and the run MUST stop at the first step that fails, with a line that names the step and what the person can do, and a non-zero exit status.
- **FR-005**: The tools MUST be found or obtained in this way and no other: Git and GitHub CLI by the system's package manager (`apt-get`, `dnf`, `pacman`, `brew` or `winget`); Bun, where the plan has a pinned download for the platform, from that download after its SHA-256 matches (a download that does not match is deleted and the step fails), and otherwise by `brew` or `winget`; never by the output of a program fetched and run unchecked. A Bun at or above the plan's minimum MUST be left as it is.
- **FR-006**: The sign-in MUST be GitHub CLI's own device flow (a code and a browser: the only act of a person), asked for with the scope `read:packages` and run at the terminal even when the script itself is read from a pipe; a sign-in that already holds with the scope MUST be left as it is; where the environment already holds a token (`GH_TOKEN`) the script MUST use it and run no sign-in.
- **FR-007**: The token that reads the plan's registry MUST be read from `gh auth token` into the variable the plan names, for the programs the script runs and nowhere else: it MUST NOT be printed, written to a file, put in an argument or in a stamp, and a variable the environment already holds MUST be respected.
- **FR-008**: `update` MUST bring the repository the script is in up to date by a fast-forward where it has a remote and a clean tree, and leave it as it is, and say so, where it has not. `install` MUST run `bun install --frozen-lockfile` only where the digest of `package.json` and of the lockfile differs from the stamp the last run kept (`.<slug>/operate.stamp`, digests only), and then keep the stamp.
- **FR-009**: A converge step MUST be `{ id, say, check, run }` with two argument vectors run without a shell in the repository: `run` only where `check` fails, and the step MUST hold afterwards or the run fails.
- **FR-010**: `bootstrapSh` and `bootstrapPs1` MUST be the public, generic first command: given the name of a repository (`owner/name`) and optionally a folder, they MUST install Git and GitHub CLI as FR-005 says, sign in as FR-006 says, clone the repository to the folder (`~/name` where none is given), leave a clone that is there to its own script to bring up to date (FR-008), and run that repository's own `bin/operate.sh` or `bin/operate.ps1`. They MUST name no product.
- **FR-011**: The files `bin/bootstrap.sh` and `bin/bootstrap.ps1` of the commons MUST be the output of `bootstrapSh` and `bootstrapPs1`, and a test MUST fail where they differ.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is checked, **Then** it holds, per FR-001.
2. **Given** the case of FR-002, **When** it is checked, **Then** it holds, per FR-002.
3. **Given** the case of FR-003, **When** it is checked, **Then** it holds, per FR-003.
4. **Given** the case of FR-004, **When** it is checked, **Then** it holds, per FR-004.
5. **Given** the case of FR-005, **When** it is checked, **Then** it holds, per FR-005.
6. **Given** the case of FR-006, **When** it is checked, **Then** it holds, per FR-006.
7. **Given** the case of FR-007, **When** it is checked, **Then** it holds, per FR-007.
8. **Given** the case of FR-008, **When** it is checked, **Then** it holds, per FR-008.
9. **Given** the case of FR-009, **When** it is checked, **Then** it holds, per FR-009.
10. **Given** the case of FR-010, **When** it is checked, **Then** it holds, per FR-010.
11. **Given** the case of FR-011, **When** it is checked, **Then** it holds, per FR-011.

## Out of scope

- Windows itself cannot be run by this library's tests; the PowerShell scripts are held by their text and by PSScriptAnalyzer where it is installed.
- Everything of the library that another of its specifications states.

## Edge cases

- A machine with no `/dev/tty` (a container, a pipe) skips the terminal redirect of the sign-in and relies on `GH_TOKEN`, per FR-006.
- A second user of the same machine has the same pinned Bun in their own folder, never in a shared one, per FR-005.

## Assumptions

- The stamp is a convenience that makes the second run fast: deleting it only makes the next run install again.

## Open questions

- None.

## Key entities

- **Operate plan**, **Converge step**, **Bootstrap**, **Stamp**.

## Success criteria

- **SC-001**: Every requirement of 0007-workbench-operate is proved by a test of the library, with made-up names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
