# Feature Specification: Install locations

**Spec ID:** 0031-install-locations
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** What a program of ours leaves on a person's computer goes where the system and the tools we depend on already put such things, and never where we made up: the XDG Base Directory Specification on Linux and macOS (as `git` and `gh` do on both), Windows' known folders on Windows (as `gh` does), the `XDG_*` variables honored on every system where they are set, and WinGet for what is installed on Windows. A program's own folders are made from one typed module that takes the system and the environment as values, so that one test proves every system's paths.

## Where a program keeps its files

- **FR-001**: The module `runtime/dirs.ts` MUST give, for a program's name, a system and an environment, its config, data, state, cache and runtime folders and its binary folder: on Linux and macOS `$XDG_CONFIG_HOME`, `$XDG_DATA_HOME`, `$XDG_STATE_HOME`, `$XDG_CACHE_HOME` and `$XDG_RUNTIME_DIR` with the program's name below each, else `~/.config`, `~/.local/share`, `~/.local/state`, `~/.cache` (and no runtime folder), and `~/.local/bin`; and on Windows `%APPDATA%\<name>` for config and `%LOCALAPPDATA%\<name>`, `%LOCALAPPDATA%\<name>\state` and `%LOCALAPPDATA%\<name>\cache` for the others, with no binary folder.
- **FR-002**: A value of an `XDG_*` variable MUST be honored on every system where it is set to an absolute path, Windows included, and MUST be ignored where it is not an absolute path.
- **FR-003**: macOS MUST use the same folders as Linux, and MUST NOT use `~/Library`, because `git` and `gh`, which this work stands on, do not.
- **FR-004**: A folder MUST be undefined, and never guessed, where no home folder can be found and no variable names it.

## What is installed, and by whom

- **FR-005**: A program MUST NOT write an executable, a command file or a shim of its own into a folder that it made up or into one that another installer owns (a runtime's global folder, WinGet's links); it is installed by the runtime's global install (`bun add -g`, `npm install -g`) or by WinGet, and a program that a person puts by hand goes to `~/.local/bin`.
- **FR-006**: On Windows a prerequisite (Bun, Node 26, Git, GitHub CLI) MUST be installed with `winget`, by its package identifier, and never by a download of ours put in a folder of ours.
- **FR-007**: The WinGet package identifier of Ergonex MUST be `IntellectualFrontiers.Ergonex`, and a WinGet manifest MUST be made, as typed code made into YAML, only for a release that has a binary for it.

## Acceptance scenarios

1. **Given** `HOME=/home/a` and no `XDG_*` variable, **When** the folders of `ergonex` are asked for on Linux, **Then** config is `/home/a/.config/ergonex`, data `/home/a/.local/share/ergonex`, state `/home/a/.local/state/ergonex`, cache `/home/a/.cache/ergonex`, there is no runtime folder and the binary folder is `/home/a/.local/bin`, per FR-001.
2. **Given** `XDG_CONFIG_HOME=/x/cfg`, **When** they are asked for on Linux, **Then** config is `/x/cfg/ergonex`, per FR-001 and FR-002.
3. **Given** `XDG_DATA_HOME=relative/dir`, **When** they are asked for, **Then** it is ignored and data is `~/.local/share/ergonex`, per FR-002.
4. **Given** the same environment, **When** the folders are asked for on macOS, **Then** they are the same as on Linux, per FR-003.
5. **Given** `APPDATA` and `LOCALAPPDATA` on Windows, **When** they are asked for, **Then** config is `%APPDATA%\ergonex` and data, state and cache are below `%LOCALAPPDATA%\ergonex`, and there is no binary folder, per FR-001.
6. **Given** `XDG_STATE_HOME=C:\s` on Windows, **When** they are asked for, **Then** state is `C:\s\ergonex`, per FR-002.
7. **Given** no `HOME` and no variable, **When** they are asked for on Linux, **Then** every folder is undefined, per FR-004.

## Out of scope

- Where a person keeps the repositories of a workspace (`~/workspaces`, which a person chooses): it is the person's work, not a program's files.
- The files a shell reads at its start (`~/.bashrc`, a PowerShell profile): they are the shell's, and a program edits them only on a person's request.

## Edge cases

- `XDG_RUNTIME_DIR` not set: no runtime folder, and the program keeps its locks in its state folder, per FR-001.
- `LOCALAPPDATA` not set on Windows: `~\AppData\Local`, per FR-001.
- A Windows path in an `XDG_*` variable written with `/` (as Git Bash gives it): honored, per FR-002.
- A program installed by `bunx` and never installed globally: it leaves nothing in these folders but what it makes when it runs, per FR-005.

## Assumptions

- `git` and `gh` follow XDG on macOS (`~/.config/git`, `~/.config/gh`), and `gh` keeps its config in `%APPDATA%\GitHub CLI` on Windows; the editions of the standards are marked to verify in the term audit.
- Bun or Node 26 is a prerequisite, because all our code is TypeScript; no binary of ours is shipped yet, so none is signed and no WinGet manifest is made (FR-007).

## Open questions

- None.

## Key entities

- **Dirs** - the folders a program keeps its files in, from its name, the system and the environment.
- **Prerequisite** - Bun or Node 26, Git and GitHub CLI.

## Success criteria

- **SC-001**: Nothing we install creates a folder under a person's home that is not one of these, and a person who knows XDG or Windows' folders finds each file where they expect it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
