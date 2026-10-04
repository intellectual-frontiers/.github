# Feature Specification: Tooling environment

**Spec ID:** 0025-tooling-environment
**Status:** Draft

**Input:** Where the company's own tooling is expected to run. Every
tool an Eidolon repository holds (a checker, a harness, a build or
publishing script, a CI job) stays as independent of any one host as it
can, so anyone can run it with only what it declares. By default, every
tool is also guaranteed to run in one reference environment,
`intellectual-frontiers/workspaces-host-v3`, so that an operator or an
AI agent working there never has to install anything to use it. This
spec states both halves, how the guarantee is pinned and checked, and
what happens when a tool needs something the reference environment
lacks. How people enter the reference environment, in which flavor, is
0026-workspaces.

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
  workspaces-host-v3 persona it does not declare, or a path that exists
  only on one kind of host. A host-specific path MAY appear only as a
  fallback, after an environment-variable override and the runtime's own
  lookup have been tried.
- **FR-003**: A tool MUST declare its prerequisites (each runtime,
  binary, or module it needs, and any version constraint) at its point
  of use: in its own header comment, or in the README of the directory
  that holds it.
- **FR-004**: A tool MUST keep its prerequisites to the fewest that do
  the job, preferring a runtime's standard library to a third-party
  package. A tool MUST NOT install, download, or upgrade a prerequisite
  when it runs, except Python packages obtained as FR-013 allows.
  Installing prerequisites belongs to the host: to the
  reference environment, or to a CI job that stands in for some other
  host (FR-011).

## The reference environment

- **FR-005**: The reference environment for tooling MUST be
  `intellectual-frontiers/workspaces-host-v3`, built from its flake at
  the commit pinned under FR-008, with the personas the repository's
  devcontainer names (0026-workspaces FR-004), in any of its flavors
  (0026-workspaces FR-001).
- **FR-006**: Every tool MUST run unmodified in the reference
  environment from a fresh clone of the repository that holds it, with
  no step beyond the clone: no `make install`, package install, virtual
  environment, or other setup command. Every prerequisite a tool
  declares MUST be supplied by the reference environment, except Python
  packages obtained as FR-013 allows.
- **FR-007**: A tool that needs a prerequisite the reference environment
  lacks MUST either use a workspaces-host-v3 persona that supplies it,
  named by the repository's devcontainer (0026-workspaces FR-004), or
  wait until the prerequisite is added to workspaces-host-v3 under that
  repository's own specs. A repository MUST NOT close the gap itself
  with its own installer, install target, requirements file, version
  manager, or bootstrap script. A command line obtaining locked Python
  packages under FR-013 is not such an installer.
- **FR-008**: Each repository holding tools MUST pin the reference
  environment in exactly one place, `tools/reference-environment`: a
  single line holding a Nix flake reference to
  `github:intellectual-frontiers/workspaces-host-v3` at a full 40-hex
  commit for which workspaces-host-v3 has published its images, tagged
  `sha-` and the commit's first seven hex digits. The repository's
  `.devcontainer/` files MAY name that image tag and MUST match the pin;
  no other file in the repository MAY name a reference environment
  commit.
- **FR-009**: Moving the pin to a newer commit MUST be a change of its
  own, and it MUST pass FR-010's run before it merges.
- **FR-010**: Each repository's CI MUST run every tool inside the
  reference environment's published container image at the pinned
  commit's tag, the same image the repository's devcontainer names, on
  every push and pull request that changes the tool, what it checks, or
  the pin. A tool that fails there MUST fail CI.
- **FR-011**: Each repository's CI MUST also run every tool at least
  once outside the reference environment, on a host given only the
  tool's declared prerequisites, so that FR-002 and FR-003 are tested
  rather than assumed.
- **FR-012**: The reference environment MUST be named only in this spec,
  in 0026-workspaces, in the ontology (`ifcore:ReferenceEnvironment`),
  in the pin file (FR-008), in each repository's `.devcontainer/` files,
  and in contributor documentation. A tool's own code and comments MUST
  NOT name it. When a successor to workspaces-host-v3 is adopted, these
  change; no tool does.

## Locked Python packages

- **FR-013**: A repository MAY give its tools one command line that
  obtains the Python packages its commands need on first use, and only
  those, when all of these hold: each package is declared at the command
  or command group that needs it (FR-003) and pinned to one exact
  version; the full resolution is committed in the repository as a lock
  with a hash for every distribution; the packages are obtained only
  through uv, which the reference environment supplies, into uv's own
  cache and an environment uv creates for the run, never into an
  interpreter, virtual environment or site-packages the host owns; and
  the command line can be told to run offline, failing with the name of
  what is missing rather than downloading. This is the one exception to
  FR-004, FR-006 and FR-007, and it covers Python packages only: a
  program outside Python (a typesetter, a browser, a Java runtime) MUST
  still come from the host, per FR-006 and FR-007.

## Out of scope

- What workspaces-host-v3 contains and how it is built. Its own
  constitution and specs govern that.
- Works shipped to someone else's environment: a skill or MCP tool a
  reader's AI runs (0009-press FR-016, 0016-press-production FR-039), or
  a design system a consumer vendors (0014-design-systems). Their
  portability is stated by the specs that govern them.
- Which CI provider runs FR-010 and FR-011.

## Edge cases

- A tool that needs a headless browser: the browser is a declared
  prerequisite, found through an environment override first, then
  Playwright's own lookup, then a fallback path, per FR-002 and FR-003;
  the reference environment supplies it, per FR-006.
- A tool needed by only one kind of work, such as a typesetting
  toolchain: it names the workspaces-host-v3 persona that supplies it,
  per FR-007, rather than growing the base profile.
- A prerequisite workspaces-host-v3 does not yet carry: the tool waits
  for it, or names a persona that carries it, per FR-007; the repository
  does not add an installer.
- A CI job outside the reference environment that installs a
  prerequisite with a package manager: allowed, because that job stands
  in for some other host under FR-011; the tool itself still installs
  nothing, per FR-004.
- A newer workspaces-host-v3 commit that breaks a tool: the pin does not
  move until FR-010's run passes, per FR-009.
- A workspaces-host-v3 commit that changed nothing in the environment, so
  no image was published for it: it cannot be pinned; the pin names the
  latest commit with published images, per FR-008.
- A repository that used to install its prerequisites with `make
  install`: the install targets and requirements file are removed, and
  each prerequisite moves into workspaces-host-v3's base profile or a
  persona, per FR-006 and FR-007, or, for a Python package, into a lock,
  per FR-013.
- A repository whose command line fetches its Python packages from a
  committed, hashed lock through uv: allowed, per FR-013; its typesetter
  and browser still come from the reference environment's personas, per
  FR-007.
- An environment variable a tool relies on that the reference
  environment sets only for a login shell: CI and devcontainers enter
  the environment through a login shell, so the tool needs no override,
  per FR-006 and FR-010.
- workspaces-host-v3 is superseded by a successor: this spec, the
  ontology individual, and the pin files change together, per FR-012.

## Assumptions

- workspaces-host-v3's base profile can be built and entered on a CI
  runner without a persistent host.
- The tools in scope run on Linux and macOS; nothing here asks a tool to
  run natively on Windows outside WSL.

## Open questions

None.

## Key entities

- **A tool** — a script, checker, harness, build or publishing command,
  or CI job an Eidolon repository runs on its own content.
- **A prerequisite** — a runtime, binary, or module a tool needs and
  declares.
- **The reference environment** — workspaces-host-v3 with the personas a
  repository names, in any flavor, where every tool is guaranteed to
  run.
- **The pin** — the one commit of the reference environment a repository
  is guaranteed against, in `tools/reference-environment`.
- **A lock** — a repository's committed, hashed resolution of the Python
  packages its commands declare (FR-013).

## Success criteria

- **SC-001**: Every tool in every Eidolon repository passes in the
  reference environment at its repository's pinned commit.
- **SC-002**: Every tool passes at least once outside the reference
  environment with only its declared prerequisites.
- **SC-003**: No tool in any Eidolon repository installs or downloads a
  prerequisite when it runs, except Python packages obtained from a
  committed, hashed lock under FR-013.
- **SC-004**: Replacing the reference environment changes no tool's code.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
