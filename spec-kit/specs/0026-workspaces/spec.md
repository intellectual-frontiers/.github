# Feature Specification: Workspaces

**Spec ID:** 0026-workspaces
**Status:** Draft

**Input:** How people, technical or not, start working in an
Intellectual Frontiers repository. The reference environment
(0025-tooling-environment FR-005) is one opinionated environment with one
flavor for now: bare metal on a Debian-family Linux distribution, including
Ubuntu under WSL on Windows, with VS Code as its graphical interface. Each
repository lists the repositories it works alongside and the kit it needs in
its own `.workspaces-host/ws-host.env`, and a single command, run first,
signs the person in, clones what is missing, updates the rest without ever
touching their work, and installs the kits. Containers, Codespaces and
other systems come later, each under its own spec.

## The flavor

- **FR-001**: The reference environment MUST be treated as one environment
  with one flavor: bare metal on a Debian-family Linux distribution (Debian
  or Ubuntu), including Ubuntu under WSL on Windows, with VS Code as the
  graphical interface. The flavor MUST be recorded in the ontology's
  workspace flavor scheme (`ifcore:WorkspaceFlavorScheme`).
- **FR-002**: A tool, a repository's environment file, or a contributor
  instruction MUST NOT depend on a machine's distribution beyond FR-001's
  family, and MUST NOT depend on a package version a distribution may change
  (0025-tooling-environment FR-002). Anything that works on one machine of the
  flavor and not another is a defect in workspaces-host, fixed there
  (0025-tooling-environment FR-007).
- **FR-003**: A new flavor MUST be added by adding its concept to the
  workspace flavor scheme and naming it in FR-001 under its own spec;
  nothing else moves. Devcontainers, Codespaces, published images and other
  operating systems are not flavors yet.

## Each repository's needs

- **FR-016**: Every Intellectual Frontiers repository that people or
  agents work in MUST carry `.workspaces-host/ws-host.env`, an environment
  file (0041-command-line FR-047), naming the kit it needs
  (`WS_HOST_KIT`) and, as a space-separated list, the sibling repositories it
  is worked alongside (`WS_HOST_REPOS`). It MAY pin the release of the
  environment (0025-tooling-environment FR-008). A repository MAY ship its own
  kits beside it, in `.workspaces-host/kits/` (0041-command-line FR-061).
- **FR-017**: By default every repository MUST list the public root
  (`.github`), the vault (`eidolon`), `www.intellectualfrontiers.com` and the
  environment itself (`workspaces-host`) in `WS_HOST_REPOS`, so a session
  started from any of them has all four.
- **FR-018**: A repository MUST add nothing to the environment beyond that
  file and its kits. Any package, tool, or setup step belongs in
  workspaces-host (0025-tooling-environment FR-007), except Python
  packages an orchestrator obtains from `uv.lock`
  (0025-tooling-environment FR-013).

## Signing in and the first run

- **FR-007**: A person or agent MUST be signed in to GitHub (through the
  device-flow login `ws-host auth new github`, with `gh` as git's credential
  helper) before the environment clones anything private. A clone that
  needs a login the person lacks MUST fail at once with git's own reason and
  the action that signs in, not report success (0041-command-line FR-063).
- **FR-008**: The first thing a person runs MUST be `ws-host workspace
  advance`: it checks the sign-in, clones the repositories that are missing,
  fast-forwards the rest, installs the kits the repositories declare, and
  runs `doctor`. It MUST be safe to run as often as the person likes.
- **FR-009**: Contributor documentation MUST state the one-line install and
  then `ws-host workspace advance` as the first steps on every path, before
  any other command.

## Updating without harm

- **FR-019**: Updating a clone MUST follow 0041-command-line FR-063: fetch,
  then fast-forward alone; never pull, rebase, merge, or stash; a clone with
  changes not yet committed, diverged commits or no upstream left exactly as it
  was, reported in plain words that the person's work is safe and why the clone
  was not updated, with exit status 0.
- **FR-020**: `doctor` MUST recommend that git's `pull.ff` be `only`,
  because VS Code's Sync button follows the person's git configuration, and
  MUST offer a one-click fix that is never applied unasked.
- **FR-015**: A repository MUST live at `~/workspaces/<host>/<org>/<repo>`,
  and every repository in a repository's list MUST be cloned there, never as
  a second copy elsewhere.

## Trust

- **FR-021**: Cloning a repository MUST NOT trust it. A person trusts a
  repository by `repo add --trust`, which lists exactly what it trusts, or by
  `repo set ID --trusted`, a `decision` command that only a person gives, in the
  terminal or through the editor's modal confirmation and never over MCP
  (0041-command-line FR-023, FR-051).
- **FR-022**: Trust MUST NOT be transitive: a repository named by another
  repository's `WS_HOST_REPOS` is cloned and not trusted. The organizations a
  person trusts by default (`WS_HOST_TRUSTED`) MUST be settable only in the
  person's own configuration; no repository's file can grant trust
  (0041-command-line FR-061, FR-062).
- **FR-023**: The record of trust MUST be a link in the person's own data
  directory from the repository's `.workspaces-host/` directory, which is also
  the kits' search path and a configuration drop-in read after the person's own
  configuration. The commit at which trust was granted MUST be recorded in the
  person's state directory, and `doctor` MUST warn, without blocking, when the
  repository's kits have changed since (0041-command-line FR-061).

## The person's own files

- **FR-024**: A person's configuration MUST be held in the person's own
  configuration directory under `workspaces-host/`, in an environment file for
  names and identities and a second, refused unless only its owner can read
  it, for secrets; the person's tools, state, logs and cache MUST follow the
  XDG directories the system names. The environment orchestrator MUST write
  nothing into a clone's working tree and MUST NOT edit a repository's ignore
  rules or its `.vscode/`.

## Out of scope

- How workspaces-host builds its kits and its first-run command. Its own
  specs govern that.
- Containers, Codespaces, published images, macOS and other distributions.
- Editor choice beyond VS Code, which is named because the editor surface is
  its extension (0041-command-line FR-050).

## Edge cases

- A repository whose tools need typesetting: its environment file names the
  `press` kit, per FR-016; nothing else is added, per FR-018.
- A person who has not signed in: the first run asks for the sign-in before it
  clones anything private, per FR-007 and FR-008.
- A private repository listed in `WS_HOST_REPOS` that the person cannot read:
  the report carries git's own reason and the sign-in action, the rest are
  cloned, per FR-007 and FR-008.
- A clone with commits the person has not pushed, and a remote that has moved:
  the clone is left exactly as it was and the person is told their work is
  safe, per FR-019.
- A clone with edits not yet committed: it is not updated and the report says
  why, per FR-019.
- A clone with no upstream: it is left alone and reported, per FR-019.
- A repository listed by a trusted repository: it is cloned, not trusted, per
  FR-022.
- A repository's file naming an organization as trusted: ignored, per FR-022.
- A trusted repository whose kits changed after trust was granted: `doctor`
  warns and does not block, per FR-023.
- A person whose git `pull.ff` is not `only`: `doctor` recommends it and offers
  the fix, never applying it, per FR-020.
- A person on Ubuntu under WSL: the same install and the same first run, per
  FR-001.
- A repository that is not yet cloned: `repo add` clones it at its place in
  the layout, per FR-015.
- A step that works on one machine of the flavor but not another: a defect in
  workspaces-host, fixed there, per FR-002.

## Assumptions

- People use a Debian-family Linux distribution on bare metal or under WSL,
  with `python3` available and the ability to install `uv`.
- The repositories people work in are hosted on GitHub or on a GitLab host
  the person's configuration names.
- A person can copy and paste a line into a terminal and click a button in
  VS Code.

## Open questions

- **OQ-1**: Until workspaces-host's first release ships, existing clones keep
  their `.devcontainer/` files and CI keeps running in the published image
  of the earlier environment (0025-tooling-environment OQ-1).

## Key entities

- **The flavor** — bare metal on a Debian-family distribution, including
  WSL, with VS Code.
- **A repository's needs** — `.workspaces-host/ws-host.env`, naming its kit and
  its siblings, and any kits it ships.
- **The first run** — `ws-host workspace advance`.
- **Trust** — a person's explicit act, recorded as a link, that lets a
  repository's code run.

## Success criteria

- **SC-001**: A person on a fresh Debian or Ubuntu machine goes from a
  repository's README to a working session, with every listed repository
  cloned, by running one install line and `ws-host workspace advance`.
- **SC-002**: The same repository's tools pass on every machine of the flavor.
- **SC-003**: No update changes a clone that holds work the person has not
  pushed.
- **SC-004**: No repository is trusted by being cloned or by being listed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
