# Feature Specification: A repository's orchestrator

**Spec ID:** 0041-command-line
**Status:** Draft

**Input:** The rules any Eidolon repository's orchestrator follows. An
orchestrator is the one command that runs a repository's behavior: the only
way a person, a CI job or an AI agent runs what that repository does, in
place of scattered scripts. It is one launcher and one body of Python code
that declares its commands in a registry found by presence, takes typed
arguments, returns every result as a resource rendered as text, JSON or HTML,
reports errors as resources, exposes each command on the surfaces its
category allows (the terminal, the editor and, for agents, MCP), and never
decides for a person what only a person decides. Its behavior is code and its
information is a small environment-style file. It obtains its Python packages
only from uv's own files, runs offline on request, and records nothing outside
Git. An orchestrator that prepares a person's machine, clones their
repositories and installs kits is an environment orchestrator; the editor
extension that is the graphical interface for every orchestrator ships with
it. This spec states those rules for any repository. Names such as `agora`,
`eid` and `ws-host` are examples of orchestrator names, not part of any rule;
the public root's command set is 0042-agora.

## The launcher and its dependency plan

- **FR-001**: A repository's orchestrator MUST be one executable launcher at
  the repository root, named for the orchestrator, written in POSIX `sh`,
  that needs only `uv` and a Python 3 interpreter from the host. It MUST run
  from a fresh clone with no step beyond the clone (0025-tooling-environment
  FR-006), from any working directory inside the clone, and MUST find the
  repository from its own location.
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
  and `uv.lock`, the two files uv owns and the only TOML an orchestrator keeps
  (FR-049), into uv's own cache and an environment uv creates for the run,
  never into an interpreter, virtual environment or site-packages the host
  owns. An orchestrator MUST NOT keep a lock of its own format.
- **FR-004**: The orchestrator MUST run offline on request: when the
  environment variable named for the orchestrator with the suffix `_OFFLINE`
  is `1`, or `--offline` is given, it MUST NOT download anything, and a
  command whose plan needs something not already in uv's cache MUST fail with
  an error resource naming the package, its group and the command that
  prepares it while online (FR-020).
- **FR-005**: The orchestrator's core (its registry, parser, typed arguments,
  resources, renderings, errors, dependency plan, logging, environment-file
  parser, MCP server and generated-file machinery) MUST use the Python
  standard library only. Every module that declares a command or a kit
  (FR-007, FR-058) MUST import only the standard library at module level and
  MAY import a third-party package only inside the function that uses it, so
  that the registry, help, completion and the dependency plan work with no
  package installed. `doctor` MUST enforce this (FR-029).
- **FR-006**: A program outside Python that a command needs (a typesetter, a
  browser, an image tool, a Node runtime) MUST come from the host
  (0025-tooling-environment FR-006, FR-007). An orchestrator MUST NOT install,
  download or upgrade one, except an environment orchestrator installing a kit
  a person asks for (FR-059). The registry MUST declare each such program, the
  commands that need it, and a hint naming the kit that supplies it, never the
  reference environment itself (0025-tooling-environment FR-012). A command
  whose program is missing MUST fail with an error resource carrying that hint.

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
  `new`, `advance`, `publish`, `serve`. A verb MUST be one word; a
  hyphenated or compound verb MUST NOT be used. A verb outside the set MUST
  NOT be added except by amending this spec.
- **FR-009**: The verbs MUST mean: `list` (many resources of a kind, with
  filters); `show` (one resource in full); `status` (the state of a
  resource over time); `build` (write derived output from sources, output
  that is not itself the record); `generate` (write tracked files wholly
  derived from a declared source, which FR-036 proves current); `add` (put an
  item into a collection); `set` (change one field of an existing resource);
  `record` (append a fact to the tracked record); `new` (create a resource);
  `advance` (move a resource to its next state); `publish` (send something
  outside the clone); `serve` (run until stopped). `check` is not a noun's
  verb: FR-010.
- **FR-010**: A small closed set of repository-wide commands MUST take no
  noun: `check`, `fresh`, `test`, `doctor`, `lock`, `context` and `help`, with
  the arguments FR-031, FR-036, FR-014, FR-030, FR-038 and FR-065 state; and an
  environment orchestrator MAY also have `workspace`, a noun whose commands
  prepare the person's machine (FR-063). An orchestrator MAY omit any of the
  repository-wide commands but MUST NOT add another without amending this
  spec. A check MUST run only through `check`; no `<noun> check` command MAY
  exist.
- **FR-011**: The one noun that serves a surface is `mcp` (FR-027), whose
  command takes the surface's own control word (`serve`) and is the only
  command whose second word may be outside FR-008's set. The editor
  (FR-050) is served by the extension, not by a command of the orchestrator;
  the orchestrator needs no `ui` command and no server for it.
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
  the machine's or the clone's own environment, such as a lock, a pin, an
  installed kit or a running server). A command MUST NOT do more than its
  category allows.
- **FR-015**: Every command that writes (every category but `read` and
  `check`) MUST accept `--dry-run`, which validates exactly as the real run
  does, writes nothing, and returns the change it would make as a resource
  (what files, and what would change in each) with exit status 0 when the real
  run would succeed.

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
  (`--html`, used by the editor's webviews and by nothing else). All three
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
  administrator rights (installing a package with the host's package manager)
  MUST NOT be exposed over MCP.
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

- **FR-050**: The editor surface MUST be one VS Code extension, shipped by the
  environment orchestrator and the graphical interface for every
  orchestrator. It MUST hold no behavior of its own: it discovers each trusted
  repository's orchestrator launcher at the repository root, runs
  `<name> command list --json` and `<name> <noun> <verb> ... --json` or
  `--html`, renders the resources they return, and runs a resource's actions
  by invoking the orchestrator, and does nothing else. It MUST show a status
  that says in plain words whether things are well, the orchestrators and their
  audiences, an action as a button with a way to show its command (FR-055), a
  quick-pick for a typed argument (FR-013), a check's findings in the editor's
  problems list, a stream (FR-019) as progress, and an HTML rendering in a
  panel that loads local resources only and runs no script from outside it. It
  MUST be plain JavaScript with no build step, so that the clone is the
  installed extension.
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

- **FR-065**: An orchestrator MAY provide `help [TOPIC]` (read), the one place
  its daily-work documentation lives. A topic MUST be code, in plain language
  (FR-054), and MUST be a resource whose steps are actions (FR-017) the editor
  can run, so that a person can learn by doing in the editor as well as by
  reading in the terminal. No other document MAY restate what a topic says: a
  reference or an overview MUST link to the topic, or MUST be generated from
  the same code and proven current by `fresh` (FR-036), so that documentation
  does not drift from behavior. `help` with no topic MUST list the topics.

## Behavior and information

- **FR-046**: An orchestrator's own configuration MUST be sorted into
  behavior and information. Anything whose change alters what the
  orchestrator does is behavior and MUST be Python code: commands, kits,
  package lists, the versions and hashes of downloads, checks, rules, the
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
  an editor extension's `package.json`, which VS Code owns) MAY be used only
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
  present: the launcher's prerequisites, whether `uv.lock` matches
  `pyproject.toml`, whether each group's packages are in uv's cache (so
  offline runs work), and each group's programs, with hints (FR-006). It MUST
  also check the registry and fail on any conflict: two commands with one
  name; two kits with one name (FR-058); a command in two groups; a type
  declared twice with different meanings; a non-isolated invocation whose plan
  needs two groups (FR-028); a module that declares a command or a kit and
  imports a third-party package at module level (FR-005); and a `uv.lock`
  that does not match `pyproject.toml`. `doctor` MUST change nothing.
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
  command that writes, a check, a build, a decision, a dry run, an installed
  kit, an MCP call that does one of these) MUST go as NDJSON lines to
  untracked logs in a directory the orchestrator's code names, which the
  repository ignores, each line noting the time, the surface (`cli`, `editor`
  or `mcp`), the command, its typed arguments and its exit status. A `read`
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
  names with `--root` (FR-040), and except that an environment orchestrator
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
- **FR-057**: `context` together with `doctor`, with secrets removed, MUST
  form a report a person can paste to a person or to an AI to get help. The
  editor MUST offer it as a "Get help" command (FR-050).

## Kits

- **FR-058**: A kit MUST be a Python module holding a class that subclasses
  the environment orchestrator's kit base, declaring in code: the packages it
  installs with the host's package manager; its fetched downloads, each with a
  name, a version, a URL template, a SHA-256 for each architecture of
  `x86_64` and `aarch64`, and its install steps; and its checks, being the
  programs it provides and functional checks that prove they work (a document
  compiles, an image tool reads and writes a format). A package name MAY
  differ by distribution inside the kit's code. A kit is found by presence in
  the kits package (FR-007), and a kit's module MUST import only the standard
  library at module level (FR-005).
- **FR-059**: An environment orchestrator MUST install a kit with two
  installers only: the host's package manager, through `sudo`, installing what
  the distribution ships and pinning no snapshot; and a fetch, which
  downloads, verifies the SHA-256, unpacks into a versioned directory under
  the person's own data directory, repoints a `current` link atomically, and
  links the binaries into the person's own `bin` directory. It MUST NOT use a
  version manager, a second package system or any other installer. A command
  that needs `sudo` MUST say so before it runs and MUST NOT be offered to an
  agent (FR-022); a person without `sudo` MUST still be able to install the
  parts of a kit that are fetched.
- **FR-060**: An environment orchestrator's `doctor` MUST print the
  distribution and the version of every program each installed kit provides,
  and run each kit's functional checks, so that a difference between two
  machines is visible. A difference in distribution packages between machines
  MUST NOT be treated as a failure.
- **FR-061**: A repository MAY ship kits in `<repo>/.workspaces-host/kits/`,
  following FR-058, and MAY name the kit it needs in
  `<repo>/.workspaces-host/ws-host.env` (FR-062). A kit shipped by a repository
  MUST load only when the person has trusted that repository. Trust MUST be an
  explicit act of the person, MUST NOT be granted by any repository's own file
  or by cloning, MUST NOT pass from a repository to the repositories its file
  lists, and changing it MUST be a `decision` command (FR-014). Trust applies
  to the repository, not to its content: the commit at which it was granted
  MUST be recorded, and `doctor` MUST warn, without blocking, when the
  repository's kits have changed since.
- **FR-062**: Reading a repository's `.workspaces-host/ws-host.env` is reading
  information and MUST need no trust; running that repository's code (its kits,
  or its orchestrator from the editor) MUST need trust (FR-052, FR-061). A
  person's own configuration, and no repository's file, MUST be what names the
  organizations whose repositories are trusted.
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

## Out of scope

- The commands a particular repository's orchestrator has; each repository
  states them in its own spec (the public root's is 0042-agora).
- The environment orchestrator's own commands, layout and paths; the
  repository that holds it states them in its own specs.
- How a command's library code is written, beyond FR-024.
- How AI agents choose which commands to call.

## Edge cases

- A command needs a package and the machine is offline with a cold cache: it
  fails with an error resource naming the package and group, per FR-004 and
  FR-020; it does not fall back to downloading.
- A command needs a program the host lacks: the error resource carries the
  kit or program hint and exit status 3, per FR-006, FR-020 and FR-021.
- An agent asks to accept a proposal over MCP: the call is refused and the
  tool is not listed, per FR-023; the person advances it in the terminal or
  the editor, per FR-039.
- An AI agent inside the editor tries to confirm a `decision` itself: no
  editor command offers it and the confirmation is modal, per FR-051.
- Two sections of one `check` need different dependency groups: each runs in
  its own worker, per FR-028 and FR-031.
- A check runs before its program is installed: the section is skipped, the
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
- Two modules declare a command with one name, or a kit module imports a
  package at module level: `doctor` fails and names both modules, per FR-029.
- A repository's kit needs trust that the person has not given: the kit does
  not load and the orchestrator says so in plain words, per FR-061.
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
- A person with no `sudo` asks for a kit: the fetched parts install and the
  rest is reported in plain words, per FR-059 and FR-056.

## Assumptions

- `uv` is available on the host (0025-tooling-environment FR-013), and a
  Python 3 interpreter with the standard library is present.
- Each repository's orchestrator is used by one person at a time in one
  clone, and Git is the means of sharing and merging work.
- People run on bare metal, on a Debian-family Linux distribution, including
  one under WSL on Windows; other systems and determinism by generated
  containers are for later specs.
- A person works in VS Code; the editor surface is the one graphical
  interface.
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
- **An environment orchestrator** — the orchestrator that prepares a person's
  machine, clones their repositories, installs kits and ships the editor
  extension.
- **The registry** — the commands, nouns, verbs, categories, surfaces,
  dependency groups and arguments the orchestrator's code declares.
- **A resource** — what every command returns: kind, id, audience, data,
  links and actions.
- **A category** — read, check, record, build, generate, decision or setup;
  what a command may do and where it is exposed.
- **A surface** — the terminal, the editor, or MCP.
- **A dependency group** — the commands that share one set of packages in
  `pyproject.toml` and `uv.lock`.
- **A section and a suite** — a named check, and a named set of them.
- **A generator** — a declared source and the tracked files wholly derived
  from it.
- **A proposal** — a tracked, replayable change suggested for a person to
  decide.
- **A kit** — a Python module declaring the packages, downloads and checks
  that make a machine fit for one kind of work.
- **Trust** — a person's explicit act that lets a repository's code run.

## Success criteria

- **SC-001**: A fresh clone runs the orchestrator's `doctor` and its `check`
  with only the host's prerequisites and no setup step.
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
