# Feature Specification: Tooling environment

**Spec ID:** 0025-tooling-environment
**Status:** Draft

**Input:** Where the company's own tooling runs, and how it gets what it
needs. Every tool an Eidolon repository holds (a checker, a harness, a
build or publishing script, a CI job) installs itself. A host has to supply
`uv` and nothing else, and nobody wonders what is installed: the repository's
launcher fetches `archon` (workspaces-host, 0011-archon), the Python command
runner, which makes whatever the command needs exist before the command runs. `uv`
supplies the newest Python and the Python packages a tool locks. A program
outside Python (a typesetter, a browser, a Java runtime, a Node runtime and
its packages) is an entry of the repository's toolchain, with a version, and
for each platform a download address and a checksum. `archon` obtains it from
the first source that has it at the version the entry accepts: the program
already on the host, the host's package manager, or the entry's own verified
download into one store. Every one of these works for a person, a CI runner or an
AI agent alike, with nobody present to answer a question. `ws-host`, the
workspaces orchestrator, is the interactive experience for a person (a
friendly command line, the editor window, setting up a Linux machine) and is
built on `archon`; no tool needs it. A repository declares what it needs in a
`.workspaces-host/` folder of small TOML files. No repository requires a
container or any other prepared environment. Linux is the platform; macOS and
Windows are served by WSL, a virtual machine or a container that runs Linux.
This spec states the host's part, the Python locks, the toolchain, the store,
offline use, platform coverage, the language of the programs the company
writes, and what continuous integration needs.

## Scope

- **FR-001**: This spec MUST govern every tool held in an Eidolon
  repository, the public root and the vault alike: any script, checker,
  harness, build or publishing command, and CI job that the repository
  runs on its own content. A design system's assurance harness is such a
  tool (0014-design-systems FR-015).

## Independence

- **FR-002**: A tool MUST run on any host that supplies the host prerequisite
  (FR-014) and nothing more, whatever programs outside Python it names:
  `archon` makes them available (FR-017). A tool MUST NOT require a particular
  operator's machine, a program installed on the host beyond what an entry
  accepts (FR-019), or a path that exists only on one kind of host.
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

- **FR-005**: `uv` is the one prerequisite of every Eidolon repository's
  tools (FR-014); it supplies the newest Python and fetches `archon` at the
  revision the repository pins. `archon` is the one installer of the programs
  outside Python (FR-015) and of the Python environments (FR-013). It is
  public, in workspaces-host, and independent of any repository that depends
  on it. `ws-host` is the reference environment a person works in and is not
  a prerequisite of any tool. No other prepared environment is required: no
  container, no devcontainer and no persona.
- **FR-006**: Every tool MUST run unmodified from a fresh clone of the
  repository that holds it, with no other step: no `make install`, package
  install, virtual environment, enabling of the clone or other setup command.
  The first run of a command MAY fetch what it needs (FR-013, FR-016).
- **FR-007**: A tool that needs a program MUST obtain it as a Python
  package (FR-013) where a package of acceptable fidelity and licence
  exists, and otherwise as a toolchain entry (FR-015). A repository MUST NOT
  close a gap with its own installer, install target, requirements file,
  version manager, package-manager call or bootstrap script, and MUST NOT
  tell a person to install a program by hand.
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
- **FR-011**: Each repository's CI MUST run its tools on a stock runner that
  has been given only `uv`, with a restored cache of what it has fetched
  (FR-023). A CI job MUST NOT install a program with a package manager, pull an
  image, or run in a container built for the repository, so that FR-002 and
  FR-006 are tested rather than assumed; `archon` may use the runner's package
  manager itself (FR-017).
- **FR-012**: A hint for a missing prerequisite MUST name only `uv`, or the
  requirement `archon` could not obtain and why (workspaces-host's archon specification), or, for
  a maintainer tool, the approved host program it runs (0041-command-line
  FR-071). A tool MUST NOT name a container, a devcontainer or a persona as a
  requirement.

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

- **FR-014**: The host MUST be required to supply `uv` and nothing else; `uv`
  is supplied where it is on `PATH` or where its installer or `ws-host` puts it
  (0041-command-line FR-001). A
  repository MUST NOT document or check for another host program as a
  prerequisite. A launcher MUST need no more than `uv`: it runs `archon` at the
  revision the repository pins (`revision` under `[tool.archon]` in its
  `pyproject.toml`), by `uvx --from git+https://github.com/intellectual-frontiers/workspaces-host@REVISION archon run`
  (workspaces-host's archon specification), and `archon` runs the command, making what it
  needs available first. The Python it runs under MUST be the newest the
  repository's `requires-python` allows, and that bound MUST be written once,
  in the repository's `pyproject.toml` (FR-013).

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
- **FR-017**: `archon` makes an entry available only when a command whose plan
  names it runs, or when a person asks, and only once. It takes the entry from
  the first source that yields a program meeting the entry's `minimum`, in this
  order: a program already on `PATH`; the host's package manager (`apt`,
  `dnf`, `apk` or `brew`), used when it offers a version meeting the minimum
  and runs as root or through `sudo` (without a password when nobody is
  attending); the entry's own download, into its one store under the XDG data
  directory, never into the clone, the host's program directories or an
  environment the host owns (workspaces-host's archon specification). It verifies a download's
  archive SHA-256 before unpacking, and a checksum that does not match
  installs nothing and fails with an error that names the entry. A fetch, an
  install and the first preparation of a group's packages MUST show that they
  are working (workspaces-host's archon specification): for a person, a spinner with the
  seconds and what has come, with colour and an emoji, a ✅ or ❌ line when it
  took a while, and the same steps as events for the editor and the web;
  where nobody is attending, plain lines on standard error.
- **FR-018**: A launcher MUST run offline on request (0041-command-line
  FR-004): `archon` then uses only what the host and the store already hold,
  and a command whose plan names an entry no source can yield MUST fail with
  exit status 3, naming each missing entry and its version, and the command
  that fetches it while online (0041-command-line FR-067).
- **FR-019**: A program found on the host, or a package the host's package
  manager supplies, MAY stand in for a toolchain entry only when the entry
  declares a `minimum` and a `probe` and the program's version meets the
  minimum (workspaces-host's archon specification). An entry whose program writes a tracked
  generated file (FR-026) MUST NOT declare a `minimum`, so that such a file
  never depends on the machine it was made on. There is no other override.
  Programs a person installs for their own use (a package manager's, an
  environment loader) are theirs; `archon` uses the package manager to install
  only what an entry names.
- **FR-020**: Every entry MUST list the platform `linux-x64`, and MUST list
  `linux-arm64` where the upstream publishes a build for it. A command whose
  plan names an entry that has no build for the host's platform MUST fail with
  exit status 3, naming the entry and the platform. macOS and Windows are served
  through Linux, in WSL, a virtual machine or a container.

## A browser's system libraries

- **FR-021**: A Chromium build the toolchain supplies runs on Linux only when
  the host's shared libraries it links against are present, and installing
  them needs administrator rights. The entry lists the packages for the Debian
  family in its `system` key, and `archon` installs the ones that are missing
  through the host's package manager, as root or through `sudo` (workspaces-host's archon specification), as part of making the entry available. Where it cannot (no
  rights, offline, no package manager), the command that needs the browser MUST
  fail with exit status 3 naming the packages. `ws-host system ensure` is the
  command a person runs to install them ahead of time, and prints exactly what
  it will run (`--dry-run` prints it and runs nothing). `doctor` MUST report the
  same without failing a command that does not use the browser, and the
  repository's README MUST document it.

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
  fetches one outside `archon`, and MUST NOT run a job whose purpose is to
  prove a prepared environment. A job that needs a program runs the launcher,
  which has `archon` obtain the entry as FR-017 states.
- **FR-023**: CI MAY restore and save the store `archon` fills and uv's
  cache to avoid fetching on every run, with a key made from the hashes of the
  locks and the toolchain entries. A cache MUST be an optimization only: a run
  with an empty cache MUST pass, only slower, and `archon` MUST verify what it
  finds in the store as FR-017 does.
- **FR-033**: The launcher is the whole bootstrap. A runner, a container or an
  agent session that has `uv` runs every command through the launcher, and
  nothing else is run first: no installer, no enabling of the clone, no
  confirmation flag. Each repository MUST say so, in the same words, in its CI
  workflow, its session hook (`.claude/hooks/session-start.sh`, registered in
  `.claude/settings.json` beside an allow rule for the launcher) and the entry
  file an agent reads first, and a repository MUST NOT add a bootstrap of its
  own.

## One version of a tool

- **FR-072**: A tool MUST be installed once on a computer, at one version
  (workspaces-host's archon specification, FR-024). A requirement that two
  repositories declare MUST be one declaration, and the public root's is the
  source: a private repository's entry of the same name is a copy of it, which
  its fresh command rewrites, and the `python` and `uv` entries of the public
  root MUST hold the versions `archon` pins in `archon/bootstrap.env`, checked
  beside a clone of workspaces-host. A repository's check MUST fail when they
  differ, naming the file to change.

## What a repository must not require

- **FR-024**: A repository MUST be usable from a clone by following only its
  README's first steps: install `uv` and run the launcher. The README MAY
  then point a person to `ws-host`, the friendlier environment.
- **FR-025**: A repository MUST NOT require a container, a devcontainer or a
  persona: no file it holds MAY make one a prerequisite, no check MAY fail for
  lack of one, and no error or hint MAY tell a person to use one.

## The language of the company's programs

- **FR-030**: Rust MUST be the language of every program the company writes
  that is a server, a generator or a command-line program. Another language
  MUST have a reason stated in the spec that governs the program (FR-031 states
  one). The command groups of `eid` and `agora` are Python scripts that run
  such programs, since their command line is Python (0006-eid-command-line,
  0041-command-line); the program they run is Rust. A Rust program MUST be delivered in one of two
  ways: built from source with the `rust` toolchain entry, locked by its
  `Cargo.lock`, or as a container image that holds the built program.
- **FR-031**: A program whose work is reading, writing, validating, querying or
  reasoning over RDF, an ontology, SHACL shapes or SPARQL MAY be written in
  Python, whether it is a server, a generator or a command-line program. The
  reason is that the most complete and longest-tested implementations of those
  standards are Python libraries. This is the reason FR-030 requires for such
  a program.
- **FR-032**: A Rust program that does that work MUST use the most complete
  maintained Rust library for it, and MUST NOT write its own parser, validator
  or query engine for a standard that a library implements. Where such a
  library has a defect that changes a result the program depends on, a
  server-side Rust program MAY take that result from a Python program, by a
  remote call or by running the program, as a workaround. The workaround MUST
  sit behind one interface the Rust program owns, so that replacing it changes
  that interface alone (0046-distribution-platform FR-005); MUST run from
  packages locked as FR-013 states, with no installer of its own; MUST be recorded with the defect and the condition that
  removes the workaround; and MUST be covered by a test that compares the
  library's results with Python's on the company's own shapes and names each
  known difference, so that the test says when the workaround can go.

## Repositories that build on one another

- **FR-027**: Each repository that is a provider declares its own entries. A
  program that two providers pin at the same name and version is installed once
  in the store; two providers MUST NOT declare one name and version with
  different addresses or checksums, and `archon` and `ws-host` refuse the second
  so that no provider changes what another's pin
  means. A repository that builds on another MUST NOT copy its entries.
- **FR-028**: Retired. What a provider pins is read with `archon ensure` or `ws-host provider show`, not from another repository's command line.
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
  system libraries are installed by `archon` through the package manager, per
  FR-021.
- A tool that needs a typesetting toolchain: it is a toolchain entry named by
  the commands that need it, not a program found on the host, per FR-007 and
  FR-015.
- A program with a PyPI wheel, such as an image or PDF library: it is a locked
  package and needs no entry, per FR-007 and FR-013.
- A host that already has the program on its `PATH` at the entry's minimum: it
  is used as it is, per FR-019; an entry with no minimum always uses its own
  download.
- A host whose package manager offers the program at the minimum: the package is
  installed and used, before any download, per FR-017.
- A machine with no network and a warm store: `--offline` runs, per FR-018;
  with a cold store and nothing on the host, the command fails naming each
  missing entry, per FR-018.
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
- A repository that has not been enabled as a provider: its launcher runs it
  all the same, per FR-006.
- A Python older than the repository's `requires-python`, or none: `uv` fetches
  the newest allowed one, per FR-014; with no network the launcher exits 3
  naming `uv python install`.
- A host that lacks a library Chromium links against: `archon` installs it
  through the package manager where it has the rights; where it does not, the
  browser is not started and exit status 3 names the packages, per FR-021.
- Two providers pinning one program at one version: one copy in the store, per
  FR-027.
- Two machines of one platform: the same locked versions give the same
  generated files, per FR-026.
- A new generator, server or command-line program: it is written in Rust, per
  FR-030. A program that needs another language states the reason in its own
  spec, per FR-030.
- An `eid` command that serves or builds a website: it is a Python script that
  runs the Rust program, per FR-030.
- A server whose work is validating ontology data against SHACL shapes: it may
  be Python, per FR-031.
- A Rust program needs a SHACL result and the Rust library drops a shape's own
  message: it takes the result from Python behind its interface, records the
  defect and the condition that removes the workaround, and a comparison test
  names the difference, per FR-032.
- A Rust program would parse Turtle with code it writes itself: refused, since a
  maintained library does it, per FR-032.

## Assumptions

- `uv` can be installed on every host the tools run on, by one documented
  command, and the host can reach `github.com` and the package index once.
- The addresses that toolchain entries name stay reachable and keep the
  archives they served when the checksum was recorded; where one does not, the
  entry is changed as FR-009 states.
- A stock CI runner of the provider in use can install `uv`.
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
- **The host prerequisite** — `uv`, the one thing a host supplies (FR-014).
- **archon** — the Python command runner in workspaces-host that makes a
  command's packages and programs available (0011-archon).
- **A provider** — a repository with `.workspaces-host/provider.toml` and a
  launcher.
- **A lock** — a repository's committed `uv.lock`, the hashed resolution of the
  Python packages its commands declare (FR-013).
- **A toolchain entry** — a program a command needs that has no wheel: name,
  version, an address and checksum per platform, and what it provides, declared
  in `.workspaces-host/toolchain.d/` (FR-016).
- **A Rust program** — a program the company writes as a server, a generator or
  a command-line program, built from source with the `rust` kit and locked by
  `Cargo.lock`, or delivered as a container image (FR-030).
- **The store** — the one directory `archon` installs entries into and verifies
  them in (FR-017).

## Success criteria

- **SC-001**: Every tool in every Eidolon repository passes on a stock host
  that has only `uv`, with a cold store and a network.
- **SC-002**: Every tool that needs no toolchain entry beyond Python and `uv`
  passes with no network and a warm `uv` cache.
- **SC-003**: No tool in any Eidolon repository installs or downloads anything
  when it runs except locked packages and verified toolchain entries.
- **SC-004**: No repository's tools, checks, workflows or hints require a
  container or a persona.
- **SC-005**: A generated file is the same on every host of one platform.
- **SC-006**: Every server, generator and command-line program the company
  writes is Rust, or its governing spec states why not.
- **SC-007**: Every Python workaround in a Rust program sits behind one
  interface, names the defect and the condition that removes it, and is covered
  by a comparison test.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
