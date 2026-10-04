# Feature Specification: Tooling environment

**Spec ID:** 0025-tooling-environment
**Status:** Draft

**Input:** Where the company's own tooling is expected to run. Every
tool an Eidolon repository holds (a checker, a harness, a build or
publishing script, a CI job) stays as independent of any one host as it
can, so anyone can run it with only what it declares. By default, every
tool is also guaranteed to run in one reference environment: a release of
`intellectual-frontiers/workspaces-host` on a Debian-family Linux host,
with the kit the repository declares, so that an operator or an AI agent
working there installs nothing by hand to use it. This spec states both
halves, how the guarantee is pinned and checked, and what happens when a
tool needs something the reference environment lacks. How people enter the
reference environment is 0026-workspaces. Running the same environment in a
generated container, for the cases that need every package version fixed, is
a later spec; machines may differ in the versions their distribution ships.

## Scope

- **FR-001**: This spec MUST govern every tool held in an Eidolon
  repository, the public root and the vault alike: any script, checker,
  harness, build or publishing command, and CI job that the repository
  runs on its own content. A design system's assurance harness is such a
  tool (0014-design-systems FR-015).

## Independence

- **FR-002**: A tool MUST run on any host that supplies the
  prerequisites it declares (FR-003). It MUST NOT require the reference
  environment (FR-005), a particular operator's machine, a
  kit it does not declare, or a path that exists
  only on one kind of host. A host-specific path MAY appear only as a
  fallback, after an environment-variable override and the runtime's own
  lookup have been tried.
- **FR-003**: A tool MUST declare its prerequisites (each runtime,
  binary, or module it needs, and any version constraint) at its point
  of use: in its own header comment, or in the README of the directory
  that holds it. An orchestrator's registry (0041-command-line FR-007) is
  the declaration at the point of use for every command it declares.
- **FR-004**: A tool MUST keep its prerequisites to the fewest that do
  the job, preferring a runtime's standard library to a third-party
  package. A tool MUST NOT install, download, or upgrade a prerequisite
  when it runs, except Python packages obtained as FR-013 allows.
  Installing prerequisites belongs to the host: to the
  reference environment, or to a CI job that stands in for some other
  host (FR-011).

## The reference environment

- **FR-005**: The reference environment for tooling MUST be a release of
  `intellectual-frontiers/workspaces-host` on a Debian-family Linux host (bare
  metal, including Ubuntu under WSL on Windows), with the kit the
  repository declares in `.workspaces-host/ws-host.env` installed by
  `ws-host kit add` (0026-workspaces FR-016).
- **FR-006**: Every tool MUST run unmodified in the reference
  environment from a fresh clone of the repository that holds it, with
  no step beyond the clone: no `make install`, package install, virtual
  environment, or other setup command. Every prerequisite a tool
  declares MUST be supplied by the reference environment, except Python
  packages obtained as FR-013 allows.
- **FR-007**: A tool that needs a prerequisite the reference environment
  lacks MUST either use a kit that supplies it, named by the repository's
  `.workspaces-host/ws-host.env` (0026-workspaces FR-016), or wait until the
  prerequisite is added to workspaces-host under that repository's own specs.
  A repository MUST NOT close the gap itself with its own installer, install
  target, requirements file, version manager, or bootstrap script. An
  orchestrator obtaining locked Python packages under FR-013 is not such an
  installer.
- **FR-008**: A repository holding tools MAY pin the reference environment in
  exactly one place, the `WS_HOST_VERSION` line of its
  `.workspaces-host/ws-host.env`, naming a release of workspaces-host. A
  repository that holds no pin runs the current release. No other file in the
  repository MAY name a reference environment version.
- **FR-009**: Moving the pin to a newer release MUST be a change of its
  own, and it MUST pass FR-010's run before it merges.
- **FR-010**: Each repository's CI MUST run every tool in the reference
  environment, on a runner prepared with workspaces-host's `install.sh` and
  `ws-host kit add` for the repository's kit, at the pinned release where there
  is a pin, on every push and pull request that changes the tool, what it
  checks, or the pin. A tool that fails there MUST fail CI.
- **FR-011**: Each repository's CI MUST also run every tool at least
  once outside the reference environment, on a host given only the
  tool's declared prerequisites, so that FR-002 and FR-003 are tested
  rather than assumed.
- **FR-012**: The reference environment MUST be named only in this spec,
  in 0026-workspaces, in the ontology (`ifcore:ReferenceEnvironment`),
  in a repository's `.workspaces-host/` files, and in contributor
  documentation. A tool's own code and comments MUST NOT name it. A hint a
  tool gives for a missing prerequisite MUST name only the kit or the program
  that supplies it (0041-command-line FR-006), never the reference
  environment. When a successor to workspaces-host is adopted, these change;
  no tool does.

## Locked Python packages

- **FR-013**: A repository MAY give its tools one orchestrator that obtains
  the Python packages its commands need on first use, and only those, when all
  of these hold: each package is declared in the repository's `pyproject.toml`
  as a dependency group the command that needs it names
  (0041-command-line FR-002) and pinned to one exact version; the full
  resolution is committed in the repository as `uv.lock`; the packages are
  obtained only through uv, which the reference environment supplies, into
  uv's own cache and an environment uv creates for the run, never into an
  interpreter, virtual environment or site-packages the host owns; and the
  orchestrator can be told to run offline, failing with the name of what is
  missing rather than downloading. `pyproject.toml` and `uv.lock` are the
  only files of this kind a repository MAY keep, because uv owns their
  format. This is the one exception to FR-004, FR-006 and FR-007, and it
  covers Python packages only: a program outside Python (a typesetter, a
  browser, a Java runtime) MUST still come from the host, per FR-006 and
  FR-007.

## Out of scope

- What workspaces-host contains and how it is built. Its own constitution and
  specs govern that.
- Generated devcontainers and container images, for when every package
  version must be fixed; a later spec states them.
- Works shipped to someone else's environment: a skill or MCP tool a
  reader's AI runs (0009-press FR-016, 0016-press-production FR-039), or
  a design system a consumer vendors (0014-design-systems). Their
  portability is stated by the specs that govern them.
- Which CI provider runs FR-010 and FR-011.

## Edge cases

- A tool that needs a headless browser: the browser is a declared
  prerequisite, found through an environment override first, then
  Playwright's own lookup, then a fallback path, per FR-002 and FR-003;
  the reference environment supplies it through the `base` kit, per FR-006.
- A tool needed by only one kind of work, such as a typesetting
  toolchain: it names the kit that supplies it, per FR-007, rather than
  growing the base kit.
- A prerequisite workspaces-host does not yet carry: the tool waits
  for it, or names a kit that carries it, per FR-007; the repository
  does not add an installer.
- A CI job outside the reference environment that installs a
  prerequisite with a package manager: allowed, because that job stands
  in for some other host under FR-011; the tool itself still installs
  nothing, per FR-004.
- A newer workspaces-host release that breaks a tool: the pin does not
  move until FR-010's run passes, per FR-009.
- A repository with no pin: it runs the current release, and a release that
  breaks a tool is found by FR-010's run, per FR-008 and FR-010.
- A repository that installs its prerequisites with `make install`: the
  install targets and requirements file are removed, and each prerequisite
  moves into workspaces-host's base kit or another kit, per FR-006 and
  FR-007, or, for a Python package, into `uv.lock`, per FR-013.
- An orchestrator whose registry declares each group's packages and
  programs in code: the registry is the declaration at the point of use, per
  FR-003, and a group's hint names a kit or a program, per FR-012.
- A repository whose orchestrator fetches its Python packages from a
  committed `uv.lock` through uv: allowed, per FR-013; its typesetter
  and browser still come from the reference environment's kits, per
  FR-007.
- Two machines whose distributions ship different versions of a package: not
  a failure; `doctor` prints the versions so the difference is visible, per
  FR-002 and 0041-command-line FR-060.
- workspaces-host is superseded by a successor: this spec, the ontology
  individual, and the repositories' `.workspaces-host/` files change
  together, per FR-012.

## Assumptions

- workspaces-host's kits can be installed on a CI runner running a
  Debian-family distribution, with `sudo`.
- The tools in scope run on a Debian-family Linux distribution, including
  Ubuntu under WSL on Windows; other systems are for later specs.
- Simplicity is chosen over determinism: where every package version must be
  fixed, a later spec generates a container from the same kits.

## Open questions

- **OQ-1**: CI currently runs the tools inside the published image of the
  earlier reference environment, `workspaces-host-v3`, which stays published
  until workspaces-host's first release ships. Once it does, CI moves to
  GitHub's Ubuntu runners running `install.sh` and `ws-host kit add` for the
  repository's kit, and each repository's `tools/reference-environment` and
  `.devcontainer/` files are removed (FR-008, FR-010).

## Key entities

- **A tool** — a script, checker, harness, build or publishing command,
  or CI job an Eidolon repository runs on its own content.
- **A prerequisite** — a runtime, binary, or module a tool needs and
  declares.
- **The reference environment** — a release of workspaces-host on a
  Debian-family host with the kit a repository declares, where every tool is
  guaranteed to run.
- **A kit** — what makes a machine fit for one kind of work
  (0041-command-line FR-058).
- **The pin** — the release of the reference environment a repository is
  guaranteed against, the `WS_HOST_VERSION` line of its
  `.workspaces-host/ws-host.env`, where a repository pins one.
- **A lock** — a repository's committed `uv.lock`, the resolution of the
  Python packages its commands declare (FR-013).

## Success criteria

- **SC-001**: Every tool in every Eidolon repository passes in the
  reference environment, at its repository's pinned release where it has one.
- **SC-002**: Every tool passes at least once outside the reference
  environment with only its declared prerequisites.
- **SC-003**: No tool in any Eidolon repository installs or downloads a
  prerequisite when it runs, except Python packages obtained from the
  committed `uv.lock` under FR-013.
- **SC-004**: Replacing the reference environment changes no tool's code.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
