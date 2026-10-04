# Feature Specification: Intellectual Frontiers Console

**Spec ID:** 0043-if-console
**Status:** Draft

**Input:** The Intellectual Frontiers Console (IF Console), the one VS Code
extension that is the secondary interface for every repository's
orchestrator. The command line is the core interface: every command exists
there first and the extension adds nothing a command does not do. The
extension finds each repository's launcher by that repository's own
declaration, asks it for its command list as JSON, and then offers the
commands the way VS Code offers anything: a tree of nouns, commands and
resources, findings in the Problems panel, checks as tasks and tests, the
command palette, quick picks and forms built from each command's typed
arguments, a diff of what a write would change before it is made, a modal
confirmation for anything only a person decides, a status bar item, an output
channel, and the context an AI agent needs. It also registers each
repository's MCP server with VS Code. It re-implements nothing, writes
nothing itself, collects no telemetry and opens no network connection. It
covers the common chores a web console would have covered, without a server.
This spec states what it is, where it lives, how it discovers launchers, what
it does, what it never does, and how it is built.

## Identity

- **FR-001**: The extension MUST be one extension named "Intellectual
  Frontiers Console", shown as "IF Console", with the extension id
  `if-console` and the prefix `if-console.` on every command, view,
  setting and task type it contributes. It MUST serve every repository's
  orchestrator through the same code, so that a person has one extension, not
  one per repository. It is a secondary interface: the command line is the
  core (0041-command-line FR-050), and there is no web interface.
- **FR-002**: The extension's source MUST live in the public root, in
  `tools/if-console/`, and MUST be public: its code, its documentation and its
  tests MUST hold nothing that is not public, and MUST NOT name another
  repository or that repository's orchestrator. That directory, with
  `tools/agora/` and each design system's own directory, is where this
  repository keeps code (0042-agora FR-016).
- **FR-003**: The extension MUST run a repository's commands only by invoking
  that repository's launcher with `--json` (or `--html` for a rendering,
  FR-011) and MUST NOT re-implement a command, a check, a type's validation or
  a rule: what a resource says, a type accepts and an action does is whatever
  the launcher returns (0041-command-line FR-013, FR-024). A chore that a
  command does not yet do MUST be added to the orchestrator first, by its own
  spec, and only then offered here (0001-eidolon-architecture FR-037).

## Discovery

- **FR-004**: A repository MUST be found by its own declaration. A workspace
  folder is a repository with an orchestrator when its root holds
  `.if-console.env`, an environment file (0041-command-line FR-047) whose
  `IF_CONSOLE_LAUNCHER` line names an executable file at the root. The
  extension MUST carry no list of launcher names and MUST name no repository's
  orchestrator, because it is not any one orchestrator and the one place that
  knows a repository's launcher is the repository. A person MAY add launcher
  names for a folder that declares none through the setting
  `if-console.launchers`, which MUST be settable only in the person's own
  settings and never in a workspace's, so that no repository can name what the
  extension runs.
- **FR-005**: The extension MUST accept a launcher only when running
  `<launcher> command list --json` returns a document whose schema is a
  `command/list` version it understands (FR-021), and MUST take the
  orchestrator's name, its audience and its commands, nouns, verbs,
  categories, arguments and surfaces from that document. It MUST run no other
  program than a trusted repository's launcher (FR-006).
- **FR-006**: The extension MUST run a repository's launcher only when VS
  Code trusts the workspace and the person has trusted the repository
  (0041-command-line FR-052, FR-061), MUST declare that it does not support
  untrusted workspaces, and MUST say in plain words why nothing appears for a
  repository that is not trusted, with the one action that trusts it, which
  is a decision of the person (FR-015). Reading `.if-console.env` needs no
  trust (0041-command-line FR-062).
- **FR-007**: The extension MUST treat each workspace folder as its own
  repository, with its own launcher, commands, status and findings, so that a
  window holding several repositories shows each one apart, and two
  repositories whose launchers share a name are told apart by their folders.

## What it offers

- **FR-008**: The extension MUST provide a tree view of nouns, then commands,
  then resources: under each repository, the nouns its `command list`
  declares; under a noun, its commands that the editor surface exposes
  (0041-command-line FR-022) and, where the noun has a `list` command, the
  resources that command returns; under a resource, its links (each named by
  its relation) and its actions (each with its category). Every entry MUST be
  built from a resource the launcher returned, and a resource's action that
  cannot run now MUST be absent or shown disabled with its reason
  (0041-command-line FR-017).
- **FR-009**: The extension MUST show the findings of a `check` in VS Code's
  Problems panel, one diagnostic for each finding that has a location, at its
  file and line (a finding's `file:line`), with its severity, its message and
  the section that reported it as the source, and MUST clear a section's
  diagnostics when that section runs again. A finding with no location MUST be
  shown in the check's result and the output channel and MUST NOT be placed at
  a file it does not name.
- **FR-010**: The extension MUST contribute a task type `if-console` whose
  tasks run a repository's repository-wide commands (`check`, `test`, `fresh`,
  `doctor`) and, for `check`, a section or a suite, so that they appear under
  Run Task and can be bound to a keybinding; and MUST show each `check`
  section in VS Code's Test Explorer as a test, run by `check SECTION --json`,
  with a section that the launcher reports as skipped shown as skipped and
  never as passed (0041-command-line FR-033).
- **FR-011**: The extension MUST show a `read` command's HTML rendering
  (`--html`) in a webview that loads local resources only, runs no script from
  outside it, and follows only links that name a command or a file in the
  clone, so that a view an orchestrator declares (0042-agora FR-019) opens in
  the editor. The extension MUST add no style to a rendering beyond VS Code's
  theme variables around it.
- **FR-012**: The extension MUST offer, in the command palette, `IF Console:
  Run Command`, which lists every command that declares the editor surface,
  grouped by repository and noun, with its category, and the repository-wide
  commands as their own entries (`IF Console: Check`, `Fresh`, `Test`,
  `Doctor`, `Show Command Line`, `Get Help`, `Learn`, `Copy Context`, `Open View`). It
  MUST list no command that the editor surface does not expose
  (0041-command-line FR-022).
- **FR-013**: The extension MUST build the input for a command from the
  command's typed arguments: one step for each argument, a quick pick where
  the type enumerates its values or the noun has a `list` command that returns
  them, a text input where it does not, with the type's validation message
  shown on a value the launcher refuses, and a last step that shows the whole
  command line (FR-017) before anything runs. It MUST NOT offer a printed
  command with a placeholder (0041-command-line FR-013, FR-055).
- **FR-014**: Before any command that writes (every category but `read` and
  `check`) runs, the extension MUST run it with `--dry-run --json` and show
  each file the change would touch as a diff in VS Code's diff editor, taken
  from the dry run's resource (0041-command-line FR-015), and MUST run the
  command for real only after the person accepts that diff. A command whose
  dry run fails MUST NOT be run for real, and the dry run's error MUST be
  shown.
- **FR-015**: A `decision` command MUST run only after a modal confirmation
  that names the command, the resource and what it changes, shown after its
  dry run (FR-014), and that only a person can give. The extension MUST expose
  no setting, command, keybinding, task or API that runs a `decision` command
  without that confirmation (the one answer a test gives in place of a person is
  FR-033's, which exists only in VS Code's test mode), MUST NOT export an API to other extensions, and
  MUST NOT list a `decision` command in its MCP registration (FR-022;
  0041-command-line FR-023, FR-051).
- **FR-016**: The extension MUST show a status bar item for the active
  workspace folder's repository, giving its orchestrator, its audience and a
  plain-words state taken from `doctor` (well, needs attention, or something
  missing), that opens the `doctor` resource when chosen, and MUST show an
  audience other than the one the person expects as the launcher states it,
  never as the extension decides (0041-command-line FR-040, FR-054).
- **FR-017**: The extension MUST write to an output channel "IF Console", for
  each launcher invocation, the one-line command it ran (as
  0041-command-line FR-055 states it), its exit status and its standard error,
  and each line of a stream as it arrives, so that a person can paste what the
  extension did into a terminal. It MUST write no secret and no file contents,
  and MUST set the environment variable `IF_CONSOLE` to `1` for every
  invocation so that the launcher logs the surface `editor`
  (0041-command-line FR-042).
- **FR-018**: The extension MUST offer `context` for an agent: `IF Console:
  Copy Context` runs `<launcher> context RESOURCE --json` for the resource
  selected in the tree or chosen in a quick pick, and puts the result on the
  clipboard or in an untitled editor, as the person chooses; and `IF Console:
  Get Help` assembles `context` and `doctor`, with secrets removed, into the
  report 0041-command-line FR-057 describes. Neither MUST send anything
  anywhere.
- **FR-019**: The extension MUST offer a Chores view, one place for what a
  person routinely does in a repository: the repository-wide commands, the open
  proposals (`proposal list --status open`, each to be read and then decided
  or left, FR-015), the sections whose last check found something, the
  generators `fresh` reports stale (each with its rewriting command and its
  dry-run diff, FR-014), the toolchain entries `doctor` reports absent (each
  with `toolchain add`), and a "Get Help" entry. The Chores view MUST be built
  from the launcher's own resources and MUST add no chore the launcher does
  not have a command for (FR-003).
- **FR-020**: The extension MUST show a stream (NDJSON,
  0041-command-line FR-019) as VS Code progress with the stream's own words,
  MUST let a person cancel it, ending the launcher's process, and MUST show
  the final resource as the result.
- **FR-021**: The extension MUST check each document's `schema` against the
  versions it understands (0041-command-line FR-053) and, for one it does not,
  MUST say in plain words that an update is needed and show the action that
  updates the extension, and MUST NOT show a document it cannot read.
- **FR-022**: Where VS Code supports registering an MCP server from an
  extension, the extension MUST register, for each trusted repository whose
  command list includes `mcp serve`, one standard-input-and-output server
  whose command is that repository's launcher with the arguments `mcp serve`
  and whose working directory is the repository's root, labelled with the
  orchestrator's name, and MUST change nothing else about the server: its
  tools, resources and refusals are the launcher's (0041-command-line FR-023,
  FR-027). Where VS Code does not support it, the extension MUST say so in the
  output channel and do nothing else.

## What it never does

- **FR-023**: The extension MUST collect no telemetry and MUST open no network
  connection of its own: it MUST NOT use VS Code's telemetry API, make an HTTP
  or socket request, load a remote resource into a webview, call an AI model,
  or send a resource, a log line or a finding to any service. The only network
  traffic in a session is what a launcher itself makes when a command needs it.
- **FR-024**: The extension's settings MUST be only: `if-console.launchers`
  (FR-004), and, as an option a person turns on, `if-console.checkOnSave`,
  which runs `check --changed --json` for the saved file's repository and
  shows the findings as FR-009 states. Neither MAY change what a command does.
- **FR-025**: The extension MUST say everything it says to a person in plain
  language, the first line of a resource's text rendering being the label
  where one is needed (0041-command-line FR-054); MUST use VS Code's theme
  colors and icons and no colors of its own; and MUST make each view, action
  and form reachable by keyboard and labelled for a screen reader.
- **FR-026**: The extension MUST write nothing itself: no file in a clone, no
  ignore rule, nothing in `.vscode/`, and no record of its own beyond VS Code's
  own state for the last selection in its views (0041-command-line FR-063).
  Every change to a repository is a launcher command's, made through FR-014 or
  FR-015.

## How it is built

- **FR-027**: The extension MUST be built by `agora extension build`
  (0042-agora FR-032) from `tools/if-console/`, with a Node runtime that a
  Python package supplies and no program from the host, and with its own
  `package.json` and `package-lock.json`, every package pinned to one exact
  version with its integrity hash, installed only from the lock
  (0025-tooling-environment FR-015). It MUST have no runtime npm dependency:
  what ships is its own code, and the packages in the lock are build and test
  tools only. The build MUST produce one `.vsix` under `build/`.
- **FR-028**: The extension MUST carry tests that run under Node's built-in
  test runner with a stand-in for the VS Code API and a fake launcher that
  replays recorded resources, covering discovery (FR-004 through FR-007),
  every feature of FR-008 through FR-022 and FR-031, the refusals of FR-015,
  and the absence of network and telemetry calls (FR-023), and `agora check
  extension` MUST run them (the `node` runner) and a lint of the code
  (0042-agora FR-013). The stand-in shows that the code does what the tests
  expect of VS Code; FR-032's tests show that VS Code does what the code expects.
- **FR-029**: A person installs the extension from the `.vsix` that FR-027
  builds, with VS Code's own `--install-extension` or its Install from VSIX
  command, and updates it by building and installing again. Publishing the
  package to a marketplace is a `publish` outside the clone and a decision for
  a person; no command of this repository does it.
- **FR-030**: The extension MUST state the VS Code version it needs in its
  manifest, and MUST keep working, with the features that need a newer VS Code
  absent and said to be, on the oldest version it states (FR-022).

## Learning

- **FR-031**: The extension MUST offer `IF Console: Learn`, a quick pick of the
  topics that the repository's `help` command lists (0041-command-line FR-065),
  from each repository whose command list has `help`, grouped by repository
  when a window holds several; and MUST show the topic chosen as any other
  resource (FR-008): its plain words, its sections, and its steps as buttons
  that run each step through the one path every command takes (FR-013 to
  FR-015). A topic is a resource of kind `help` whose data has `topic`,
  `summary`, `plain`, `sections` (a heading and its words each) and `steps`, and
  whose actions are the steps in order. A step whose command the launcher does
  not offer to the editor, or which it says cannot run now, MUST be a disabled
  button that says why, with its command line shown to paste in a terminal. The
  extension MUST carry no topic and no step of its own (FR-003).

## Tested in a real VS Code

- **FR-032**: The extension MUST also be tested inside a real VS Code, started
  under a display server, with `@vscode/test-electron` from the extension's own
  hashed lock (FR-027), the VS Code build a pinned toolchain entry (0042-agora
  FR-030), and the tests in `tools/if-console/test/vscode/`, run by `agora check
  extension --runner vscode`. They MUST cover: activation in a trusted
  workspace holding this repository and a fixture second command line; the
  three views populated; every command of the manifest registered, with the
  palette entries the manifest lists; a check that produces diagnostics in the
  Problems panel at the finding's file and line; a dry-run write that opens a
  diff and then applies; a decision that shows a modal, answered through FR-033;
  an untrusted workspace in which the extension does not activate and no launcher
  runs; Learn listing the repository's help topics; and the MCP server
  registered where VS Code supports it. A run that cannot start (no VS Code in
  the cache, no display server, a library missing) MUST be reported as
  skipped, naming the cause and the command that fixes it.
- **FR-033**: A test in a real VS Code cannot press the button of a modal
  dialog or read a quick pick, so the extension MUST have one test hook and no
  other: when VS Code runs the extension in its test mode
  (`ExtensionMode.Test`, which VS Code sets only for a host started with an
  extension test path, never for an installed extension), the extension MUST
  publish an object under `Symbol.for('if-console.test')` on `globalThis`
  through which a test (a) queues the answer to the next decision modal, where
  `true` gives the modal's one button, anything else refuses it, an answer is
  used once and with none queued the modal is refused; (b) reads what the
  extension showed, in order: each modal's message, detail, whether it was
  modal and its buttons, each quick pick's title and items, and each webview's
  page; and (c) reads a snapshot, taken on demand and changing nothing, of the
  repositories found, the entries of the three views and the MCP servers it
  registers. Outside test mode the object MUST NOT exist and the modal MUST be
  VS Code's own. The hook MUST affect no other prompt: quick picks and input
  boxes are driven by VS Code's own commands in the tests, and no source other
  than the hook's own file MAY read the extension mode.

## Out of scope

- The commands a repository's orchestrator has: each orchestrator's spec states
  them (0042-agora is the public root's).
- The orchestrators' own rules (0041-command-line) and their MCP servers'
  protocol handling (0041-command-line FR-027).
- Editors other than VS Code, and a web interface.
- Publishing the extension to a marketplace (FR-029).

## Edge cases

- A repository that holds a launcher but no `.if-console.env`: it is not
  found, and a person who wants it adds its name in their own settings, per
  FR-004.
- A repository whose `.if-console.env` names a launcher that does not answer
  `command list` with a document the extension understands: it is not shown as
  an orchestrator and the output channel says why, per FR-005 and FR-021.
- A repository's file that tries to name what the extension runs, other than
  its own launcher: ignored, because only the person's own settings add names,
  per FR-004.
- VS Code in Restricted Mode, or a repository the person has not trusted:
  nothing is run and the reason is shown in plain words with the action that
  trusts it, per FR-006.
- A window with two repositories whose launchers have the same name: each
  appears under its own folder, per FR-007.
- A `check` finding with no file: it is shown in the result and the output
  channel and not as a diagnostic, per FR-009.
- A check section that was skipped: it is shown as skipped, not passed, per
  FR-010.
- A command with a typed argument whose value the launcher refuses: the step
  shows the type's message and examples, and nothing runs, per FR-013.
- A write whose dry run fails: nothing is written and the error is shown, per
  FR-014.
- An AI agent working inside the editor asks the extension to accept a spec's
  status change: no command, setting or API of the extension does it, and the
  confirmation is modal, per FR-015.
- A person copies the command line shown in the last step of a form: it is one
  line with no placeholder and runs the same in a terminal, per FR-013 and
  FR-017.
- A stream the person cancels: the launcher's process ends and the output
  channel says so, per FR-020.
- A document with a schema newer than the extension knows: an update is
  offered and nothing unreadable is shown, per FR-021.
- A VS Code without MCP registration support: the output channel says so and
  nothing else changes, per FR-022.
- A launcher that needs the network for a command: that traffic is the
  launcher's; the extension itself opens none, per FR-023.
- A host with no Node installed: the extension is still built, with Node from
  the locked wheel, per FR-027.
- Another extension asks this one for its API: it exports none, per FR-015.
- A decision modal in a test: answered through the test hook, which exists only
  in test mode; an installed extension has none, per FR-033.
- A real VS Code run on a host with no display server: skipped with the cause
  and `agora system add`, per FR-032.

## Assumptions

- A person who uses the extension works in VS Code and has the repository's
  launcher's own host prerequisites, `python3` and `uv`
  (0025-tooling-environment FR-014).
- Each orchestrator answers `command list --json` and returns the dry-run
  change of a write as a diff per file (0041-command-line FR-015), and sets its
  log surface from `IF_CONSOLE` (0041-command-line FR-042).
- A person trusts a repository deliberately, and trust in VS Code and in the
  repository are two separate acts (FR-006).

## Open questions

- **OQ-1**: How the extension gets the choices for an argument type with many
  values (a requirement among several thousand): by the noun's `list` command
  and a filter, or by a completion resource that 0041-command-line states.
  Until then the extension uses the noun's `list` command (FR-013).
- **OQ-2**: Answered by FR-032. VS Code is a toolchain entry with the vendor's
  checksum; the display server is `Xvfb`, which has no download and is
  installed with VS Code's libraries by `system add` (0042-agora FR-030), so the
  host still needs only `python3` and `uv` and one documented `sudo` setup.
- **OQ-3**: Whether a file open in the editor maps to a resource for `Copy
  Context` through a `file` resource kind each orchestrator declares, or the
  person always chooses the resource (FR-018).

## Key entities

- **IF Console** — the one VS Code extension, id `if-console`, that is the
  secondary interface for every orchestrator.
- **A launcher declaration** — `.if-console.env` at a repository's root,
  naming its launcher (FR-004).
- **A repository's view** — one workspace folder's launcher, commands, status
  and findings (FR-007).
- **A dry-run preview** — the diff of what a write would change, shown before
  it is made (FR-014).
- **A modal confirmation** — what a `decision` command needs and only a person
  can give (FR-015).
- **Learn** — the quick pick of a repository's help topics, each shown as a
  resource with its steps as buttons (FR-031).
- **The test hook** — the one object, present only in VS Code's test mode,
  through which a test answers a decision's modal (FR-033).
- **The Chores view** — the repository-wide commands and what needs a person,
  from the launcher's own resources (FR-019).

## Success criteria

- **SC-001**: A person opens a trusted repository in VS Code and sees its
  orchestrator, its audience and its health in the status bar, and its nouns
  and commands in the tree, without configuring anything but the repository's
  own declaration.
- **SC-002**: Every command the editor surface exposes can be run from the
  command palette with its arguments chosen from the types' own choices, and
  none that only a person decides runs without a modal confirmation.
- **SC-003**: Every write is shown as a diff before it is made.
- **SC-004**: The extension makes no network connection and sends no
  telemetry.
- **SC-005**: The extension is built with no program from the host and ships
  no runtime npm dependency.
- **SC-006**: A person learns the daily work from Learn without reading the
  guide, and the extension's behavior is shown in a real VS Code, not only in
  a stand-in for its API.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
