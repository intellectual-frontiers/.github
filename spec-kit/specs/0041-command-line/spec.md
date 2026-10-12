# Feature Specification: A repository's orchestrator

**Spec ID:** 0041-command-line
**Status:** Draft

**Input:** The rules any Eidolon repository's orchestrator follows. An
orchestrator is the one command that runs a repository's behavior: the only
way a person, a CI job or an AI agent runs what that repository does, in
place of scattered scripts. It is one launcher and one body of Python code
that declares its commands in a registry found by presence, takes typed
arguments, returns every result as a resource rendered as text, JSON or HTML,
reports errors as resources, and never decides for a person what only a
person decides. Its behavior is code and its information is a small
environment-style file. It needs only `ws-host` on the host (0025-tooling-environment):
`ws-host` runs it in its own environment with Python and `uv`, the orchestrator
obtains its Python packages from hashed uv locks, and `ws-host` installs every
other program from the orchestrator's toolchain, into one store, verified, and
runs offline on request. It records nothing outside Git. Its surfaces are the command line,
which is the core; the Workspaces Console, one VS Code extension that is
the secondary interface for every orchestrator (0043-console-protocol, and
workspaces-host's Console specification); and an MCP server for agents.
`ws-host` is the environment orchestrator every other orchestrator assumes: it
prepares a person's machine, clones their repositories, installs toolchains and
runs the Workspaces Console (0026-workspaces). This spec states those rules for
any repository. Names such as `agora` and `ws-host` are examples of
orchestrator names, not part of any rule; the public root's command set is
0042-agora.

## The launcher and its dependency plan

- **FR-001**: A repository's orchestrator MUST be one executable launcher at
  the repository root, named for the orchestrator, written in POSIX `sh`,
  that needs only `ws-host` from the host (0025-tooling-environment FR-014),
  and hands over to `ws-host provider run`, which runs the command in the
  repository's own environment with Python and `uv`. It MUST run from a fresh
  clone that a person has enabled as a provider (0025-tooling-environment
  FR-006), from any working directory inside the clone, MUST find the
  repository from its own location, and MUST exit 3 naming the one command
  that fixes it where `ws-host` is missing or the clone is not enabled.
- **FR-002**: Every command MUST declare, in code, the packages it needs as
  names of dependency groups in the repository's `pyproject.toml`, and the
  launcher MUST compute the dependency plan for the requested command before
  running it, from the registry's declarations alone, without importing any
  third-party package. A command that needs no package MUST run on the plain
  standard-library interpreter. A command that needs packages MUST run under
  `uv` against the committed `uv.lock` and the groups it names, and MUST NOT
  resolve, upgrade or rewrite the lock when it runs.
- **FR-003**: An orchestrator MUST obtain Python packages only as
  0025-tooling-environment FR-013 allows: through `uv`, from `pyproject.toml`
  and `uv.lock` with a hash for every file, the two files uv owns and the only
  TOML an orchestrator keeps (FR-049), into uv's own cache and an environment
  uv creates for the run, never into an interpreter, virtual environment or
  site-packages the host owns. An orchestrator MUST NOT keep a lock of its own
  format for Python packages.
- **FR-004**: The orchestrator MUST run offline on request: when the
  environment variable named for the orchestrator with the suffix `_OFFLINE`
  is `1`, or `--offline` is given, it MUST NOT download anything, and a
  command whose plan needs something not already in uv's cache or the
  `ws-host` store MUST fail with an error resource naming the package and its
  group, or the toolchain entry, and the command that prepares it while online
  (FR-020, FR-067).
- **FR-005**: The orchestrator's core (its registry, parser, typed arguments,
  resources, renderings, errors, dependency plan, logging, environment-file
  parser, MCP server and generated-file machinery) MUST use the Python
  standard library only. Every module that declares a command or a toolchain
  entry (FR-007, FR-066) MUST import only the standard library at module level and
  MAY import a third-party package only inside the function that uses it, so
  that the registry, help, completion and the dependency plan work with no
  package installed. `doctor` MUST enforce this (FR-029).
- **FR-006**: A program outside Python that a command needs (a typesetter,
  a browser, a Java runtime, a Node runtime) MUST come from a Python package
  or from a toolchain entry (FR-066), never from the host, except a
  maintainer tool's approved program (FR-071). An orchestrator MUST NOT use a
  program found on the host, and MUST NOT install one with the host's package
  manager. The registry MUST declare each such program, the commands that need
  it, and the package or toolchain entry that supplies it, and a hint MUST name
  only that package or entry, or `ws-host` (0025-tooling-environment FR-012). A
  command whose entry cannot be obtained (offline with a cold store, or no build
  for the platform) MUST fail with an error resource that says what is missing;
  the one thing it may ask a person to install is what
  0025-tooling-environment FR-021 names, through `ws-host system ensure`
  (FR-069).

## The registry and the grammar

- **FR-007**: An orchestrator MUST keep one registry of its commands, kept in
  code: a command, a check section, a generator, a suite and a type is a
  function or class declared with the registry's decorators, and the registry
  is discovered by presence. Adding a module under the orchestrator's commands
  package adds its commands, and nothing else lists it; deleting the module
  removes them. The registry is the declaration of the orchestrator's
  prerequisites, packages, programs, check sections, generators, suites and
  per-command tables at their point of use (0025-tooling-environment FR-003).
  The reason is that AI agents change code with ease, while configuration files
  exist for people to edit by hand; a registry in code gives an agent one place
  to read and one place to change, and gives the tests something to run.
- **FR-008**: A command MUST be invoked as `<name> <noun> <verb> [ID]
  [--options]`: the noun names a kind of resource, the verb is one of a fixed
  set, and the ID, where the command takes one, is always the first
  positional argument after the verb. The verbs MUST be exactly: `list`,
  `show`, `status`, `check`, `build`, `generate`, `add`, `set`, `record`,
  `new`, `advance`, `ensure`, `sync`, `publish`, `serve`, `test`, `remove`, `run`. A verb MUST be one word; a
  hyphenated or compound verb MUST NOT be used. A verb outside the set MUST
  NOT be added except by amending this spec.
- **FR-009**: The verbs MUST mean: `list` (many resources of a kind, with
  filters); `show` (one resource in full); `status` (the state of a
  resource over time); `build` (write derived output from sources, output
  that is not itself the record); `generate` (write tracked files wholly
  derived from a declared source, which FR-036 proves current); `add` (put an
  item into a collection); `set` (change one field of an existing resource);
  `record` (append a fact to the tracked record); `new` (create a resource);
  `advance` (move a resource to its next state); `ensure` (make a machine or a
  workspace match its description, doing only what is missing and safe to
  repeat); `sync` (bring a local copy of something shared up to date, by
  fast-forward alone, FR-063); `publish` (send something
  outside the clone); `serve` (run until stopped); `test` (run a resource's
  tests in a place its own check does not, writing nothing); `remove` (take an item out of a collection or an installed thing off a machine, the inverse
  of `add`); `run` (run a program of the resource, in the environment the resource defines, and pass its output and status through). `check` is not a
  noun's verb: FR-010.
- **FR-010**: A small closed set of repository-wide commands MUST take no
  noun: `check`, `fresh`, `test`, `doctor`, `lock`, `context`, `help` and
  `update`, with the arguments FR-031, FR-036, FR-014, FR-030, FR-038, FR-065
  and FR-073 state; and an
  environment orchestrator MAY also have `workspace`, a noun whose commands
  prepare the person's machine (FR-063). An orchestrator MAY omit any of the
  repository-wide commands but MUST NOT add another without amending this
  spec. A check MUST run only through `check`; no `<noun> check` command MAY
  exist.
- **FR-011**: The one noun that serves a surface is `mcp` (FR-027), whose
  command takes the surface's own control word (`serve`) and is the only
  command whose second word may be outside FR-008's set. The editor
  (FR-050) is served by the Workspaces Console extension (0043-console-protocol), not by a
  command of the orchestrator; the orchestrator needs no `ui` command and no
  server for it.
- **FR-012**: The registry MUST be readable through the orchestrator itself:
  `command list` and `command show ID` MUST return every declared command and
  its noun, verb, category, arguments, surfaces, dependency group and programs
  as resources. Help and shell completion MUST be derived from the registry,
  never written by hand.

## Typed arguments

- **FR-013**: Every argument a command takes MUST have a declared type, a name
  in capitals (for example a spec, a requirement, a design system, a commit).
  A type MUST define how to validate a value, how to resolve it to a resource,
  and how to complete it. The parser, shell completion, the editor's
  quick-picks (FR-050) and an MCP tool's input schema (FR-027) MUST all take
  their validation and choices from that one declaration. A value that fails
  its type MUST produce an error resource naming the type and examples of
  valid values.

## Categories

- **FR-014**: Every command MUST declare exactly one category, from these
  seven: `read` (changes nothing); `check` (verifies, and changes nothing
  tracked); `record` (appends a fact to the tracked record); `build` (writes
  derived output); `generate` (rewrites tracked generated files); `decision`
  (changes what only the authority in effect decides, per 0001 FR-029, such
  as a spec's status, an approval or a repository's trust); `setup` (changes
  the machine's or the clone's own environment, such as a lock, a
  fetched toolchain entry or a running server). A command MUST NOT do more than its
  category allows.
- **FR-015**: Every command that writes (every category but `read` and
  `check`) MUST accept `--dry-run`, which validates exactly as the real run
  does, writes nothing, and returns the change it would make as a resource
  (what files, and for each a unified diff of what would change) with exit
  status 0 when the real run would succeed, so that the editor can show the
  change as a diff before it is made (0043-console-protocol FR-007).

## Resources, links and actions

- **FR-016**: Every command MUST return a resource, or a stream of resources
  (FR-019), never free text. A resource MUST carry: `kind` (the noun, or for a
  repository-wide command its own name, or `error`), `id`, `audience`
  (FR-040), `data` (what the resource is), `links` (related resources) and
  `actions` (what can be done next).
- **FR-017**: A link MUST name its relation and the command line that fetches
  the related resource. An action MUST be a library call with typed fields
  (FR-013), carrying its category (FR-014) and the surfaces that expose it
  (FR-022); its displayed command line MUST be generated from that call, never
  written by hand, and MUST follow FR-055. An action that cannot run now MUST
  be absent, or present and disabled with the reason. The same resource
  therefore drives the terminal's "what next", the editor's buttons and an
  agent's tools.
- **FR-018**: A resource MUST have three renderings, and no more: text
  (the default, for people), JSON (`--json`, on every command) and HTML
  (`--html`, for a person's browser or another tool that wants a page; the editor draws
  the JSON and never asks for it). All three
  MUST be views of the same resource, and MUST NOT differ in what they say:
  nothing may appear in one that the resource does not carry. Text MAY omit
  fields a person does not need; JSON MUST NOT.
- **FR-019**: JSON output MUST be one document per command:
  `{"schema": "<name>/<kind>@<n>", "audience", "kind", "id", "data", "links",
  "actions"}`, where `<n>` is the schema's integer version, raised on any
  change that breaks a reader and left alone for an added field. A command
  that streams (a long run reporting as it goes) MUST emit NDJSON: one such
  document per line, each complete in itself. Output meant for a program MUST
  go to standard output and diagnostics to standard error.
- **FR-020**: An error MUST be a resource of kind `error`, rendered the same
  three ways, carrying a stable `code`, a message, and the actions that say
  what to run next. A command MUST NOT print a stack trace as its error; an
  unexpected exception MUST become an error resource with code `internal`,
  its trace going to the log (FR-042) and shown only under `--debug`.
- **FR-021**: Exit status MUST be: 0 for success; 1 when the command ran and
  what it checked or tried failed; 2 for a usage error or an invalid
  argument; 3 for a missing package, program or prerequisite (FR-004, FR-006).
  An item a command deliberately leaves alone to protect a person's work (a
  repository with changes not yet committed, say) is not a failure: the
  command MUST exit 0 and list each skip, with the reason, in its resource
  (FR-056).

## Surfaces

- **FR-022**: Every command MUST be callable in the terminal. Each command
  MUST declare which of the other surfaces (the editor, MCP) expose it, and
  where it declares none the default MUST follow its category: `read`,
  `check`, `record`, `build` and `generate` on both; `decision` on the editor
  only; `setup` on neither. A command MAY narrow its default, and MAY widen a
  `setup` command to a surface by declaring it, but MUST NOT widen a
  `decision` command to MCP (FR-023). A `setup` command that needs
  administrator rights (FR-069) MUST NOT be exposed over MCP.
- **FR-023**: A `decision` command MUST NOT be callable over MCP. The MCP
  server MUST NOT list one, MUST refuse a call that names one, and no
  declaration, option or environment variable MAY change that. An agent that
  wants a decision made records a proposal (FR-039) for a person to decide in
  the terminal or the editor.
- **FR-024**: Every surface MUST call the same library call as the terminal
  and return the command's own resource. A command's code MUST be thin: it
  parses nothing, renders nothing and keeps no surface-specific logic; its
  rules live in the repository's library code, so that the surfaces cannot
  disagree.

## The editor surface

- **FR-050**: The editor surface MUST be one VS Code extension, the
  Workspaces Console (workspaces-host's Console specification), the secondary
  interface for every orchestrator beside the command line, which is the core.
  It MUST hold no behavior of its own: it discovers each trusted repository's
  orchestrator launcher (0043-console-protocol FR-001), runs `<name> command
  list --json` and `<name> <noun> <verb> ... --json`, renders the resources
  they return, and runs a resource's actions by invoking the orchestrator, and
  does nothing else. It MUST show a status that says in plain words whether
  things are well, the orchestrators and their audiences, an action as a
  button with a way to show its command (FR-055), a quick-pick for a typed
  argument (FR-013), a check's findings in the editor's problems list, a
  stream (FR-019) as progress, and an HTML rendering in a panel that loads
  local resources only and runs no script from outside it. The extension is
  built from its source in the repository that holds it, from its own packages
  and lock, so that no program is needed on the host to build it.
- **FR-051**: A `decision` action in the editor MUST require a modal
  confirmation that only a person can give. An AI agent working inside the
  editor MUST NOT be able to trigger a `decision` through any editor command,
  setting or API the extension exposes, and the extension MUST NOT offer
  such a command.
- **FR-052**: The extension MUST run the orchestrator of a repository only when
  the repository is trusted (FR-061), MUST refuse to run in VS Code's
  Restricted Mode, and MUST declare that it runs where the workspace is and
  does not support untrusted workspaces.
- **FR-053**: The extension MUST check each document's `schema` (FR-019)
  against the versions it understands, and MUST say in plain words that an
  update is needed, with the action that updates it, rather than fail or
  show a document it cannot read.

- **FR-064**: Every orchestrator MUST use one wire shape for what the editor
  reads, so that the extension holds no rule of any one orchestrator. `command
  list` MUST have `data.commands`, each with `id`, `category`, `group`,
  `surfaces` (any of `terminal`, `editor`, `mcp`) and `help`. `command show`
  MUST have `id`, `noun`, `verb`, `category`, `help`, `group`, `arguments` (each
  with `name`, `type`, `help`, `required`, `words` and `many`, and `choices`
  where the type can list them), `options` (each with `flag`, `type`, `help`,
  `multiple` and `required`), `usage`, `surfaces` and `programs`. An action
  MUST have `label`, `command` (its words), `fields` (by argument name),
  `category`, `surfaces`, `cli` (the one pasteable line of FR-055, or null
  where a value is needed), `enabled` and, where it needs a value only a person
  can give, `needs` and, where disabled, `reason`; a link MUST have `rel`,
  `command`, `fields` and `cli`. A `check` resource's data MUST have `status`,
  `summary` (`run`, `passed`, `failed`, `skipped`) and `sections`, each with
  `name`, `status` (`passed`, `failed` or `skipped`) and `findings`, each with
  `level`, `where`, `message` and `next`. A field MAY be added without
  raising a schema version (FR-019); none MAY be renamed or removed without it.

  An orchestrator MUST also say how its resources are presented, so that the
  editor draws views, rows, icons and a palette without holding any
  orchestrator's knowledge. This is added to the shape above; it raises no
  schema version, and an editor MUST work, with plainer views, from a document
  that lacks it. `command list` MUST add to its `data` an object
  `presentation`, and each command row, and `command show`, MUST add `title`
  and, where the command has one, `icon`:

  - `title`: the command's title in the editor's command palette, a verb and an
    object in capitals ("Show Spec…"), at most 40 characters, ending with an
    ellipsis exactly when the command asks for a value before it can run. Every
    command that declares the `editor` surface MUST have one. `icon` is a
    codicon id.
  - `presentation.views`: the views the orchestrator asks for, in order, each
    with `id` (lowercase words joined by hyphens, unique in the orchestrator),
    `title`, `icon` (a codicon id), `order` (an integer; 10 is the editor's own
    Home, so a view's is above it) and, optionally, `description`.
  - `presentation.nouns`: one object for each noun, with `noun`, `title`
    (singular, for people), `icon` (a codicon id), optionally `view` (the `id`
    of a view above, in which the noun's resources are listed; a noun with none
    is listed only in the editor's tree of every command) and, where the
    noun has a `list` command that asks for nothing, `list`:
    `command` (its words), `rows` (the key of `data` that holds its rows), `id`
    (the row field that is the argument of the noun's `show` command),
    `label` (the field shown as the row's text), and optionally `description`
    (a muted field after it), `status` (a field whose value is the row's
    status), `status_map` (an object from that field's values to the statuses
    below, required where a value is not already one of them), `badge` (a field
    shown as the row's count), `icon` (a field whose value is a codicon id,
    the row's own icon where it has no status, as a kind of resource has one
    for each of its kinds), `search` (the name of an option of the `list`
    command, taking text, that narrows the rows to the ones that match; the
    editor then offers a Search action that asks for the text and runs the
    `list` with it) and `tooltip` (fields listed in its hover).
  - A status is one of a fixed vocabulary, never free text: `ok`, `warning`,
    `error`, `pending`, `skipped`, `info`, `muted`. An editor maps each to a
    codicon and a theme color of its own (`ok` to the passed test icon, `error`
    to the failed, and so on); an orchestrator names neither. The statuses a
    `check` resource carries are mapped by this rule: `passed` is `ok`,
    `failed` is `error`, `skipped` is `skipped`, and a finding's `level` of
    `error`, `warning` or `info` is that status.
  - `presentation.references`: the patterns in files that name a resource, each
    with `id`, `noun` (whose `show` command gives the resource), `pattern` (a
    regular expression that Python and JavaScript read alike, with groups),
    `value` (the argument of the `show` command, written with `$1`, `$2` for
    the pattern's groups), `files` (globs, relative to the repository), and
    optionally `text` (the field of the shown resource that is its words),
    `facts` and `lens` (fields listed in a hover and in a short line above the
    reference) and `definition` (the fields `path` and `line` of the shown
    resource, where a person can go to its definition).

  An orchestrator MAY declare `list` rows only for commands that are `read`
  commands the editor surface exposes (FR-022).

- **FR-065**: An orchestrator MAY provide `help [TOPIC]` (read), the one place
  its daily-work documentation lives. A topic MUST be code, in plain language
  (FR-054), and MUST be a resource whose steps are actions (FR-017) the editor
  can run, so that a person can learn by doing in the editor as well as by
  reading in the terminal. No other document MAY restate what a topic says: a
  reference or an overview MUST link to the topic, or MUST be generated from
  the same code and proven current by `fresh` (FR-036), so that documentation
  does not drift from behavior. `help` with no topic MUST list the topics.
- **FR-073**: An environment orchestrator MAY provide `update`, which brings the
  orchestrator's own copy to its newest version by fast-forward alone (FR-063),
  leaving a copy with changes not committed, diverged commits or no shared
  branch exactly as it was and saying why in plain words, with exit status 0.
  `update --check` MUST only look, change nothing and say what is new. A
  command that brings a person's machine or workspace into its described state
  MUST be `<noun> ensure`, and one that brings a copy of something shared up to
  date MUST be `<noun> sync`; neither MAY be called `advance`, which is for
  moving a resource to its next state (FR-009).

## Behavior and information

- **FR-046**: An orchestrator's own configuration MUST be sorted into
  behavior and information. Anything whose change alters what the
  orchestrator does is behavior and MUST be Python code: commands, toolchain
  entries, package lists, the versions and hashes of downloads, checks, rules, the
  orchestrator's name, audience, suites and paths. Information is names,
  places, identities and credentials, and MUST be held as an environment file
  (FR-047). This rule governs an orchestrator's own configuration only. It
  does not govern the repository's content, which keeps its own formats: specs
  stay Markdown, the ontology Turtle, registers TSV, and tokens and fixtures
  JSON.
- **FR-047**: An environment file MUST follow the syntax of `os-release(5)`
  and of systemd's `EnvironmentFile`: one `KEY=value` per line, the value
  optionally in single or double quotes, `#` starting a comment, no variable
  expansion and no line continuation. A list MUST be space-separated values on
  one line. The orchestrator's core parses it with the standard library alone.
- **FR-048**: An orchestrator MUST need no configuration file by default.
  An orchestrator MUST NOT read another orchestrator's files; what another
  needs, the environment orchestrator exports as environment variables.
- **FR-049**: An orchestrator's own configuration MUST NOT use YAML. A file format owned
  by a third-party tool (`pyproject.toml` and `uv.lock`, which uv owns, and
  `package.json` and `package-lock.json`, which npm and VS Code own) MAY be used only
  where that tool owns the format. Markdown MUST be used only for a proposal
  (FR-039).

## The MCP server

- **FR-027**: An orchestrator MAY serve MCP through `mcp serve`, over standard
  input and output, as JSON-RPC. It MUST expose as tools exactly the commands
  that declare MCP and are not `decision` commands (FR-022, FR-023). Each
  tool's input schema MUST be generated from its typed arguments (FR-013), its
  result MUST be the command's JSON resource (FR-019), and its failures MUST be
  error resources (FR-020) that carry what to run next. A tool that writes MUST
  take a `dry_run` argument that defaults to true. The server MUST implement
  the MCP lifecycle (`initialize`, then the client's `notifications/initialized`),
  `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`
  and `resources/read`, ignore a notification it does not handle without
  answering it, and answer a request it does not know with JSON-RPC's
  method-not-found error. It MUST answer `initialize` with the protocol
  revision the client asks for where it supports that revision, and otherwise
  with its own latest; it MUST write nothing to standard output but protocol
  messages, one JSON-RPC message per line; and, like the rest of the core, it
  MUST need no package (FR-005). It MUST expose the repository's resources
  (a spec, a requirement, a design system and the like) as MCP resources
  readable by URI, each the JSON resource of the command that shows it
  (FR-019), and a URI that names none MUST be answered with an error that
  carries an error resource (FR-020).

## Isolated commands and the doctor

- **FR-028**: A command MAY be declared isolated, and MUST be when its
  dependency group differs from another command's that runs beside it in one
  invocation. An isolated command MUST run in its own worker process under its
  own plan (FR-002) and return its resource as JSON to its parent. One
  process MUST NOT ever hold two dependency groups: `check` with sections from
  several groups MUST run each section's group in its own worker.
- **FR-029**: `doctor` MUST report what the orchestrator needs and what is
  present: the launcher's prerequisite (`ws-host`), whether `uv.lock` matches
  `pyproject.toml`, whether each group's packages are in uv's cache (so offline
  runs work), and the state of each toolchain entry as `ws-host` says it
  (installed, or not installed yet), with hints (FR-006) that name `ws-host
  toolchain ensure` for a missing entry and `ws-host system ensure` for a
  missing library (0025-tooling-environment FR-021). It MUST also
  check the registry and fail on any conflict: two commands with one name; two
  toolchain entries with one name (FR-066); a command in two groups; a type
  declared twice with different meanings; a non-isolated invocation whose plan
  needs two groups (FR-028); a module that declares a command or a toolchain
  entry and imports a third-party package at module level (FR-005); and a
  `uv.lock` that does not match `pyproject.toml`. `doctor` MUST change nothing
  and MUST need no network.
- **FR-030**: `lock` MUST be a `setup` command that writes `uv.lock` from
  `pyproject.toml` through uv, and MUST refuse to run offline (FR-004). A
  `pyproject.toml` and a `uv.lock` that disagree MUST fail `doctor` (FR-029).

## Checking

- **FR-031**: Every check MUST run through `check [SECTION...] [--scope ID]
  [--suite SUITE] [--changed]`. A section is a named check the registry
  declares in code, with the programs it needs (FR-006), the watched paths it
  depends on (FR-032), and the suites it belongs to. A suite is a named set of
  sections, so that a CI job runs one suite and a person runs all. `--scope`
  limits a section that supports it to one resource, as that section's typed
  argument.
- **FR-032**: `check --changed` MUST run only the sections whose declared
  watched paths (path globs in the section's declaration) contain a file that
  Git reports as changed in the working tree, staged, or untracked, or that
  differs from the commit it is told to compare with. A section that declares
  no watched paths MUST always run. `--changed` MUST list each section it
  skipped and why, and MUST NOT use any rule that is not a declared watched
  path.
- **FR-033**: A check MUST NOT report a section it did not run as passed. With
  no sections or suite named, `check` MUST run every section, and a section
  whose program is missing (FR-006) MUST be reported as skipped and make the
  exit status non-zero; a suite or a section named explicitly MUST run exactly
  what it names. A check's resource MUST list each section's result, and
  each finding with its location and the action to take next (FR-017). A
  check MUST NOT change any tracked file.
- **FR-034**: An orchestrator MUST carry its own tests, run by `test` with the
  standard library's test runner, unless the group declares packages it needs;
  `test` MUST fail on any failing test and report none it did not run as
  passed.

## Generated files

- **FR-035**: The registry MUST declare each generator by name, with the
  sources it reads and the tracked files it writes. A file a generator writes
  MUST carry a header naming the generator and its source, and MUST NOT be
  edited by hand. The `generate` command for the generator's noun rewrites
  them, with `--dry-run` (FR-015).
- **FR-036**: `fresh [GENERATOR...]` MUST regenerate each named generator's
  output (every generator when none is named) outside the working tree and
  compare it with the tracked files, fail on any difference naming the
  generator and the command that rewrites it, and write nothing.
- **FR-037**: The files that tell an AI agent how to use the orchestrator (a
  skill, an instructions file) MUST be generated from the registry by a
  generator (FR-035), listing exactly the commands, their categories and the
  surfaces that expose them, saying that a `decision` command is for a person,
  and proven current by `fresh` (FR-036). No hand-written text MAY stand in
  for them.

## Context and proposals

- **FR-038**: `context RESOURCE` MUST return, as one resource, what an agent
  needs to work on the resource it names: the resource itself, the specs and
  requirements that govern it, its links, its actions, and the files it
  concerns. It MUST be deterministic, bounded in size, and say what it left
  out. It MUST be available for every kind of resource that has a context
  provider, each provider returning the same parts in the same shape.
- **FR-039**: A proposal MUST be a tracked file in a directory the
  orchestrator's code names, holding an id, the resource it concerns, the
  reason, and the change proposed as a typed action (FR-017) that can be
  replayed. A proposal is open or accepted. Only a `record`, `generate` or
  `decision` command MAY be proposed, and never a proposal command; a proposal
  is tracked because the change it proposes is not worth less than a commit.
  `proposal list` and `proposal show` MUST be `read` commands, `proposal new` a
  `record` command, and `proposal advance` a `decision` command that replays
  the action (showing its `--dry-run` first, FR-015) and marks the proposal
  accepted. Refusing a proposal is deleting its file in a commit.

## Audience and boundaries

- **FR-040**: Every output MUST name its audience: the resource's `audience`
  field and, in text, a line saying so. The audience the orchestrator's code
  declares is stamped on every output. `--root DIR` MAY point a `read` or
  `check` command that declares itself relocatable at another repository,
  checking it with this repository's rules; the output MUST then NOT carry
  this repository's audience, and MUST say `unstated`. A command that writes
  MUST refuse `--root`.
- **FR-041**: Git MUST be the only record. A command that changes the record
  writes tracked files and leaves the commit to a person; no command MAY
  commit, push, tag, or otherwise write to Git, except that an environment
  orchestrator MAY clone a repository and advance a clone by fetch and
  fast-forward only (FR-063). A command MAY read Git's state.
- **FR-042**: What does not warrant a commit but changes or runs something (a
  command that writes, a check, a build, a decision, a dry run, a fetched
  toolchain entry, an MCP call that does one of these) MUST go as NDJSON lines to
  untracked logs in a directory the orchestrator's code names, which the
  repository ignores, each line noting the time, the surface (`cli`, `editor`
  or `mcp`; `editor` when the environment variable `IF_CONSOLE` is `1`,
  0043-console-protocol FR-006), the command, its typed arguments and its exit status. A `read`
  command, a page viewed in the editor and a resource read over MCP change
  nothing and MUST NOT be logged; a refused call to a command that is not
  `read` (a decision over MCP, an invalid argument) MUST be. A log line MUST
  NOT hold a person's name, a secret or file contents. A person's name MUST
  NOT be written to a tracked file except where a command's own data requires
  it, as a command argument that records who.
- **FR-043**: No command MAY call an AI model or service. Agents call the
  orchestrator; the orchestrator never calls them.
- **FR-044**: An orchestrator MUST be built for one user in one clone: it MUST
  NOT lock, queue or reconcile concurrent writers.
- **FR-045**: A repository's orchestrator MUST NOT read, fetch or depend on
  the code or data of another repository, except a repository the person
  names with `--root` (FR-040), except that it MAY run `ws-host`, the
  environment orchestrator it assumes (0025-tooling-environment FR-005), and
  except that an environment orchestrator
  MAY read the `.workspaces-host/` directory of a repository the person
  trusts (FR-061) and MAY clone repositories that a person's configuration or
  a listed repository's environment file names as data (FR-062). It MUST treat
  the names of repositories as data from the ontology or the repository's own
  register, never as literals in its code, specs, documentation or messages.

## Plain language and pasteable actions

- **FR-054**: The first line of every text rendering MUST be plain language
  that a person who understands nothing technical can read: no jargon, no
  identifiers, no command words. Jargon MAY appear in JSON and in later lines
  of the text.
- **FR-055**: An action's displayed command MUST be one line, ready to paste
  into the terminal, with no placeholder and no shell-specific quoting, so
  that it reads the same in bash and in fish. An action that needs a value the
  orchestrator cannot fill in itself MUST be offered as a button or a
  quick-pick in the editor, not as a printed command.
- **FR-056**: Whenever a command deliberately leaves something alone, its
  rendering MUST say in plain words that the person's work is safe, name what
  was left alone and why, and give the one next action, if there is one.
- **FR-077**: A command that cannot do its work without a value that belongs to the person (an identifier of an account or an app, a name) MUST NOT require an environment variable
  or an edited file. Where a person can be asked (a terminal, in text mode), it MUST say in plain words what the value is and where to find it, ask for it, check it with the
  argument's type (FR-013), ask again on a wrong answer and stop after a few, keep it for the person where the orchestrator keeps such values, and not ask again. Where no one can be asked (the editor,
  MCP, a pipeline) it MUST fail with the error code `needs-input` and status `missing`, whose plain text says the same, and whose actions are a `set` command taking the values as typed
  arguments (so that the editor asks for them in boxes, FR-055) and then the command again. A value MAY also be given in an environment variable or the person's configuration, and MUST then
  not be asked for. A secret MUST NOT be asked for this way: it MUST be typed only where it is never echoed, and never kept in a file the person can read.
- **FR-057**: `context` together with `doctor`, with secrets removed, MUST
  form a report a person can paste to a person or to an AI to get help. The
  editor MUST offer it as a "Get help" command (FR-050).

## Retired kits and trust

- **FR-058**: Retired. A program a command needs comes from a package or a
  toolchain entry (FR-066), not from a kit a person installs.
- **FR-059**: Retired. The only fetch an orchestrator makes is of a toolchain
  entry into the `ws-host` store (0025-tooling-environment FR-017), and it
  uses no package manager and no `sudo` (the one `sudo` command is `ws-host system ensure`, 0025-tooling-environment FR-021).
- **FR-060**: Retired. `doctor` prints the version of each toolchain entry
  and package (FR-029).
- **FR-061**: A repository's launcher MUST run from the editor only when the
  person has trusted that repository. Trust MUST be an explicit act of the
  person, MUST NOT be granted by any repository's own file or by cloning, MUST
  NOT pass from a repository to the repositories its file lists, and changing
  it MUST be a `decision` command (FR-014). Trust applies to the repository,
  not to its content: the commit at which it was granted MUST be recorded, and
  the environment orchestrator's `doctor` MUST warn, without blocking, when the
  repository's launcher has changed since.
- **FR-062**: Reading a repository's `.workspaces-host/provider.toml`
  (0043-console-protocol FR-001) is reading information and MUST
  need no trust; running that repository's launcher from the editor MUST need
  trust (FR-052, FR-061). A person's own configuration, and no repository's
  file, MUST be what names the organizations whose repositories are trusted.
- **FR-063**: An environment orchestrator MUST update a clone only by fetching
  and then advancing it by fast-forward alone; it MUST NOT pull, rebase, merge
  other than by fast-forward, or stash. A clone with changes not yet
  committed, with commits that have diverged from its upstream, or with no
  upstream MUST be left exactly as it was and reported in plain words
  (FR-056), with exit status 0 (FR-021). A clone or fetch MUST run without
  prompting, and when it fails MUST report git's own reason with the one
  action that fixes it, never report success for a repository it could not
  reach, and never write into a clone's working tree, its ignore rules or
  its editor settings, or change the person's git or editor configuration
  unasked.


## The toolchain

- **FR-066**: An orchestrator MUST declare each toolchain entry as data in
  `.workspaces-host/toolchain.d/<name>.toml`, the fields
  0025-tooling-environment FR-016 names and `ws-host` reads, and each command MUST declare in its registry entry which
  toolchain entries and packages its plan names, so that the plan, `doctor` and
  the offline check are computed from the registry alone (FR-002). A module
  under the orchestrator's toolchain package holds only an entry's functional
  check and the way its program is started, and MUST import only the standard
  library at module level (FR-005). The fetching, verifying, unpacking and
  storing are `ws-host`'s, not the orchestrator's.
- **FR-067**: An orchestrator MUST NOT have the nouns `provider`, `toolchain`
  or `system`: they are `ws-host`'s, which
  installs an entry on first use when a command's plan names it, refuses to
  fetch offline (FR-004), and answers `provider show NAME` with each entry's
  version, state, installed path and environment, so that an orchestrator
  finds what it pinned. The command that prepares the store while online is
  `ws-host toolchain ensure --provider NAME`.
- **FR-068**: A toolchain entry's checksum, its address and its version MUST
  change only in a commit of their own that passes the entry's functional
  check (0025-tooling-environment FR-009, FR-016), and the registry's `check`
  MUST fail on an entry that `ws-host` rejects, whose
  generated `mise` files are not current, or that lacks the platform
  `linux-x64` (0025-tooling-environment FR-020).
- **FR-069**: Retired. `ws-host system ensure` installs the shared libraries
  that entries list in their `system` key; it is the
  only command that may run `sudo`, prints exactly what it will run, takes
  `--dry-run` (FR-015), asks before running `sudo` and refuses to run under MCP
  (FR-022).

- **FR-070**: Python comes first. Before a change adds a program outside
  Python — a toolchain entry, a Python package that only wraps one, or a host
  program for a maintainer tool (FR-071) — it MUST show that the Python
  standard library and the packages already used cannot do the work, and MUST
  ask the decision authority (0001-eidolon-architecture FR-029) to approve the
  program before it is used. The approval is recorded as a Decision
  (0008-decision-records) naming the program, what it does that Python cannot,
  and the commands that run it. Where the work can be done by a program
  already approved, that program MUST be used rather than a new one, so the
  set of programs stays as small as the work allows. A server, a generator or
  a command-line program that the company writes is a Rust program
  (0025-tooling-environment FR-030), not a program outside Python in the sense
  of this requirement; a command that runs it is a Python script of the
  command group, and the Rust program is built from source with the `rust`
  kit of `ws-host` or delivered as a container image.
- **FR-071**: A maintainer tool is a command a person runs to bring material
  in from outside the repositories, such as reading another repository's
  source. Its output is committed, and no build, check, test, generator or
  served page needs it to run. A maintainer tool MAY run a program found on
  the host, if that program was approved under FR-070. Its registry entry MUST
  name the program. Its hint and its error, when the program is missing, MUST
  name that program (an exception to 0025-tooling-environment FR-012). No
  other command MAY run the program or depend on the maintainer tool.

- **FR-072**: An orchestrator that emits `presentation` and `title` (FR-064)
  MUST check its own declarations, in the check of its registry, and MUST fail
  on: an icon that is not a codicon id of the glyph map it pins (a file
  generated from the `@vscode/codicons` package, named with its version and
  integrity hash); a noun or command with no icon or title where FR-064
  requires one; a `view` no declaration holds; a view or noun field that FR-064
  does not name; a title that is not a verb and an object, is over 40
  characters, or whose ellipsis disagrees with whether the command asks for a
  value; a `list` whose command is not a `read` command offered to the editor
  or asks for a value; a `search` that is not an option of that command taking
  text and not required; a row `icon` value that is not a codicon id of the
  glyph map; a `status_map` value outside the vocabulary; a
  `references` pattern that only Python reads or that lacks a group its `value`
  names; and, against the data the commands return, a `list` field that is
  absent from a row, a status value that nothing maps, and a reference field
  that the shown resource lacks.

- **FR-074**: An orchestrator MAY declare, in `presentation.services`, commands that go on running: for each, an `id`, a `title` for people, an `icon`, the
  `command` that serves, the `prepare` command that builds what it serves (both in the command tree), and a `description`. Run with `--json`, a service
  MUST print as its first line one document on one line whose `data.url` says where it answers, then go on running until it is ended by SIGTERM, ending
  with exit status 0. An editor shows each in a Services view with Start, Stop and Open in Browser; when a service stops before it is up it runs `prepare`
  once and starts it again. Starting and stopping a service is not a command of the person's choosing, so a service is not offered as a command to run; the
  registry check (FR-072) MUST fail a service whose `command` or `prepare` is not in the command tree, or that has an unknown field or no title.

- **FR-075**: A command that builds MAY say what it made: `data.outputs`, a list of paths relative to the repository (a rendition, or a folder when it made
  several). An editor offers them to open. A path that is absolute or leaves the repository names nothing.

- **FR-076**: A `presentation` view MAY carry `simple = true` to say it is an everyday view. An editor for newcomers shows only those (and its own Home and
  Services) until the person asks for every view, and shows every view when no view declares it.

## Out of scope

- The commands a particular repository's orchestrator has; each repository
  states them in its own spec (the public root's is 0042-agora).
- The environment orchestrator's own commands, layout and paths; the
  repository that holds it states them in its own specs.
- How a command's library code is written, beyond FR-024.
- How AI agents choose which commands to call.

## Edge cases

- A command needs a package or a toolchain entry and the machine is offline
  with a cold store: it fails with an error resource naming the package and
  group, or the entry, per FR-004 and FR-020; it does not fall back to
  downloading.
- A command needs a program the host also has on its `PATH`: it is not used
  and the entry from the store is, per FR-006.
- A tool would be easier to write with a program outside Python that
  Python's standard library or an existing package can also do: Python is
  used and the program is not added, per FR-070.
- A maintainer tool must read another repository's TypeScript, which no
  Python package can evaluate: the decision authority approves a host
  program for it, and only that tool runs it, per FR-070 and FR-071.
- A command needs a toolchain entry the store lacks and the machine is online:
  `ws-host` fetches and verifies it once, then it runs, per FR-066 and FR-067.
- A browser's system libraries are missing on Linux: the command fails with
  exit status 3 naming the setup command, and installs nothing, per FR-006 and
  0025-tooling-environment FR-021.
- An agent asks to accept a proposal over MCP: the call is refused and the
  tool is not listed, per FR-023; the person advances it in the terminal or
  the editor, per FR-039.
- An AI agent inside the editor tries to confirm a `decision` itself: no
  editor command offers it and the confirmation is modal, per FR-051.
- Two sections of one `check` need different dependency groups: each runs in
  its own worker, per FR-028 and FR-031.
- A check runs offline before its toolchain entry is fetched: the section is skipped, the
  exit status is non-zero and the summary says so, per FR-033.
- `check --changed` on a clone with only untracked files: they count as
  changes, per FR-032.
- A command is run with `--root` on a repository that is not this one: the
  output says its audience is unstated and a writing command refuses, per
  FR-040.
- A generator's output was edited by hand: `fresh` fails and names the
  generator and its rewriting command, per FR-035 and FR-036.
- Two people edit one clone's files at once: nothing reconciles them, per
  FR-044; Git does at commit.
- A command that wants to run `git commit` or `git push`: it MUST NOT, per
  FR-041; it writes the files and says what to commit.
- A write over MCP that an agent should preview: `dry_run` defaults to true,
  per FR-027.
- A new verb a repository wants: amend this spec first, per FR-008 and
  0001 FR-037.
- A guide that repeats what `help` says: it is replaced by a link or generated
  from the same code, per FR-065.
- Two modules declare a command with one name, or a toolchain module imports a
  package at module level: `doctor` fails and names both modules, per FR-029.
- A repository's launcher needs trust that the person has not given: the
  editor does not run it and says so in plain words, per FR-061 and FR-052.
- A trusted repository lists a sibling repository in its environment file: the
  sibling is cloned but not trusted, per FR-061 and FR-062.
- A repository's file tries to name an organization as trusted: ignored, per
  FR-062.
- A clone has commits that were never pushed and the upstream has moved: the
  update leaves it exactly as it was, says the work is safe and why it was not
  updated, and exits 0, per FR-063, FR-056 and FR-021.
- A clone fails because the person has not signed in: the report carries git's
  own reason and the one action that signs in, per FR-063 and FR-055.
- The extension meets a document whose schema is newer than it knows: it says
  an update is needed and shows nothing it cannot read, per FR-053.
- VS Code is in Restricted Mode: the extension runs no orchestrator, per
  FR-052.
- An action needs a value the orchestrator cannot fill in: the editor asks for
  it with a quick-pick and no command with a placeholder is printed, per
  FR-055.
- A toolchain entry whose checksum does not match what was fetched: it is
  deleted and the command fails naming both, per FR-066 and
  0025-tooling-environment FR-017.

## Assumptions

- `uv` is available on the host (0025-tooling-environment FR-014), and a
  Python 3 interpreter with the standard library is present; nothing else is.
- Each repository's orchestrator is used by one person at a time in one
  clone, and Git is the means of sharing and merging work.
- People run a Debian-family Linux distribution on bare metal, under WSL on
  Windows, or inside a virtual machine or container (which is how macOS is
  supported); other distributions and determinism by generated container
  files are for later specs.
- A person who wants a graphical interface works in VS Code; the editor
  surface, the Workspaces Console, is the one graphical interface, and the command line
  needs none.
- A person without technical knowledge can copy and paste a line into a
  terminal and click a button, and nothing more.
- The orchestrators of repositories that already exist declare their registry
  in a manifest until each is moved to code; this spec states the rule they
  move to.

## Open questions

- **OQ-1**: Whether a stream's last line should summarize it, or leave that
  to the consumer.
- **OQ-2**: Whether the editor's HTML renderings should be exportable as
  static files.
- **OQ-3**: How an AI agent reaches an orchestrator over MCP when the editor
  is not in use, and which commands that surface exposes by default.

## Key entities

- **An orchestrator** — a repository's launcher and the registry of commands
  behind it; the only way its behavior is run.
- **An environment orchestrator** — the orchestrator every other one assumes:
  it prepares a person's machine, clones their repositories and installs their
  toolchains (0026-workspaces).
- **A toolchain entry** — a program with no wheel, declared as data with an
  address and checksum per platform and installed by `ws-host` into its store
  (0025-tooling-environment FR-016).
- **The registry** — the commands, nouns, verbs, categories, surfaces,
  dependency groups and arguments the orchestrator's code declares.
- **A resource** — what every command returns: kind, id, audience, data,
  links and actions.
- **A category** — read, check, record, build, generate, decision or setup;
  what a command may do and where it is exposed.
- **A surface** — the terminal (the core), the editor (the Workspaces Console), or MCP.
- **A dependency group** — the commands that share one set of packages in
  `pyproject.toml` and `uv.lock`.
- **A section and a suite** — a named check, and a named set of them.
- **A generator** — a declared source and the tracked files wholly derived
  from it.
- **A proposal** — a tracked, replayable change suggested for a person to
  decide.
- **Trust** — a person's explicit act that lets the editor run a repository's
  launcher.

## Success criteria

- **SC-001**: A fresh clone runs the orchestrator's `doctor` and its `check`
  with only `python3` and `uv` and no setup step.
- **SC-002**: Every command's three renderings agree, because each is a view
  of the one resource.
- **SC-003**: No `decision` command is reachable over MCP or by an AI agent
  inside the editor.
- **SC-004**: `fresh` passes on every clone whose generated files are
  unedited.
- **SC-005**: No command commits, pushes, or calls a model.
- **SC-006**: Adding a module to the commands package adds its commands, and
  nothing else needs editing.
- **SC-007**: An update never changes a clone that holds work the person has
  not pushed.
- **SC-008**: The first line of every command's text output is plain
  language.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
