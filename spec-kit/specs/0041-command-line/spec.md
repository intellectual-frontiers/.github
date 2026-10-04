# Feature Specification: A repository's command line

**Spec ID:** 0041-command-line
**Status:** Draft

**Input:** The rules any Eidolon repository's command line follows, so that
one command line replaces that repository's scattered scripts and every
person, CI job and AI agent reaches its checks, builds and records the same
way. A repository's command line is one launcher and one body of code that
declares its commands in a registry, takes typed arguments, returns every
result as a resource rendered as text, JSON or HTML, reports errors as
resources, exposes each command on the surfaces its category allows (the
terminal, a local web UI, and an MCP server for agents), and never decides
for a person what only a person decides. It obtains its Python packages only
from committed, hashed locks (0025-tooling-environment FR-013), runs offline
on request, and records nothing outside Git. This spec states those rules
for any repository; the public root's command set is 0042-agora.

## The launcher and its dependency plan

- **FR-001**: A repository's command line MUST be one executable launcher at
  the repository root, named for the command line, written in POSIX `sh`,
  that needs only `uv` and a Python 3 interpreter from the host. It MUST run
  from a fresh clone with no step beyond the clone (0025-tooling-environment
  FR-006), from any working directory inside the clone, and MUST find the
  repository from its own location.
- **FR-002**: Every command MUST declare the dependency group it needs, and
  the launcher MUST compute the dependency plan for the requested command
  before running it, from the registry's declarations alone, without
  importing any third-party package. A command that needs no package MUST
  run on the plain standard-library interpreter. A command that needs
  packages MUST run under `uv` against its group's lock, frozen and with
  hash checking, and MUST NOT resolve, upgrade or install anything.
- **FR-003**: The launcher MUST obtain Python packages only as
  0025-tooling-environment FR-013 allows: from a lock committed in the
  repository, with a hash for every distribution, into uv's own cache and an
  environment uv creates for the run, never into an interpreter, virtual
  environment or site-packages the host owns.
- **FR-004**: The command line MUST run offline on request: when the
  environment variable named for the command line with the suffix `_OFFLINE`
  is `1`, or `--offline` is given, it MUST NOT download anything, and a
  command whose plan needs something not already in uv's cache MUST fail
  with an error resource naming the package, its group and the command that
  prepares it while online (FR-020).
- **FR-005**: The command line's core (its registry, parser, typed
  arguments, resources, renderings, errors, dependency plan, logging, UI
  server, MCP server and generated-file machinery) MUST use the Python
  standard library only. A command MAY import a third-party package only
  inside the function that uses it, so that the registry, help, completion
  and every command needing no package run with none installed.
- **FR-006**: A program outside Python that a command needs (a typesetter, a
  browser, an image tool, a Node runtime) MUST come from the host
  (0025-tooling-environment FR-006, FR-007). The command line MUST NOT
  install, download or upgrade one. A group's manifest MUST declare each such
  program, the commands that need it, and a hint naming the workspaces-host-v3
  persona or the program that supplies it, never the reference environment
  itself (0025-tooling-environment FR-012). A command whose program is
  missing MUST fail with an error resource carrying that hint.

## The registry and the grammar

- **FR-007**: A command line MUST keep one registry of its commands, built
  from a root manifest, one manifest per command group, and the commands each
  group's code declares. The manifest is the declaration of the command line's
  prerequisites, packages, programs, check sections, generators, suites and
  per-command tables at their point of use
  (0025-tooling-environment FR-003). The manifest and the lock are named for
  the command line, `<name>.toml` and `<name>.lock`, and a group holds one lock
  only when it pins packages.
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
  noun: `check`, `fresh`, `test`, `doctor`, `lock` and `context`, with the
  arguments FR-031, FR-036, FR-014, FR-030 and FR-038 state. A command line MAY
  omit any of them but MUST NOT add another without amending this spec. A check
  MUST run only through `check`; no `<noun> check` command MAY exist.
- **FR-011**: The surfaces a command line serves are commands under two
  fixed nouns, `ui` (FR-025) and `mcp` (FR-027), whose commands take the
  surface's own control words (`serve`, `open`, `stop`, `link` for `ui`;
  `serve` for `mcp`) and are the only commands whose second word may be
  outside FR-008's set.
- **FR-012**: The registry MUST be readable through the command line itself:
  `command list` and `command show ID` MUST return every declared command and
  its noun, verb, category, arguments, surfaces, dependency group and programs
  as resources. Help and shell completion MUST be derived from the registry,
  never written by hand.

## Typed arguments

- **FR-013**: Every argument a command takes MUST have a declared type, a name
  in capitals (for example a spec, a requirement, a design system, a commit).
  A type MUST define how to validate a value, how to resolve it to a resource,
  and how to complete it. The parser, shell completion, a web UI's forms
  (FR-025) and an MCP tool's input schema (FR-027) MUST all take their
  validation and choices from that one declaration. A value that fails its
  type MUST produce an error resource naming the type and examples of valid
  values.

## Categories

- **FR-014**: Every command MUST declare exactly one category, from these
  seven: `read` (changes nothing); `check` (verifies, and changes nothing
  tracked); `record` (appends a fact to the tracked record); `build` (writes
  derived output); `generate` (rewrites tracked generated files); `decision`
  (changes what only the authority in effect decides, per 0001 FR-029, such
  as a spec's status or an approval); `setup` (changes the clone's own
  environment, such as a lock, a pin or a running server). A command MUST NOT
  do more than its category allows.
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
  written by hand. An action that cannot run now MUST be absent, or present
  and disabled with the reason. The same resource therefore drives the
  terminal's "what next", a web UI's buttons and an agent's tools.
- **FR-018**: A resource MUST have three renderings, and no more: text
  (the default, for people), JSON (`--json`, on every command) and HTML (for
  a web UI). All three MUST be views of the same resource, and MUST NOT differ
  in what they say: nothing may appear in one that the resource does not
  carry. Text MAY omit fields a person does not need; JSON MUST NOT.
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
  argument; 3 for a missing package, program or offline prerequisite
  (FR-004, FR-006).

## Surfaces

- **FR-022**: Every command MUST be callable in the terminal. Each command
  MUST declare which of the other surfaces (the web UI, MCP) expose it, and
  where it declares none the default MUST follow its category: `read`,
  `check`, `record`, `build` and `generate` on both; `decision` on the web UI
  only; `setup` on neither. A command MAY narrow its default, and MAY widen a
  `setup` command to a surface by declaring it, but MUST NOT widen a
  `decision` command to MCP (FR-023).
- **FR-023**: A `decision` command MUST NOT be callable over MCP. The MCP
  server MUST NOT list one, MUST refuse a call that names one, and no
  declaration, option or environment variable MAY change that. An agent that
  wants a decision made records a proposal (FR-039) for a person to decide in
  the terminal or the web UI.
- **FR-024**: Every surface MUST call the same library call as the terminal
  and return the command's own resource. A command's code MUST be thin: it
  parses nothing, renders nothing and keeps no surface-specific logic; its
  rules live in the repository's library code, so that the three surfaces
  cannot disagree.

## The web UI

- **FR-025**: A command line MAY serve local web UIs, each declared in its
  manifest, through `ui serve UI` (run in the foreground), `ui open UI`
  (serve if needed and open a browser), `ui stop UI` and `ui link UI` (print
  the address). A UI MUST run inside the command line's own process, listen
  on the loopback interface only, make no request to any remote host, and need
  no build step. Its pages MUST be the HTML rendering of resources (FR-018).
- **FR-026**: A UI MUST be interactive through Datastar over server-sent
  events: the server sends HTML and signal updates, and the page holds no
  application logic of its own. Datastar MUST be vendored in the repository as
  one file, not fetched. Each interaction MUST call the registry's library
  call for the command (FR-024); a UI action that writes MUST show its
  `--dry-run` result (FR-015) before it runs, and a `decision` action MUST
  require a person's explicit confirmation.

## The MCP server

- **FR-027**: A command line MAY serve MCP through `mcp serve`, over standard
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
  process MUST NOT ever hold two locks: `check` with sections from several
  groups MUST run each section's group in its own worker.
- **FR-029**: `doctor` MUST report what the command line needs and what is
  present: the launcher's prerequisites, each group's lock against its
  manifest's pins, whether the packages are in uv's cache (so offline runs
  work), and each group's programs, with hints (FR-006). It MUST also check
  the registry for conflicts and fail on any: two commands with one name; a
  command in two groups; a type declared twice with different meanings; a
  non-isolated invocation whose plan needs two locks (FR-028); and a manifest
  pin the lock does not match. `doctor` MUST change nothing.
- **FR-030**: `lock [GROUP]` MUST be a `setup` command that writes a group's
  lock from the pins in its manifest, through uv, with a hash for every
  distribution, and MUST refuse to run offline (FR-004). A manifest and a lock
  that disagree MUST fail `doctor` (FR-029).

## Checking

- **FR-031**: Every check MUST run through `check [SECTION...] [--scope ID]
  [--suite SUITE] [--changed]`. A section is a named check a group's manifest
  declares, with the programs it needs (FR-006), the watched paths it depends
  on (FR-032), and the suites it belongs to. A suite is a named set of
  sections, so that a CI job runs one suite and a person runs all. `--scope`
  limits a section that supports it to one resource, as that section's typed
  argument.
- **FR-032**: `check --changed` MUST run only the sections whose declared
  watched paths (path globs in the manifest) contain a file that Git reports
  as changed in the working tree, staged, or untracked, or that differs from
  the commit it is told to compare with. A section that declares no watched
  paths MUST always run. `--changed` MUST list each section it skipped and
  why, and MUST NOT use any rule that is not a declared watched path.
- **FR-033**: A check MUST NOT report a section it did not run as passed. With
  no sections or suite named, `check` MUST run every section, and a section
  whose program is missing (FR-006) MUST be reported as skipped and make the
  exit status non-zero; a suite or a section named explicitly MUST run exactly
  what it names. A check's resource MUST list each section's result, and
  each finding with its location and the action to take next (FR-017). A
  check MUST NOT change any tracked file.
- **FR-034**: A command line MUST carry its own tests, run by `test` with the
  standard library's test runner, unless the group declares packages it needs;
  `test` MUST fail on any failing test and report none it did not run as
  passed.

## Generated files

- **FR-035**: A group MUST declare each generator by name, with the sources it
  reads and the tracked files it writes. A file a generator writes MUST carry
  a header naming the generator and its source, and MUST NOT be edited by
  hand. The `generate` command for the generator's noun rewrites them, with
  `--dry-run` (FR-015).
- **FR-036**: `fresh [GENERATOR...]` MUST regenerate each named generator's
  output (every generator when none is named) outside the working tree and
  compare it with the tracked files, fail on any difference naming the
  generator and the command that rewrites it, and write nothing.
- **FR-037**: The files that tell an AI agent how to use the command line (a
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
- **FR-039**: A proposal MUST be a tracked file in a directory the root
  manifest names, holding an id, the resource it concerns, the reason, and
  the change proposed as a typed action (FR-017) that can be replayed. A
  proposal is open or accepted. Only a `record`, `generate` or `decision`
  command MAY be proposed, and never a proposal command; a proposal is tracked
  because the change it proposes is not worth less than a commit. `proposal list` and `proposal show` MUST be
  `read` commands, `proposal new` a `record` command, and `proposal advance` a
  `decision` command that replays the action (showing its `--dry-run` first,
  FR-015) and marks the proposal accepted. Refusing a proposal is deleting its
  file in a commit.

## Audience and boundaries

- **FR-040**: Every output MUST name its audience: the resource's `audience`
  field and, in text, a line saying so. The audience the root manifest
  declares is stamped on every output. `--root DIR` MAY point a `read` or
  `check` command that declares itself relocatable at another repository,
  checking it with this repository's rules; the output MUST then NOT carry
  this repository's audience, and MUST say `unstated`. A command that writes
  MUST refuse `--root`.
- **FR-041**: Git MUST be the only record. A command that changes the record
  writes tracked files and leaves the commit to a person; no command MAY
  commit, push, tag, or otherwise write to Git. A command MAY read Git's state.
- **FR-042**: What does not warrant a commit but changes or runs something (a
  command that writes, a check, a build, a decision, a dry run, a UI started or
  stopped, an MCP call that does one of these) MUST go as NDJSON lines to
  untracked logs in a directory the root manifest names, which the repository
  ignores, each line noting the time, the surface (terminal, UI or MCP), the
  command, its typed arguments and its exit status. A `read` command, a page
  viewed in a UI and a resource read over MCP change nothing and MUST NOT be
  logged; a refused call to a command that is not `read` (a decision over MCP,
  an invalid argument) MUST be. A log line MUST NOT hold a person's name, a
  secret or file contents. A person's name MUST NOT be written to a tracked
  file except where a command's own data requires it, as a command argument
  that records who.
- **FR-043**: No command MAY call an AI model or service. Agents call the
  command line; the command line never calls them.
- **FR-044**: A command line MUST be built for one user in one clone: it MUST
  NOT lock, queue or reconcile concurrent writers. It MAY refuse to start a
  second UI for the same clone.
- **FR-045**: A repository's command line MUST NOT read, fetch or depend on
  the code or data of another repository, except a repository the person
  names with `--root` (FR-040). It MUST treat the names of repositories as
  data from the ontology or the repository's own register, never as
  literals in its code, specs, documentation or messages.

## Out of scope

- The commands a particular repository's command line has; each repository
  states them in its own spec (the public root's is 0042-agora).
- How a command's library code is written, beyond FR-024.
- How AI agents choose which commands to call.

## Edge cases

- A command needs a package and the machine is offline with a cold cache: it
  fails with an error resource naming the package and group, per FR-004 and
  FR-020; it does not fall back to downloading.
- A command needs a program the host lacks: the error resource carries the
  persona or program hint and exit status 3, per FR-006, FR-020 and FR-021.
- An agent asks to accept a proposal over MCP: the call is refused and the
  tool is not listed, per FR-023; the person advances it in the terminal or
  the web UI, per FR-039.
- Two sections of one `check` need different locks: each runs in its own
  worker, per FR-028 and FR-031.
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

## Assumptions

- `uv` is available on the host (0025-tooling-environment FR-013), and a
  Python 3 interpreter with the standard library is present.
- Each repository's command line is used by one person at a time in one
  clone, and Git is the means of sharing and merging work.
- A person's browser can reach the loopback interface of the machine the web
  UI runs on.

## Open questions

- **OQ-1**: Whether a stream's last line should summarize it, or leave that
  to the consumer.
- **OQ-2**: Whether a web UI's pages should be exportable as static files.

## Key entities

- **The command line** — a repository's launcher and the registry of commands
  behind it.
- **The registry** — the commands, nouns, verbs, categories, surfaces,
  dependency groups and arguments the manifests and the code declare.
- **A resource** — what every command returns: kind, id, audience, data,
  links and actions.
- **A category** — read, check, record, build, generate, decision or setup;
  what a command may do and where it is exposed.
- **A dependency group** — the commands that share one set of locked
  packages.
- **A section and a suite** — a named check, and a named set of them.
- **A generator** — a declared source and the tracked files wholly derived
  from it.
- **A proposal** — a tracked, replayable change suggested for a person to
  decide.

## Success criteria

- **SC-001**: A fresh clone runs the command line's `doctor` and its
  `check` with only the host's prerequisites and no setup step.
- **SC-002**: Every command's three renderings agree, because each is a view
  of the one resource.
- **SC-003**: No `decision` command is reachable over MCP.
- **SC-004**: `fresh` passes on every clone whose generated files are
  unedited.
- **SC-005**: No command commits, pushes, or calls a model.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
