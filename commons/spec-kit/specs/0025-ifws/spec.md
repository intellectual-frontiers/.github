# Feature Specification: The ifws command

**Spec ID:** 0025-ifws
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** `ifws`, the command of Intellectual Frontiers Workspaces (0023-if-workspaces), in the style of `git`: a controller that runs the module `ifws-<name>` for `ifws <name>`, found among typed built-in modules, modules the workspace registers and executables named `ifws-*` on the `PATH`; a typed contract for a module; four exit codes; the commands `plan`, `apply`, `status`, `doctor`, `verify`, `worktree`, `tools`, `render`, `list`, `shell` and `setup`, of which `setup` alone installs anything or changes the host; on Bun by default and Node 26 as the backup.

## The command

- **FR-001**: The controller MUST be `commons/ts/workspaces/ifws.ts`, the library MUST be in the same folder, `commons/ts/workspaces/`, the commands in `commons/ts/workspaces/commands/` and the module contract in `commons/ts/workspaces/modules/`, and the package's `bin` MUST gain `ifws`.
- **FR-002**: `ifws` manages only Intellectual Frontiers Workspaces; it is not a general IFC or Mizan controller and does not front `ifc`, and `ifws --help` MUST say so in these words.
- **FR-003**: `ifws <name> [arguments]` MUST run the module `ifws-<name>` with the arguments, `ifws help` MUST describe the command and `ifws list` MUST list every module with its name, its source (`ifws:BuiltIn`, `ifws:Registered` or `ifws:Path`) and its summary.

## Modules

- **FR-004**: A module MUST be looked for in the order of `ifws:precedence` of its source: first among the typed built-in modules (a registry whose every entry the compiler checks), then among the modules the workspace registers in `<home>/.if-workspaces/modules.auto.json`, then among the executables named `ifws-*` on the `PATH` (with the extensions of `PATHEXT` on Windows), as Git finds `git-foo` for `git foo`; the first found MUST run, and a module of a later source that it hides MUST be an `ifws:Informational` finding.
- **FR-005**: A module name MUST be lower-case letters, digits and hyphens, beginning with a letter, and a name with any other character, with a path separator or longer than 32 characters MUST be refused with exit status `ifws:Usage` and never passed to a shell.
- **FR-006**: IF no module is named as given, THEN `ifws` MUST exit with `ifws:Usage` and name up to three modules within an edit distance of two of it, or say that none is near.
- **FR-007**: A module MUST be typed: `IfwsModule` (`name`, `summary`, `commands`) with `Command` (`name`, `summary`, `args`, a decoder of the arguments, and `run(ctx)`, which returns a `Result` of a report or a failure), with no `any`, and a `switch` over a union of commands MUST be exhaustive.
- **FR-008**: An external module MUST answer `--ifws-manifest` on standard output with JSON (its name, its summary, its commands and the version of this contract) that a typed decoder checks and whose JSON Schema is generated from the type, and an external module that does not answer within five seconds, or whose answer does not decode, MUST run as an opaque command whose exit status is recorded in the evidence.
- **FR-009**: `ifws list` and `ifws help` MUST NOT run a module found on the `PATH` unless `--probe` is given, so that listing never runs a program the workspace has not approved.
- **FR-010**: A run MUST end with one of the statuses `ifws:Ok` (0), `ifws:Findings` (1), `ifws:Usage` (2) and `ifws:Environment` (3): 1 where there is at least one finding of severity `ifws:Warning` or `ifws:Error` and no `ifws:Informational` finding alone makes it 1; 2 for an unknown command, option or argument; 3 where the host cannot do it (no `git`, an unsupported runtime, a root that does not exist or cannot be written, an evidence record that cannot be written); a typed external module MUST use the same four, and an opaque one's own status MUST be passed on and recorded.
- **FR-011**: A registered module MUST be named in `modules.auto.json` with the path of its program and MAY carry the SHA-256 of that program, which `ifws` MUST check before running it and MUST refuse the module, with exit status `ifws:Environment`, where it differs; a registered module or one on the `PATH` that the catalog does not list MUST be a finding as in 0023-if-workspaces FR-033.

## The commands

- **FR-012**: `ifws plan` MUST show the typed plan and change nothing, and `ifws apply` MUST carry it out as 0023-if-workspaces FR-022 to FR-030 say, with no action of a kind that is `ifws:hostChange` and no destructive action without `--allow-destructive`.
- **FR-013**: `ifws status` MUST list every repository of the manifest, one line each in the order of its path, with its `ifws:RepoState`, how many commits it is ahead and behind, its stashes, its untracked files and whether it is locked; it MUST NOT use the network unless `--fetch` is given, and it MUST exit with `ifws:Findings` where a repository is `ifws:Diverged`, `ifws:Locked`, `ifws:WrongRemote` or `ifws:NotARepo`.
- **FR-014**: `ifws doctor` MUST check the runtime and the tools, the layout and the portability of every path, the file system, the policy (the plaintext-token scan, signed commits, tools and modules outside the catalog) and the generated files, and MUST report each check as `ok`, `suggest` (an `ifws:Informational` finding), `warn` (an `ifws:Warning`) or `error` (an `ifws:Error`), each with what to do.
- **FR-015**: `ifws verify` and `ifws render` MUST be as 0024-ifws-host FR-010 and FR-012 say, and `ifws tools` MUST list the catalog and probe the tools that are installed or on the `PATH` against it and MUST install nothing.
- **FR-016**: `ifws worktree` MUST have `create`, `list` and `prune`: `create` MUST make a worktree at the path of 0023-if-workspaces FR-007 on a branch named for its issue (`0020-ifccm`) only where another person or agent, or uncommitted work, is on the repository, and otherwise MUST say that the repository's own checkout is the place and make none unless `--always` is given; `prune` MUST remove only a worktree that has no uncommitted change and no unpushed commit, and only with `--allow-destructive`.

## Setup

- **FR-017**: `ifws setup` MUST be the only command that installs a tool or changes the host: it MUST show its plan first, MUST change nothing unless `--apply` is given (`--dry-run` is the default and is the same as saying nothing), MUST exit with `ifws:Usage` where both are given, and MUST record the run as an `ifws:Setup` whose plan was shown and whose `ifws:applied` says whether it was carried out; no other command MAY carry out an `ifws:InstallTool` or an `ifws:ConfigureHost` action.
- **FR-018**: `ifws setup --apply` MUST create the root and a starter manifest where there is none, install only the pinned artifacts of the catalog for this operating system and architecture (the version and the SHA-256 of each, 0023-if-workspaces FR-039) into `<home>/.if-workspaces/tools/`, and MUST NOT install `git`, `bun` or `node`, which it verifies by a probe of their versions and, where one is missing or too old, names with the way to install it.
- **FR-019**: On Windows, `ifws setup` MUST set `core.longpaths` in each managed repository's local configuration and, WHERE the process is elevated, MUST turn long paths on for the system, and WHERE it is not elevated MUST NOT try to elevate itself and MUST print the exact steps and exit with `ifws:Findings`; it MUST treat a path of more than 259 characters as an error while long paths are off (0023-if-workspaces FR-012).
- **FR-020**: `ifws setup --git-include` MUST carry out the global Git include of 0024-ifws-host FR-016, and `ifws shell --install` and `--uninstall` (0024-ifws-host FR-019) MUST be the setup restricted to the shell snippet, with the same plan, record and evidence.
- **FR-021**: `ifws shell <shell>` MUST be as 0024-ifws-host FR-017 says: the snippet on standard output, nothing written.

## Options, output and runtime

- **FR-022**: Options MUST be parsed once at the boundary into a typed value, and these MUST be accepted by every command: `--home <dir>`, `--json` (the report as JSON), `--sarif` (the findings as a SARIF 2.1.0 log, 0023-if-workspaces FR-035), `--no-color` and `--help`; an option a command does not know MUST end in `ifws:Usage`.
- **FR-023**: Every command MUST be idempotent: run again with nothing changed it MUST change nothing, and every run MUST write its evidence record (0023-if-workspaces FR-041), including a run that ends in `ifws:Usage`, which records `not_run` and the reason.
- **FR-024**: `ifws` MUST be TypeScript 7 and run on Bun by default and on Node 26 as the backup, through the same loader hook that `ifc` uses on Node; it MUST NOT run on, test on or document Deno; and it MUST have no `any`, no non-null `!`, errors as values (`Result`) and exhaustive switches.
- **FR-025**: `ifws init` MUST make the root and the workspace's own area and write the starter manifest (0024-ifws-host FR-002) where there is none, MUST install nothing and change nothing outside the root, and run again MUST change nothing; `ifws setup` MAY call it, and `init` and `setup` are the only commands that make the root.
- **FR-026**: Every run MUST write its evidence record (FR-023) but the printing form of `ifws shell <shell>` (it writes no file, 0024-ifws-host FR-017, and a start-up file may run it at every start), `ifws help` and the help of a command (they run nothing), a Git hook that `ifws hook` runs (a hook only reads, 0024-ifws-host FR-015), and a run for which `<home>/.if-workspaces/` does not exist, which has no place to keep it (`ifws init`, which makes the area, writes its record).
- **FR-027**: The controller MUST hold the module `ifws hook <pre-commit|commit-msg|pre-push>`, which the generated hooks run (0024-ifws-host FR-014, FR-025): it is internal, it only reads, and its status is 0 or 1 where it ran its checker and 2 or 3 where it could not.

## Out of scope

- The workspace's layout, portability, plan, policy, tools and evidence: `0023-if-workspaces`. The generated files, hooks, Git configuration and shell snippet: `0024-ifws-host`.
- `ifc` (`0008-test-evidence`) and any general Mizan command: `ifws` does not front them.
- The contents of a module's own commands beyond the contract: the module's.

## Edge cases

- `ifws wrkspace`: exit status 2, and `workspace` named if a module is so called, per FR-006.
- `ifws ../x` or a name with a space: refused as a usage error, not run, per FR-005.
- A module `ifws-doctor` on the `PATH`: the built-in `doctor` runs, and the hidden module is reported, per FR-004.
- An `ifws-foo` on the `PATH` that prints nothing for `--ifws-manifest`: listed and run as an opaque command, per FR-008.
- A registered module whose program changed since its hash was recorded: refused with exit status 3, per FR-011.
- `ifws setup --apply --dry-run`: usage error, nothing changed, per FR-017.
- `ifws setup --apply` on Windows without elevation: repositories get `core.longpaths`, the system setting is not touched and the steps are printed, per FR-019.
- `ifws apply` with a plan that holds an `ifws:InstallTool`: not possible, as `apply` never makes one, per FR-012 and FR-017.
- A warning and nothing else: exit status 1; an informational finding and nothing else: exit status 0, per FR-010.

## Scenarios

- **Given** an executable `ifws-hello` on the `PATH` and no module of that name built in or registered, **When** `ifws list` runs, **Then** `hello` is listed with the source `ifws:Path`, it was not run, and `ifws hello` runs it (FR-003, FR-004, FR-009).
- **Given** a module `ifws-hello` that answers `--ifws-manifest` with JSON of the contract, **When** `ifws list --probe` runs, **Then** its summary and commands are listed, and with an answer that does not decode it is listed as opaque (FR-008, FR-009).
- **Given** a typo of a module name, **When** it is run, **Then** the status is 2 and the nearest names are listed (FR-006, FR-010).
- **Given** a workspace with a warning, **When** `ifws doctor` runs, **Then** the status is 1, and with only informational findings it is 0 (FR-010, FR-014).
- **Given** any state, **When** `ifws setup` runs with no option, **Then** it shows its plan, installs nothing and changes nothing (FR-017).
- **Given** a catalog with a tool pinned for this system, **When** `ifws setup --apply` runs, **Then** the tool is in `.if-workspaces/tools/`, `git` was only probed, and an `ifws:Setup` with `ifws:applied` true was recorded (FR-017, FR-018).
- **Given** a repository that needs no worktree, **When** `ifws worktree create` runs, **Then** it says the repository's own checkout is the place and makes none (FR-016).
- **Given** a Bun and a Node 26 runtime, **When** `ifws status` runs on each, **Then** the report is the same (FR-024).

## Assumptions

- The model of the controller is Git's: `git foo` runs `git-foo`, found on the `PATH` (FR-004); IFWS credits it (0023-if-workspaces FR-046).
- The loader hook `ifc` uses on Node 26 is reusable by `ifws` without a change (FR-024).
- A person who wants a module on the `PATH` approves it by adding it to the catalog within 90 days, or by registering it with its hash (FR-011).

## Open questions

- **OQ-1**: Whether `ifws list --probe` may run a module found on the `PATH` in a sandbox, or only with the user's confirmation, since it runs a program.
- **OQ-2**: Whether the five seconds of FR-008 are enough for `--ifws-manifest` where the module is on a slow network file system.

## Key entities

- **Module** - a part of the command, `ifws-<name>`, with its source and summary (`ifws:Module`).
- **ModuleSource** - built-in, registered or on the path, in that order.
- **ExitStatus** - 0 ok, 1 findings, 2 usage, 3 environment.
- **Setup** - the one run that may install or change the host, dry by default.

## Success criteria

- **SC-001**: A module written in any language can join the command by being named `ifws-<name>` and answering `--ifws-manifest`, and `ifws` runs nothing it did not find in the order of FR-004.
- **SC-002**: Only `ifws setup` changes anything outside the workspace's own files, and it shows what it will do first.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
