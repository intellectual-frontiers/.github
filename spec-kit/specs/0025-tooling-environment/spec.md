# Feature Specification: Tooling environment

**Spec ID:** 0025-tooling-environment
**Status:** Draft

**Input:** Where the company's own tooling runs, and how it gets what it
needs. Every tool an Eidolon repository holds (a checker, a harness, a
build or publishing script, a CI job) installs itself. The one thing a host
has to supply is `ws-host`, the workspaces orchestrator (workspaces-host): it brings its own `mise`, and from it Python, `uv` and every
program a repository pins. A repository declares what it needs in a
`.workspaces-host/` folder of small TOML files and ships a launcher that
`ws-host` runs in the repository's own environment. The Python packages a tool
needs come from hashed `uv` locks. Every other program a tool needs (a
typesetter, a browser, a Java runtime, a Node runtime and its packages) is an
entry of the repository's toolchain with a version, a download address and a
checksum for each platform; `ws-host` fetches it once into one store, verifies
it, and the tool uses that copy, never one it happens to find on the host. The
one thing a fetch cannot supply is a Linux browser's system libraries, which
need root: `ws-host system ensure` installs them, with `sudo`, only when a
person runs it. No repository requires a container or any other prepared
environment. Linux is the platform; macOS and Windows are served by WSL, a
virtual machine or a container that runs Linux. This spec states the host's
part, the Python locks, the toolchain, the store, offline use, platform
coverage, the exception, and what continuous integration needs.

## Scope

- **FR-001**: This spec MUST govern every tool held in an Eidolon
  repository, the public root and the vault alike: any script, checker,
  harness, build or publishing command, and CI job that the repository
  runs on its own content. A design system's assurance harness is such a
  tool (0014-design-systems FR-015).

## Independence

- **FR-002**: A tool MUST run on any host that supplies the host
  prerequisite (FR-014) and nothing more. It MUST NOT require a particular
  operator's machine, a program installed on the host, or a path that exists
  only on one kind of host.
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

## The prerequisite

- **FR-005**: `ws-host` is the one prerequisite of every Eidolon repository's
  tools (FR-014). It is public, installed by one documented command, and
  independent of any repository that depends on it. No other prepared
  environment is required: no container, no devcontainer and no persona.
- **FR-006**: Every tool MUST run unmodified from a fresh clone of the
  repository that holds it on a host that supplies only `ws-host` and has
  enabled the clone as a provider (`ws-host provider add`, which only a person
  can do, so that a repository cannot enable itself), with no other step: no
  `make install`, package install, virtual environment or other setup command.
  The first run of a command MAY fetch what it needs (FR-013, FR-016).
- **FR-007**: A tool that needs a program MUST obtain it as a Python
  package (FR-013) where a package of acceptable fidelity and licence
  exists, and otherwise as a toolchain entry (FR-015). A repository MUST NOT
  close a gap with its own installer, install target, requirements file,
  version manager, package-manager call (FR-021's setup command apart) or
  bootstrap script, and MUST NOT tell a person to install a program by hand,
  except for the one-time setup of FR-021.
- **FR-008**: Retired. A repository holds no pin of a prepared
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
  given only `ws-host`, plus a restored cache of what it has fetched (FR-023).
  A CI job MUST NOT install a program with a package manager, pull an image,
  or run in a container built for the repository, so that FR-002 and FR-006 are
  tested rather than assumed.
- **FR-012**: A hint for a missing prerequisite MUST name only `ws-host` and
  the command that fixes it, the Python package or the toolchain entry that
  supplies the program (0041-command-line FR-006), or, for a maintainer tool,
  the approved host program it runs (0041-command-line FR-071). A tool MUST NOT
  name a container, a devcontainer or a persona as a requirement.

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

- **FR-014**: The host MUST be required to supply `ws-host` and nothing else,
  except for the one-time setup of FR-021. A repository MUST NOT document or
  check for another host program as a prerequisite. A launcher MUST need no
  more than `ws-host` to print its help, to run `doctor`, and to run any
  command whose plan needs no toolchain entry beyond the Python and `uv` that
  `ws-host` supplies to every launcher it runs.

## The toolchain lock

- **FR-015**: Every program a command needs that is not obtainable as a
  Python package (FR-007) MUST be a toolchain entry, declared as data in the
  repository's `.workspaces-host/toolchain.d/` (workspaces-host reads them as data), and together the entries are the repository's
  toolchain. A tree of npm packages is an entry too: the exact package version,
  with the dependency lock `mise` writes beside it, every package with its
  integrity hash, installed only from that lock by a Node entry the repository
  pins, never by a Node runtime from the host.
- **FR-016**: A toolchain entry MUST declare: its name; its exact version; for each platform it supports, the
  address (an `https` URL) of one archive and that archive's SHA-256; the
  programs it provides, as paths inside the unpacked archive; any other entry it
  needs; and the repository's own functional check of it, in its orchestrator's
  code, that proves the program works (a document compiles, a file converts, a
  page loads) rather than that a file exists. An entry MUST NOT declare a
  version range, a floating tag such as `latest`, or an address that changes
  over time.
- **FR-017**: `ws-host` fetches an entry only when a command whose plan names
  it runs, or when a person asks, and only once: into its one store under the
  XDG data directory, never into the clone, the host's program directories or an
  environment the host owns. It verifies the archive's SHA-256 before
  unpacking, and a checksum that does not match installs nothing and fails with
  an error that names the entry. Fetching needs no administrator rights.
- **FR-018**: A launcher MUST run offline on request (0041-command-line
  FR-004): `ws-host` then uses only what the store already holds, and a command
  whose plan names an entry the store lacks MUST fail with exit status 3,
  naming each missing entry and its version, and the command that fetches it
  while online (0041-command-line FR-067).
- **FR-019**: A program found on the host MUST NOT be used in place of a
  toolchain entry or a package, and there is no override, so that a command's
  output never depends on the machine it ran on. Programs a person installs for
  their own use (a package manager's, an environment loader) are theirs and
  `ws-host` neither installs nor configures them.
- **FR-020**: Every entry MUST list the platform `linux-x64`, and MUST list
  `linux-arm64` where the upstream publishes a build for it. A command whose
  plan names an entry that has no build for the host's platform MUST fail with
  exit status 3, naming the entry and the platform. macOS and Windows are served
  through Linux, in WSL, a virtual machine or a container.

## The one-time setup: a browser's system libraries

- **FR-021**: A Chromium build the toolchain supplies runs on Linux only when
  the host's shared libraries it links against are present, and installing them
  needs administrator rights. `ws-host system ensure`
  is therefore the one setup command for them, and the only command that may run
  `sudo`: the entry lists the packages for the Debian family in its `system`
  key, the command prints exactly what it will run (`--dry-run` prints it and
  runs nothing), asks before it runs `sudo`, and is never run implicitly by
  another command. A command that needs the browser MUST, if the browser cannot
  start for want of a library, fail with exit status 3 naming that command.
  `ws-host doctor` MUST report the same without failing a command that does not
  use the browser, and the repository's README MUST document it. This is the
  only prerequisite beyond FR-014 that any repository may have, and the only
  use of `sudo`.

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
  fetches one outside `ws-host` (FR-021's setup command apart), and MUST NOT
  run a job whose purpose is to prove a prepared environment. A job that needs
  a program runs the launcher, which has `ws-host` fetch the entry as FR-017
  states.
- **FR-023**: CI MAY restore and save the store `ws-host` fills and uv's
  cache to avoid fetching on every run, with a key made from the hashes of the
  locks and the toolchain entries. A cache MUST be an optimization only: a run
  with an empty cache MUST pass, only slower, and `ws-host` MUST verify what it
  finds in the store as FR-017 does.

## What a repository must not require

- **FR-024**: A repository MUST be usable from a clone by following only its
  README's first steps: install `ws-host`, enable the clone as a provider, then
  run the launcher.
- **FR-025**: A repository MUST NOT require a container, a devcontainer or a
  persona: no file it holds MAY make one a prerequisite, no check MAY fail for
  lack of one, and no error or hint MAY tell a person to use one.

## Repositories that build on one another

- **FR-027**: Each repository that is a provider declares its own entries. A
  program that two providers pin at the same name and version is installed once
  in the store; two providers MUST NOT declare one name and version with
  different addresses or checksums, and `ws-host` refuses to enable the second
  so that no provider changes what another's pin
  means. A repository that builds on another MUST NOT copy its entries.
- **FR-028**: Retired. What a provider pins is read with `ws-host provider show`, not from another repository's command line.
- **FR-029**: Retired. Two providers' pins are independent and identical ones
  share one copy in the store (FR-027).

## Out of scope

- What workspaces-host contains and how it is built. Its own specs govern that
  (its own specifications are the format of the declarations).
- Generated devcontainers and container images, for when every package
  version must be fixed; a later spec states them.
- Works shipped to someone else's environment: a skill or MCP tool a
  reader's AI runs (0009-press FR-016, 0016-press-production FR-039), or
  a design system a consumer vendors (0014-design-systems). Their
  portability is stated by the specs that govern them.
- Which CI provider runs FR-010 and FR-011.
- Which program, package or build a repository's toolchain names: each
  repository's own spec lists them (0042-agora FR-030).

## Edge cases

- A tool that needs a headless browser: the browser is a toolchain entry,
  fetched into the store and verified, per FR-015 through FR-017; on Linux its
  system libraries are installed once by `ws-host system ensure`, which a person
  runs and which asks before `sudo`, per FR-021.
- A tool that needs a typesetting toolchain: it is a toolchain entry named by
  the commands that need it, not a program found on the host, per FR-007 and
  FR-015.
- A program with a PyPI wheel, such as an image or PDF library: it is a locked
  package and needs no entry, per FR-007 and FR-013.
- A host that already has the program on its `PATH`: it is not used, per FR-019.
- A machine with no network and a warm store: `--offline` runs, per FR-018;
  with a cold store the command fails naming each missing entry, per FR-018.
- A fetched archive whose checksum differs from the entry's: nothing is
  installed and the command fails naming the entry, per FR-017.
- A platform with no build of an entry: the command fails with exit 3 naming
  entry and platform, per FR-020.
- A pinned version moved to a newer one: it is a change of its own that
  regenerates and passes `fresh`, per FR-009.
- A program replaced by a Python package that renders slightly differently: the
  affected generated files change once in the same change and `fresh` proves
  them, per FR-009 and FR-026.
- CI with an empty cache: it passes, only slower, per FR-023.
- A repository that has not been enabled as a provider: its launcher exits 3
  naming `ws-host provider add`, per FR-006.
- A host that lacks a library Chromium links against: the browser is not
  started, exit status 3 names the setup command, and nothing is installed by
  the failing command, per FR-021.
- Two providers pinning one program at one version: one copy in the store, per
  FR-027.
- Two machines of one platform: the same locked versions give the same
  generated files, per FR-026.

## Assumptions

- `ws-host` can be installed by a person on every host the tools run on, by
  one documented command.
- The addresses that toolchain entries name stay reachable and keep the
  archives they served when the checksum was recorded; where one does not, the
  entry is changed as FR-009 states.
- A stock CI runner of the provider in use can install `ws-host`.
- Simplicity is chosen over determinism of the whole machine: where every
  system library must be fixed, a later spec generates a container.

## Open questions

- **OQ-1**: Whether a stock CI runner already holds the shared libraries a
  Chromium build links against; if it does not, the CI job runs the setup
  command of FR-021, the one place `sudo` is allowed there, and this is recorded
  here.

## Key entities

- **A tool** — a script, checker, harness, build or publishing command, or CI
  job an Eidolon repository runs on its own content.
- **The host prerequisite** — `ws-host`, the one thing a host supplies (FR-014).
- **A provider** — a repository with `.workspaces-host/provider.toml` and a
  launcher, enabled by a person (FR-006).
- **A lock** — a repository's committed `uv.lock`, the hashed resolution of the
  Python packages its commands declare (FR-013).
- **A toolchain entry** — a program a command needs that has no wheel: name,
  version, an address and checksum per platform, and what it provides, declared
  in `.workspaces-host/toolchain.d/` (FR-016).
- **The store** — the one directory `ws-host` installs entries into and verifies
  them in (FR-017).

## Success criteria

- **SC-001**: Every tool in every Eidolon repository passes on a stock host
  that has only `ws-host`, with a cold store and a network.
- **SC-002**: Every tool that needs no toolchain entry beyond Python and `uv`
  passes with no network and a warm `uv` cache.
- **SC-003**: No tool in any Eidolon repository installs or downloads anything
  when it runs except locked packages and verified toolchain entries.
- **SC-004**: No repository's tools, checks, workflows or hints require a
  container or a persona.
- **SC-005**: A generated file is the same on every host of one platform.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
