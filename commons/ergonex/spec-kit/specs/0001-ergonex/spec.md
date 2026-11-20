# Feature Specification: The ergonex command

**Spec ID:** 0001-ergonex
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `ergonex`, the command of Intellectual Frontiers Workspaces (0002-workspace-model), the first real program built on Headless (`@intellectual-frontiers/headless`, commons headless 0001 to 0006): its commands are declared as Headless actions with their effect, idempotence, preview, check and reach policy, and Headless parses, decides, draws, logs, explains and ends them; the commands `init`, `repos`, `plan`, `apply`, `status`, `doctor`, `verify`, `render`, `worktree`, `shell`, `paths`, `setup`, `tools`, `modules` and `hook`, of which `setup` alone installs anything or changes the host; modules `ergonex-<name>` as `git foo` runs `git-foo`; on Bun by default and Node 26 as the backup.

## The command

- **FR-001**: The program MUST be `commons/ergonex/src/ergonex.ts` on `@intellectual-frontiers/headless`, the library MUST be in the same folder, `commons/ergonex/src/`, the commands in `commons/ergonex/src/commands/` (the tree is `commands/program.ts`) and the values the commands share in `commons/ergonex/src/modules/`, the package's `bin` MUST be `ergonex`, and the package MUST depend on Headless by its package name, through its exports only (`./governance`, `./logical`, `./cli`).
- **FR-002**: `ergonex` manages only Intellectual Frontiers Workspaces; it is not a general IFC or Mizan controller and does not front `ifc`, and `ergonex --help` MUST say so in these words: "It manages only Intellectual Frontiers Workspaces; it is not a general IFC or Mizan controller and does not front ifc."
- **FR-003**: `ergonex help [command]` MUST describe the program and each command from its declaration (Headless generates the help, the completions of `ergonex completions <shell>` and the man page of `ergonex man`), `ergonex` with no command MUST say in plain words what to do next (`ergonex start`, 0004-onboarding FR-003), and `ergonex modules` MUST list every module with its name, its source (`ergonex:BuiltIn`, `ergonex:Registered` or `ergonex:Path`) and its summary.

## Modules

- **FR-004**: A word that is not a command of the program MUST be looked for as a module in the order of `ergonex:precedence` of its source: first among the built-in modules (the words of the program's own tree), then among the modules the workspace registers in `<home>/.ergonex/modules.auto.json`, then among the executables named `ergonex-*` on the `PATH` (with the extensions of `PATHEXT` on Windows), as Git finds `git-foo` for `git foo`; the first found MUST run, and a module of a later source that it hides MUST be an `ergonex:Informational` finding.
- **FR-005**: A module name MUST be lower-case letters, digits and hyphens, beginning with a letter, and a word with any other character, with a path separator or longer than 32 characters MUST be refused with exit status `ergonex:Usage` (it is not a command of the program) and never passed to a shell.
- **FR-006**: IF no command or module is named as given, THEN `ergonex` MUST exit with `ergonex:Usage` and name the nearest command where one is within an edit distance of two of it.
- **FR-007**: A command MUST be declared once with Headless: its name and summary, its options and operands (`--home` and its own; the options every command takes by its effect are Headless'), its examples and its action (`kind`, `effect`, `idempotent`, `dryRun`, `check`, and a reach policy: its channels, whether it is read-only, idempotent, needs a terminal, whom it runs as, how it is confirmed), and a body that returns a `Result` of a `Report` or a `Failure`; the model MUST have no problem (`modelProblems`, with a reach policy required of every action), with no `any`, and a `switch` over a union MUST be exhaustive.
- **FR-008**: An external module MUST answer `--ergonex-manifest` on standard output with JSON (its name, its summary, its commands and the version of this contract) that a typed decoder checks and whose JSON Schema is generated from the type, and an external module that does not answer within five seconds, or whose answer does not decode, MUST run as an opaque command whose exit status is recorded in the evidence.
- **FR-009**: `ergonex modules` and `ergonex help` MUST NOT run a module found on the `PATH` unless `--probe` is given, so that listing never runs a program the workspace has not approved.
- **FR-010**: A run MUST end with a status of Headless' table: `ergonex:Ok` (0), `ergonex:Findings` (1), `ergonex:Usage` (2), `ergonex:Environment` (3) and, for a check that finds something pending, 4: 1 where there is at least one finding of severity `ergonex:Error` or `ergonex:Warning` (each is a failed problem of the run, with the stable code of its rule, `E-` and the rule's words: `ergonex/repository-diverged` is `E-REPOSITORY-DIVERGED`) and no `ergonex:Informational` finding alone makes it 1 (it is a warning, which Headless never makes a failure); 2 for an unknown command, option or argument, a refused action, or a body that says its words do not fit; 3 where the host cannot do it (no `git`, an unsupported runtime, a root that does not exist or cannot be written, an evidence record that cannot be written); an opaque external module's own status MUST be passed on and recorded. Every code MUST be explained: `ergonex explain <code>` says what happened, the likely cause and the fix, and a test proves that every rule the sources write has an entry.
- **FR-011**: A registered module MUST be named in `modules.auto.json` with the path of its program and MAY carry the SHA-256 of that program, which `ergonex` MUST check before running it and MUST refuse the module, with exit status `ergonex:Environment`, where it differs; a registered module or one on the `PATH` that the catalog does not list MUST be a finding as in 0002-workspace-model FR-033.

## The commands

- **FR-012**: `ergonex plan` MUST be a report that shows the typed plan and changes nothing, and `ergonex apply` MUST be an action, safe to repeat, that carries it out as 0002-workspace-model FR-022 to FR-030 say, with no action of a kind that is `ergonex:hostChange` and no destructive action without `--allow-destructive`.
- **FR-013**: `ergonex status` MUST list every repository of the manifest, one line each in the order of its path, with its `ergonex:RepoState`, how many commits it is ahead and behind, its stashes, its untracked files and whether it is locked; it MUST NOT use the network unless `--fetch` is given, and it MUST exit with `ergonex:Findings` where a repository is `ergonex:Diverged`, `ergonex:Locked`, `ergonex:WrongRemote` or `ergonex:NotARepo`.
- **FR-014**: `ergonex doctor` MUST check the runtime and the tools, the layout and the portability of every path, the file system, the policy (the plaintext-token scan, signed commits, tools and modules outside the catalog) and the generated files, and MUST report each check as `ok`, `suggest` (an `ergonex:Informational` finding), `warn` (an `ergonex:Warning`) or `error` (an `ergonex:Error`), each with what to do.
- **FR-015**: `ergonex verify` (a report) and `ergonex render` (an action that previews with `--dry-run` and checks with `--check`) MUST be as 0003-host FR-010 and FR-012 say, and `ergonex tools` MUST list the catalog and probe the tools that are installed or on the `PATH` against it and MUST install nothing.
- **FR-016**: `ergonex worktree` MUST have `create`, `list` and `prune`: `create` MUST make a worktree at the path of 0002-workspace-model FR-007 on a branch named for its issue (`commons 0020-ifccm`) only where another person or agent, or uncommitted work, is on the repository, and otherwise MUST say that the repository's own checkout is the place and make none unless `--always` is given; `prune` is destructive: it MUST remove only a worktree that has no uncommitted change and no unpushed commit, MUST preview with `--dry-run`, and MUST ask the person or be given `--yes`.

## Setup

- **FR-017**: `ergonex setup` MUST be the only command that installs a tool or changes the host: it MUST carry its plan out unless `--dry-run` is given, which shows the plan and changes nothing, and MUST record the run as an `ergonex:Setup` whose plan was shown and whose `ergonex:applied` says whether it was carried out; no other command MAY carry out an `ergonex:InstallTool` or an `ergonex:ConfigureHost` action.
- **FR-018**: `ergonex setup` MUST create the root and a starter manifest where there is none, install only the pinned artifacts of the catalog for this operating system and architecture (the version and the SHA-256 of each, 0002-workspace-model FR-039) into `<home>/.ergonex/tools/`, and MUST NOT install `git`, `bun` or `node`, which it verifies by a probe of their versions and, where one is missing or too old, names with the way to install it.
- **FR-019**: On Windows, `ergonex setup` MUST set `core.longpaths` in each managed repository's local configuration and, WHERE the process is elevated, MUST turn long paths on for the system, and WHERE it is not elevated MUST NOT try to elevate itself and MUST print the exact steps and exit with `ergonex:Findings`; it MUST treat a path of more than 259 characters as an error while long paths are off (0002-workspace-model FR-012).
- **FR-020**: `ergonex setup --git-include` MUST carry out the global Git include of 0003-host FR-016 (after showing the exact change and, where a person can be asked, asking; where no one can be asked the flag is the consent), and `ergonex shell install` and `ergonex shell uninstall` (0003-host FR-019) MUST be the setup restricted to the shell snippet, with `--dry-run` showing the diff.
- **FR-021**: `ergonex shell print <shell>` MUST be as 0003-host FR-017 says: the snippet on standard output, nothing written.

## Options, output and runtime

- **FR-022**: Options MUST be parsed once at the boundary into a typed value, and every command MUST accept `--home <dir>` and Headless' options by its effect: `--json` (the one JSON document, `headless.envelope/1`), `--quiet`, `--verbose`, `--no-color`, `--non-interactive` and `--help`, `--sarif` (the findings as a SARIF 2.1.0 log, 0002-workspace-model FR-035) on a report, `--dry-run` on an action that previews, `--check` on one that checks, `--yes` on one that destroys; an option a command does not know MUST end in `ergonex:Usage`. The report MUST be on standard output and the problems, the verdict and the one `next:` command on standard error, and the run log and the hints MUST be under `<XDG_STATE_HOME>/ergonex` (`log/`, `hints.json`).
- **FR-023**: Every action that says it is idempotent MUST be: run again with nothing changed it MUST change nothing, and every run of a command MUST write its evidence record (0002-workspace-model FR-041); a command line that Headless refuses before it runs (`ergonex:Usage`) runs nothing and records nothing.
- **FR-024**: `ergonex` MUST be TypeScript 7 and run on Bun by default and on Node 26 as the backup, from its `.ts` sources as they are; it MUST NOT run on, test on or document Deno; and it MUST have no `any`, no non-null `!`, errors as values (`Result`) and exhaustive switches.
- **FR-025**: `ergonex init` MUST make the root and the workspace's own area and write the starter manifest (0003-host FR-002) where there is none, MUST install no tool and change nothing outside the root but what 0004-onboarding FR-002 says (ergonex itself put on the path, which `--no-install` leaves out), and run again MUST change nothing; `ergonex setup` MAY call it, and `init` and `setup` are the only commands that make the root.
- **FR-026**: Every run MUST write its evidence record (FR-023) but the printing form of `ergonex shell print <shell>` (it writes no file, 0003-host FR-017, and a start-up file may run it at every start), a preview (`--dry-run`), `ergonex help` and the help of a command (they run nothing), a Git hook that `ergonex hook` runs (a hook only reads, 0003-host FR-015), and a run for which `<home>/.ergonex/` does not exist, which has no place to keep it (`ergonex init`, which makes the area, writes its record).
- **FR-027**: The controller MUST hold the module `ergonex hook <pre-commit|commit-msg|pre-push>`, which the generated hooks run (0003-host FR-014, FR-025): it is internal, it only reads, and its status is 0 or 1 where it ran its checker and 2 or 3 where it could not.
- **FR-028**: `ergonex modules --probe` MUST run a module found on the `PATH` only with the user's confirmation for it, or with `--trust`, and it MUST NOT sandbox the module: a probe is the run of a program the user approved.
- **FR-029**: The five seconds of FR-008 MUST stay the default wait for `--ergonex-manifest`; `--probe-timeout` MAY raise them, and a module that does not answer in time MUST be an informational finding of the run (the module named, the wait given) and MUST NOT make the run fail or change its exit status.
- **FR-030**: The tree of the program (`ergonexProgram`) MUST be a Headless model with no problem, and each command's action MUST say what it is: the reports (`plan`, `status`, `doctor`, `verify`, `paths`, `tools`, `shell print`, `worktree list`, `modules`, `hook`, `start`) only read and are safe to repeat; `render`, `repos add`, `repos adopt`, `setup` and `shell install` preview with `--dry-run`; `repos delete` and `worktree prune` are destructive, preview and are confirmed; and the program MUST ask no one a question a flag or the action's own facts can answer.
- **FR-031**: Ergonex MUST keep its own domain logic (the manifest, the repositories, the plan, the onboarding, the tool catalog and the evidence) separate from the surface: nothing in `src/` outside `commands/` and `ergonex.ts` imports Headless, and no command keeps a second path (an alias, a deprecated option or a shim) for a surface that was replaced.

## Out of scope

- The workspace's layout, portability, plan, policy, tools and evidence: `0002-workspace-model`. The generated files, hooks, Git configuration and shell snippet: `0003-host`.
- A `consent` class of reach for `--git-include` (commons headless 0008-exit-style-consent FR-004): a non-goal by decision. The class belongs to a whole action and would demand `--consent <id>` of every run of `setup` that has no terminal, and `--git-include` is itself a flag a person typed after the exact change is shown, so the flag is the consent (FR-020); splitting it into a command of its own is not worth a second path.
- `ifc` (`commons 0008-test-evidence`) and any general Mizan command: `ergonex` does not front them.
- The contents of a module's own commands beyond the contract: the module's.

## Edge cases

- `ergonex plna`: exit status 2, and `plan` named, per FR-006.
- `ergonex ../x` or a name with a space: refused as a usage error, not run, per FR-005.
- A module `ergonex-doctor` on the `PATH`: the built-in `doctor` runs, and the hidden module is reported, per FR-004.
- An `ergonex-foo` on the `PATH` that prints nothing for `--ergonex-manifest`: listed and run as an opaque command, per FR-008.
- A registered module whose program changed since its hash was recorded: refused with exit status 3, per FR-011.
- `ergonex setup --dry-run`: the plan is shown and nothing is changed, per FR-017.
- `ergonex setup` on Windows without elevation: repositories get `core.longpaths`, the system setting is not touched and the steps are printed, per FR-019.
- `ergonex apply` with a plan that holds an `ergonex:InstallTool`: not possible, as `apply` never makes one, per FR-012 and FR-017.
- A warning and nothing else: exit status 1; an informational finding and nothing else: exit status 0, per FR-010.

## Scenarios

- **Given** an executable `ergonex-hello` on the `PATH` and no module of that name built in or registered, **When** `ergonex modules` runs, **Then** `hello` is listed with the source `ergonex:Path`, it was not run, and `ergonex hello` runs it (FR-003, FR-004, FR-009).
- **Given** a module `ergonex-hello` that answers `--ergonex-manifest` with JSON of the contract, **When** `ergonex modules --probe` runs, **Then** its summary and commands are listed, and with an answer that does not decode it is listed as opaque (FR-008, FR-009).
- **Given** a typo of a module name, **When** it is run, **Then** the status is 2 and the nearest names are listed (FR-006, FR-010).
- **Given** a workspace with a warning, **When** `ergonex doctor` runs, **Then** the status is 1, and with only informational findings it is 0 (FR-010, FR-014).
- **Given** any state, **When** `ergonex setup --dry-run` runs, **Then** it shows its plan, installs nothing and changes nothing (FR-017).
- **Given** a catalog with a tool pinned for this system, **When** `ergonex setup` runs, **Then** the tool is in the tools folder of ergonex's data (`<data>/tools/`, commons 0031-install-locations), `git` was only probed, and an `ergonex:Setup` with `ergonex:applied` true was recorded (FR-017, FR-018).
- **Given** a repository that needs no worktree, **When** `ergonex worktree create` runs, **Then** it says the repository's own checkout is the place and makes none (FR-016).
- **Given** a Bun and a Node 26 runtime, **When** `ergonex status` runs on each, **Then** the report is the same (FR-024).

## Assumptions

- The model of the controller is Git's: `git foo` runs `git-foo`, found on the `PATH` (FR-004); Ergonex credits it (0002-workspace-model FR-046).
- Node 26 runs the `.ts` sources of `ergonex` as they are, which strips their types (FR-024).
- A person who wants a module on the `PATH` approves it by adding it to the catalog within 90 days, or by registering it with its hash (FR-011).
- This specification is Active from 2026-11-17: the requirements it does not yet prove say so in the enforcement register.

## Open questions

None.

## Key entities

- **Module** - a part of the command, `ergonex-<name>`, with its source and summary (`ergonex:Module`).
- **ModuleSource** - built-in, registered or on the path, in that order.
- **ExitStatus** - 0 ok, 1 findings, 2 usage, 3 environment (and 4 pending, Headless').
- **Setup** - the one run that may install or change the host; `--dry-run` shows its plan.

## Success criteria

- **SC-001**: A module written in any language can join the command by being named `ergonex-<name>` and answering `--ergonex-manifest`, and `ergonex` runs nothing it did not find in the order of FR-004.
- **SC-002**: Only `ergonex setup` changes anything outside the workspace's own files, and it shows what it will do first.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
