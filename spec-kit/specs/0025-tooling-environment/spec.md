# Feature Specification: Tooling environment

**Spec ID:** 0025-tooling-environment
**Status:** Draft

**Input:** Where the company's own tooling runs, and how it gets what it
needs. Every tool an Eidolon repository holds (a checker, a harness, a
build or publishing script, a CI job) installs itself. The only things a
host has to supply are `python3` and `uv`. The Python packages a tool needs
come from hashed `uv` locks. Every other program a tool needs (a
typesetter, a browser, a Java runtime, a Node runtime's packages) is listed
in the repository's toolchain lock with a version, a download address and a
checksum for each platform; the command line fetches it once into a
per-user cache, verifies it, and uses that copy, never one it happens to find
on the host unless the person says so. The one thing a
fetch cannot supply is a Linux browser's system libraries, which need root: a
documented, one-time `setup` command installs them, with `sudo`, only when a
person runs it. No repository requires a workspace, a container
or any other prepared environment; one MAY exist as a convenience a person
chooses (0026-workspaces). This spec states the host's part, the Python
locks, the toolchain lock, the cache, offline use, the opt-in override,
platform coverage, the exception, and what continuous integration needs.

## Scope

- **FR-001**: This spec MUST govern every tool held in an Eidolon
  repository, the public root and the vault alike: any script, checker,
  harness, build or publishing command, and CI job that the repository
  runs on its own content. A design system's assurance harness is such a
  tool (0014-design-systems FR-015).

## Independence

- **FR-002**: A tool MUST run on any host that supplies the host
  prerequisites (FR-014) and nothing more. It MUST NOT require a reference
  environment (FR-005), a particular operator's machine, a program installed
  on the host, or a path that exists only on one kind of host. A
  host-specific path MAY appear only as an opt-in override (FR-019), never
  as a default or a fallback.
- **FR-003**: A tool MUST declare what it needs (each Python package, each
  toolchain entry, and any version constraint) at its point of use. An
  orchestrator's registry (0041-command-line FR-007) is the declaration at
  the point of use for every command it declares; a standalone harness
  declares it in its own header comment or in the README of the directory
  that holds it.
- **FR-004**: A tool MUST keep what it needs to the fewest that do the job,
  preferring a runtime's standard library to a third-party package. A tool
  MUST NOT install, download or upgrade anything when it runs, except
  Python packages obtained as FR-013 allows and toolchain entries obtained
  as FR-015 through FR-018 allow.

## The reference environment

- **FR-005**: A reference environment, a prepared host such as a release of
  `intellectual-frontiers/workspaces-host`, MAY exist as a convenience a
  person chooses (0026-workspaces). It MUST NOT be required: no tool,
  check, workflow, document or error message of a repository MAY depend on
  it (FR-025).
- **FR-006**: Every tool MUST run unmodified from a fresh clone of the
  repository that holds it on a host that supplies only the host
  prerequisites (FR-014), with no step beyond the clone: no `make install`,
  package install, virtual environment or other setup command. The first
  run of a command MAY fetch what it needs (FR-013, FR-016).
- **FR-007**: A tool that needs a program MUST obtain it as a Python
  package (FR-013) where a package of acceptable fidelity and licence
  exists, and otherwise as a toolchain entry (FR-015). A repository MUST NOT
  close a gap with its own installer, install target, requirements file,
  version manager, package-manager call (FR-021's setup command apart) or
  bootstrap script, and MUST NOT
  tell a person to install a program by hand, except for the one-time setup of
  FR-021.
- **FR-008**: Retired. A repository holds no pin of a reference
  environment; what is pinned is each package and each toolchain entry
  (FR-013, FR-015).
- **FR-009**: Moving a pinned version (a Python package, a toolchain entry,
  or an npm package) MUST be a change of its own, and it MUST regenerate the
  tracked files it affects and pass `fresh` and the checks that use it
  before it merges. A change that replaces a program with another (FR-007)
  MAY change generated files once; they are regenerated and proven in that
  same change (FR-026).
- **FR-010**: Each repository's CI MUST run every tool through the
  repository's launcher, on every push and pull request that changes the
  tool, what it checks, a lock or a toolchain entry. A tool that fails there
  MUST fail CI.
- **FR-011**: Each repository's CI MUST run on a stock runner that has been
  given only a Python and `uv` (the `setup-python` and `setup-uv` actions),
  plus a restored cache of what the launcher has fetched (FR-023). A CI job
  MUST NOT install a program with a package manager, pull an image, or run
  in a container built for the repository, so that FR-002 and FR-006 are
  tested rather than assumed.
- **FR-012**: A reference environment, a workspace, a devcontainer or a
  persona MUST be named only in this spec, in 0026-workspaces, in the
  ontology, in a repository's own files for it (a `.workspaces-host/`
  directory) and in contributor documentation. A tool's code, comments,
  messages and hints MUST NOT name one. A hint for a missing prerequisite
  MUST name only the Python package or the toolchain entry that supplies
  it (0041-command-line FR-006), or, for a maintainer tool, the approved
  host program it runs (0041-command-line FR-071).

## Locked Python packages

- **FR-013**: A repository MAY give its tools one orchestrator that obtains
  the Python packages its commands need on first use, and only those, when
  all of these hold: each package is declared in the repository's
  `pyproject.toml` as a dependency group the command that needs it names
  (0041-command-line FR-002) and pinned to one exact version; the full
  resolution, with a hash for every file of every package, is committed in
  the repository as `uv.lock` and is the only thing installed; the packages
  are obtained only through uv into uv's own cache and an environment uv
  creates for the run, never into an interpreter, virtual environment or
  site-packages the host owns; and the orchestrator can be told to run
  offline, failing with the name of what is missing rather than downloading.
  A package that wraps a native library (an image, PDF or font library) is
  still a package: it comes from a wheel, so that no program is needed on
  the host. `pyproject.toml` and `uv.lock` are the only files of this kind a
  repository MAY keep for Python, because uv owns their format.

## Host prerequisites

- **FR-014**: The host MUST be required to supply `python3` (3.11 or later)
  and `uv`, and nothing else, except for the one-time setup of FR-021. A
  repository MUST NOT document or check for another host program as a
  prerequisite. A launcher MUST need no more than these two to print its
  help, to run `doctor`, and to run any command whose plan needs no
  toolchain entry.

## The toolchain lock

- **FR-015**: Every program a command needs that is not obtainable as a
  Python package (FR-007) MUST be a toolchain entry, declared in the
  orchestrator's code with the rest of its behavior (0041-command-line
  FR-046), and together the entries are the repository's toolchain lock. A
  tree of npm packages is part of the toolchain lock as `package.json` and
  `package-lock.json`, the two files npm owns, every package pinned to one
  exact version with its integrity hash, and installed only with the lock
  (`npm ci`), by the Node runtime that a Python package supplies, never by a
  Node runtime from the host.
- **FR-016**: A toolchain entry MUST declare: its name; its version; for
  each platform it supports, the address (an `https` URL) of one archive and
  that archive's SHA-256; the archive's form; the programs it provides, as
  paths inside the unpacked archive; any other entry it needs; and a
  functional check that proves the program works (a document compiles, a
  file converts, a page loads) rather than that a file exists. An entry
  MUST NOT declare a version range, a floating tag such as `latest`, an
  address that changes over time, or a download step the entry's own code
  runs outside FR-017.
- **FR-017**: The launcher MUST fetch an entry only when a command whose
  plan names it runs, and only once: into a per-user cache directory that
  follows the platform's own convention (the XDG cache directory on Linux),
  never into the clone, the host's program directories or an environment the
  host owns. It MUST verify the archive's SHA-256 before unpacking, unpack
  into a directory named for the entry, version and platform, and make the
  directory visible only when complete, so that an interrupted fetch leaves
  nothing a later run could use. A checksum that does not match MUST delete
  what was fetched and fail with an error resource naming the entry, the
  address, and the expected and the actual checksum. Fetching MUST need no
  administrator rights.
- **FR-018**: The launcher MUST run offline on request
  (0041-command-line FR-004): it MUST then use only what the cache already
  holds, and a command whose plan names an entry the cache lacks MUST fail
  with exit status 3, naming each missing entry, its version and platform,
  and the command that fetches it while online (0041-command-line FR-067).
- **FR-019**: A program found on the host MUST NOT be used in place of a
  toolchain entry or a package unless the person opts in, per entry, by an
  environment variable the launcher's registry names (it names the program
  and holds its path), so that a command's output never depends on the
  machine it ran on. A command running with an override MUST say so in its
  resource, naming the entry and the path; `doctor` MUST list every override
  that is set; and `fresh` MUST NOT report a generator as current while an
  override stands in for a program the generator uses, because the proof
  would be of the host's program, not the locked one.
- **FR-020**: Every entry MUST list the platform `linux-x86_64`, and MUST
  list `linux-aarch64`, `macos-arm64` and `macos-x86_64` where the upstream
  publishes a build for it. A command whose plan names an entry that has no
  build for the host's platform MUST fail with exit status 3, naming the
  entry and the platform, and saying that an override (FR-019) is the way to
  use a program the person has. Windows is served through Linux under WSL.

## The one-time setup: a browser's system libraries

- **FR-021**: A Chromium build the toolchain lock supplies runs on Linux
  only when the host's shared libraries it links against are present, and
  installing them needs administrator rights. The launcher MUST therefore have
  one `setup` command for them (the `system` noun's `add`,
  0041-command-line FR-069), the only command that may run `sudo`. It MUST
  install the package list the repository pins for the host's distribution
  family (the `apt` list on Debian and Ubuntu at least; on any other family it
  MUST say that the family has no list and name the libraries to install by
  hand), MUST print exactly what it will run (`--dry-run` prints it and runs
  nothing) and ask before it runs `sudo`, and MUST never be run implicitly by
  another command. A command that needs the browser MUST find which libraries
  are missing before it starts it and, if any are, fail with exit status 3
  naming each library and that setup command. `doctor` MUST report the same
  with that command as its hint, without failing a command that does not use
  the browser, and the repository's README MUST document it. This is the only
  prerequisite beyond FR-014 that any repository may have, and the only use of
  `sudo`.

## Updating and generated files

- **FR-026**: A generated file whose bytes depend on a program MUST depend
  only on the program's locked version (FR-016) or the package's, never on
  the host, so that `fresh` (0041-command-line FR-036) gives the same answer
  on every host of one platform. A byte-level difference between platforms
  that a program cannot avoid MUST be recorded as an open question in the
  spec of the repository that holds the generator, not hidden by a looser
  comparison.

## Continuous integration

- **FR-022**: A repository's CI MUST NOT contain a step that installs a
  program, a library or a browser with the host's package manager or that
  fetches one outside the launcher (FR-021's setup command apart), and MUST NOT run a job whose purpose is
  to prove a prepared environment. A job that needs a program runs the
  launcher, which fetches the entry as FR-017 states.
- **FR-023**: CI MAY restore and save the cache the launcher fills (uv's
  cache and the toolchain cache) to avoid fetching on every run, with a key
  made from the hashes of the locks and the toolchain entries. A cache MUST
  be an optimization only: a run with an empty cache MUST pass, only slower,
  and the launcher MUST verify what it finds in the cache as FR-017 does.

## What a repository must not require

- **FR-024**: A repository MUST be usable from a clone by following only its
  README's first steps: install `python3` and `uv`, then run the launcher.
  Its contributor documentation MAY then describe a workspace as another
  way to prepare a machine, and MUST NOT make it a step.
- **FR-025**: A repository MUST NOT require a workspace, a reference
  environment, a devcontainer, a persona or a container: no file it holds
  MAY make one a prerequisite, no check MAY fail for lack of one, no error
  or hint MAY tell a person to use one, and no tool MAY read a file that
  exists only for one. A file that exists only for a workspace (a
  `.workspaces-host/` directory) MAY be present and is read only by the
  workspace's own tools.

## Repositories that build on the public root

- **FR-027**: A repository that builds on the public root MUST use the public
  root's toolchain entries and pinned versions for anything both need, and MUST
  obtain them by running the public root's command line (`toolchain show NAME
  --json` and `toolchain add NAME --json`, which return each entry's installed
  `path`, the `env` a consumer sets, the programs it `provides`, its `version`
  and its cache state), so that each program is installed once at one version.
  It MUST NOT declare or download its own copy of an entry the public root
  provides, and declares only what the public root does not provide.
- **FR-028**: The public root's command line MUST expose its pinned Python
  packages and its node version (`toolchain list --json`, in `data.packages`
  and `data.node`), so that another repository can read the pins it shares.
- **FR-029**: A repository that builds on the public root MUST check that every
  pin it shares (a Python package, the node version, a toolchain entry's
  version) equals the public root's, and fail naming each that differs.

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
- Which program, package or build a repository's toolchain lock names: each
  repository's own spec lists them (0042-agora FR-030).

## Edge cases

- A tool that needs a headless browser: the browser is a toolchain entry,
  fetched into the cache and verified, per FR-015 through FR-017; on Linux
  its system libraries are installed once by the documented `setup` command,
  which a person runs and which asks before `sudo`, per FR-021.
- A tool that needs a typesetting toolchain: it is a toolchain entry named
  by the commands that need it, not a program found on the host, per FR-007
  and FR-015.
- A program with a PyPI wheel, such as an image or PDF library: it is a
  locked package and needs no entry, per FR-007 and FR-013.
- A host that already has the program on its `PATH`: it is not used, per
  FR-019, unless the person sets the override the registry names; the
  resource then says it ran with an override, per FR-019.
- A machine with no network and a warm cache: `--offline` runs, per FR-018;
  with a cold cache the command fails naming each missing entry, per FR-018.
- A fetched archive whose checksum differs from the entry's: it is deleted
  and the command fails naming both checksums, per FR-017.
- An interrupted fetch: the cache directory is not visible until complete,
  so the next run fetches again, per FR-017.
- A platform with no build of an entry (macOS arm64 for a program upstream
  only builds for Linux): the command fails with exit 3 naming entry and
  platform, per FR-020.
- A pinned version moved to a newer one: it is a change of its own that
  regenerates and passes `fresh`, per FR-009.
- A program replaced by a Python package that renders slightly differently:
  the affected generated files change once in the same change and `fresh`
  proves them, per FR-009 and FR-026.
- CI with an empty cache: it passes, only slower, per FR-023.
- A repository that still has a devcontainer or a `.workspaces-host/`
  directory: allowed as a convenience and read by nothing of the
  repository's own, per FR-025.
- A host that lacks a library Chromium links against: the browser is not
  started, exit status 3 names each library and the setup command, and
  nothing is installed by the failing command, per FR-021.
- A host of a distribution family with no pinned list: the setup command says
  so and names the libraries, per FR-021.
- The setup command run with `--dry-run`: it prints the `sudo` commands and
  runs nothing, per FR-021.
- Two machines of one platform: the same locked versions give the same
  generated files, per FR-026.

## Assumptions

- `python3` 3.11 or later and `uv` can be installed by a person on every
  host the tools run on, without the repository's help.
- The addresses that toolchain entries name stay reachable and keep the
  archives they served when the checksum was recorded; where one does not,
  the entry is changed as FR-009 states.
- A stock CI runner of the provider in use can run `setup-python` and
  `setup-uv`.
- Simplicity is chosen over determinism of the whole machine: where every
  system library must be fixed, a later spec generates a container.

## Open questions

- **OQ-1**: Whether a stock CI runner already holds the shared libraries a
  Chromium build links against; if it does not, the CI job runs the
  setup command of FR-021, the one place `sudo` is allowed there, and this is
  recorded here.
- **OQ-2**: How the toolchain lock covers macOS: which entries upstream
  builds for `macos-arm64` and `macos-x86_64`, and which commands then fail
  there under FR-020.

## Key entities

- **A tool** — a script, checker, harness, build or publishing command,
  or CI job an Eidolon repository runs on its own content.
- **A host prerequisite** — `python3` and `uv`, the two things a host
  supplies (FR-014).
- **A lock** — a repository's committed `uv.lock`, the hashed resolution of
  the Python packages its commands declare (FR-013).
- **A toolchain entry** — a program a command needs that has no wheel: name,
  version, an address and checksum per platform, what it provides, and a
  functional check (FR-016).
- **The toolchain lock** — the repository's toolchain entries and its npm
  lock (FR-015).
- **The cache** — the per-user directory the launcher fetches entries into
  and verifies them in (FR-017).
- **An override** — a person's explicit, per-entry use of a host program
  (FR-019).
- **A reference environment** — a prepared host a person MAY choose, never
  required (FR-005).

## Success criteria

- **SC-001**: Every tool in every Eidolon repository passes on a stock host
  that has only `python3` and `uv`, with a cold cache and a network.
- **SC-002**: Every tool that needs no toolchain entry passes with no
  network and a warm `uv` cache.
- **SC-003**: No tool in any Eidolon repository installs or downloads
  anything when it runs except locked packages and verified toolchain
  entries.
- **SC-004**: No repository's tools, checks, workflows or hints require a
  workspace, a reference environment or a container.
- **SC-005**: A generated file is the same on every host of one platform.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
