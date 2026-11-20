# Feature Specification: Onboarding

**Spec ID:** 0004-onboarding
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A person who has never set up a repository, and a person who has set up hundreds, start the same way: they install Bun (or Node 26 as the backup), run `bunx @intellectual-frontiers/ergonex init`, and from then on `ergonex` is a command in every shell they open, with their GitHub sign-in available to the package managers that read this organization's packages. It works on Windows first, then macOS, then Linux, and says in plain words what it did and what to do next.

## From nothing to a workspace

- **FR-001**: The package `@intellectual-frontiers/ergonex` MUST run from npm with `bunx @intellectual-frontiers/ergonex <command>` on Bun and with `npx @intellectual-frontiers/ergonex <command>` on Node 26, on Windows, macOS and Linux, without a token, and MUST be published to the GitHub package registry as well (commons 0027-commons-libraries FR-015, FR-016).
- **FR-002**: `ergonex init` MUST make the workspace root and the workspace's own area, write the starter manifest where there is none, and put the command `ergonex` on the person's path for the shells they open later by the runtime's own global install (`bun add -g`, or `npm install -g` where Node ran it) and no command file or shim of its own, MUST change nothing else on the host (`--no-install` makes the root only) and MUST say each thing it did in plain words, and a run from a checkout, which is not installed, MUST say how to run it.
- **FR-003**: IF `ergonex` is run with no command, THEN it MUST say in plain words what to do next (`init` where there is no workspace, `doctor` where there is one) and MUST NOT print a stack trace or an internal name.
- **FR-004**: `ergonex shell print <shell>` MUST set `ERGONEX_GITHUB_TOKEN` from the person's GitHub sign-in (`gh auth token`, run when the shell starts), only where `gh` is installed and signed in and the variable is not set already, MUST NOT write the token to a file and MUST NOT set `GITHUB_TOKEN` or `GH_TOKEN`, which `gh` itself would then use in place of its own sign-in.
- **FR-005**: The configuration of a package manager that this library writes or reads MUST refer to the token by the name `ERGONEX_GITHUB_TOKEN` and MUST NOT hold its value.
- **FR-006**: `ergonex doctor` MUST say whether the token is there and whether it may read packages (the scope `read:packages`), and MUST say the command that fixes it (`gh auth refresh -s read:packages`) where it may not.

## On every system

- **FR-007**: Every command MUST give the same report on Windows (Windows PowerShell 5.1 and PowerShell 7, `cmd` and Git Bash), macOS and Linux, and a program MUST be run by its arguments, never through a shell's parsing of a line, so that a path with a space, a quote or a character outside ASCII is one argument.
- **FR-008**: The installers `ergonex-install.ps1` and `ergonex-install.sh` MUST use the Bun that is there (or Node 26 where a person asks for it) and where there is none install it the way the platform installs programs, with `winget` by package identifier on Windows (Git and GitHub CLI too) and with Bun's own installer at the version commons pins on Linux and macOS, downloading nothing for themselves and putting nothing in a folder of their own (commons 0031-install-locations FR-006), and then run the command of FR-001, the one for Windows first; a script for Windows PowerShell 5.1 MUST carry a byte order mark or be ASCII, so that it is read as it is written, and the generated installers keep the line ends of generated files (LF).
- **FR-009**: The library's own checks MUST run on Windows, macOS and Linux in CI, Windows first, on Bun and on Node 26.
- **FR-010**: `ergonex paths` MUST say where ergonex keeps its files, so that a person who knows XDG or Windows' folders finds each where they expect it: the workspace, its own folder beside the repositories, the state folder, the data folder, the tools folder, the folder of the shims and the cache.

## Acceptance scenarios

1. **Given** a computer with Bun and no workspace, **When** the person runs `bunx @intellectual-frontiers/ergonex init`, **Then** the root and the starter manifest are made, `ergonex` is on the path of the next shell and the report says what was done, per FR-001 and FR-002.
2. **Given** `ergonex` with no command and no workspace, **When** it runs, **Then** it says to run `ergonex init`, per FR-003.
3. **Given** `gh` signed in, **When** a shell sources the snippet, **Then** `ERGONEX_GITHUB_TOKEN` is the token of the sign-in and `GITHUB_TOKEN` is not set, per FR-004.
4. **Given** `gh` not installed, **When** a shell sources the snippet, **Then** nothing is set and nothing is said, per FR-004.
5. **Given** a token with no scope for packages, **When** `ergonex doctor` runs, **Then** it says that it cannot read packages and gives the command that adds the scope, per FR-006.
6. **Given** a folder whose name has a space and a letter outside ASCII, **When** a command runs on Windows, **Then** it works on that folder as it does on Linux, per FR-007.
7. **Given** a workspace, **When** `ergonex paths` runs, **Then** it names the workspace, `.ergonex/` beside the repositories, and the state, data, tools, shims and cache folders, per FR-010.

## Out of scope

- The registries' side of publishing (the owner's npm scope and its trusted publisher): a person with the right on them does it once.
- Package and repository management beyond the workspace: later modules of `ergonex`.

## Edge cases

- `ERGONEX_GITHUB_TOKEN` already set: left as it is, per FR-004.
- `gh auth token` fails or prints nothing: the variable is left unset, per FR-004.
- A shell that is not one of the five (bash, zsh, fish, PowerShell, Nushell): refused with the five named, per FR-003.
- No global install is possible (no write right on the runtime's folder, or a package that is not published yet): it says so with the command to run by hand and `bunx` or `npx` as the other way, and writes no command file of its own, per FR-002.
- A run from a checkout, which is not installed: it says how to run it, per FR-002.
- A path with a space, a quote or a character outside ASCII: one argument, per FR-007.
- Windows PowerShell 5.1 reading a script with no byte order mark: the script is ASCII or carries one, per FR-008.

## Assumptions

- Bun and Node 26 run on all three systems, and `gh` (GitHub CLI) is installed by `ergonex setup` where it is missing.
- The package is public on npm, so that the first run needs no token; the token is for the other packages of this organization, which are private on the GitHub package registry.

## Open questions

- None.

## Key entities

- **Workspace root** - the folder that holds the repositories, laid out like their remotes, and the workspace's own area `.ergonex`.
- **Token** - the person's GitHub sign-in as `ERGONEX_GITHUB_TOKEN`, in the environment of a shell and in no file.
- **Installer** - a script that installs the runtime and runs `ergonex init`.

## Success criteria

- **SC-001**: A person who has never used a terminal for repositories can get to a working workspace with one pasted command per system.
- **SC-002**: No token is written to any file by this library.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
