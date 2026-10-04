# Feature Specification: Workspaces

**Spec ID:** 0026-workspaces
**Status:** Draft

**Input:** How a person MAY choose to prepare a machine and work in an
Intellectual Frontiers repository with a workspace. A workspace is an
optional convenience: nothing depends on one, no repository requires one,
and every repository works from a clone with only `python3` and `uv`
(0025-tooling-environment FR-024, FR-025). A person who chooses a workspace
gets one opinionated environment with one flavor for now: bare metal on a
Debian-family Linux distribution, including Ubuntu under WSL on Windows,
with VS Code as its graphical interface. A repository MAY list the
repositories it works alongside in its own `.workspaces-host/ws-host.env`,
and a single command, run first, signs the person in, clones what is
missing and updates the rest without ever touching their work. Containers,
Codespaces and other systems come later, each under its own spec.

## The flavor

- **FR-001**: A workspace, which a person MAY choose and no repository
  requires, MUST be one environment with one flavor: bare metal on a
  Debian-family Linux distribution (Debian or Ubuntu), including Ubuntu under
  WSL on Windows, with VS Code as the graphical interface. A person MAY work
  in any other way, including none. The flavor MUST be recorded in the
  ontology's workspace flavor scheme (`ifcore:WorkspaceFlavorScheme`).
- **FR-002**: A workspace MUST NOT be a dependency. A tool, a repository's
  file, a check or a contributor instruction MUST work from a clone on a host
  that has only `python3` and `uv`, and anything that works only inside a
  workspace is a defect in the tool, fixed in the tool
  (0025-tooling-environment FR-006, FR-025). A workspace's own tools MUST NOT
  depend on a machine's distribution beyond FR-001's family.
- **FR-003**: A new flavor MUST be added by adding its concept to the
  workspace flavor scheme and naming it in FR-001 under its own spec;
  nothing else moves. Devcontainers, Codespaces, published images and other
  operating systems are not flavors yet.

## Each repository's needs

- **FR-016**: An Intellectual Frontiers repository that people or agents
  work in MAY carry `.workspaces-host/ws-host.env`, an environment file
  (0041-command-line FR-047) naming, as a space-separated list, the sibling
  repositories it is worked alongside (`WS_HOST_REPOS`). Only a workspace's
  own tools read it; no tool of the repository does, and none requires it
  (0025-tooling-environment FR-025).
- **FR-017**: A repository that carries the file MUST list by default the
  public root (`.github`), the vault (`eidolon`),
  `www.intellectualfrontiers.com` and the environment itself
  (`workspaces-host`) in `WS_HOST_REPOS`, so a session started from any of
  them in a workspace has all four.
- **FR-018**: A repository MUST add nothing to a workspace beyond that file.
  Any package or program its tools need comes from the repository's own locks
  and toolchain (0025-tooling-environment FR-007), never from a workspace.

## Signing in and the first run

- **FR-007**: A person or agent MUST be signed in to GitHub (through the
  device-flow login `ws-host auth new github`, with `gh` as git's credential
  helper) before the environment clones anything private. A clone that
  needs a login the person lacks MUST fail at once with git's own reason and
  the action that signs in, not report success (0041-command-line FR-063).
- **FR-008**: The first thing a person who chose a workspace runs MUST be
  `ws-host workspace advance`: it checks the sign-in, clones the repositories
  that are missing, fast-forwards the rest, and runs `doctor`. It MUST be safe
  to run as often as the person likes, and MUST install no program a
  repository's tools need.
- **FR-009**: Contributor documentation MUST state the path that needs no
  workspace first (install `python3` and `uv`, then run the launcher,
  0025-tooling-environment FR-024), and MAY then state the workspace's
  one-line install and `ws-host workspace advance` as another way.

## Updating without harm

- **FR-019**: Updating a clone MUST follow 0041-command-line FR-063: fetch,
  then fast-forward alone; never pull, rebase, merge, or stash; a clone with
  changes not yet committed, diverged commits or no upstream left exactly as it
  was, reported in plain words that the person's work is safe and why the clone
  was not updated, with exit status 0.
- **FR-020**: A workspace's `doctor` MUST recommend that git's `pull.ff` be
  `only`, because VS Code's Sync button follows the person's git
  configuration, and MUST offer a one-click fix that is never applied
  unasked.
- **FR-015**: A repository MUST live at `~/workspaces/<host>/<org>/<repo>`,
  and every repository in a repository's list MUST be cloned there, never as
  a second copy elsewhere.

## Trust

- **FR-021**: Cloning a repository MUST NOT trust it. A person trusts a
  repository by `repo add --trust`, which lists exactly what it trusts, or by
  `repo set ID --trusted`, a `decision` command that only a person gives, in the
  terminal or through the editor's modal confirmation and never over MCP
  (0041-command-line FR-023, FR-051). Trust lets the editor extension run the
  repository's launcher (0043-if-console FR-006).
- **FR-022**: Trust MUST NOT be transitive: a repository named by another
  repository's `WS_HOST_REPOS` is cloned and not trusted. The organizations a
  person trusts by default (`WS_HOST_TRUSTED`) MUST be settable only in the
  person's own configuration; no repository's file can grant trust
  (0041-command-line FR-061, FR-062).
- **FR-023**: The record of trust MUST be a link in the person's own data
  directory from the repository's `.workspaces-host/` directory, which is also
  a configuration drop-in read after the person's own configuration. The
  commit at which trust was granted MUST be recorded in the person's state
  directory, and `doctor` MUST warn, without blocking, when the repository's
  launcher or `.workspaces-host/` directory has changed since
  (0041-command-line FR-061).

## The person's own files

- **FR-024**: A person's configuration MUST be held in the person's own
  configuration directory under `workspaces-host/`, in an environment file for
  names and identities and a second, refused unless only its owner can read
  it, for secrets; the person's tools, state, logs and cache MUST follow the
  XDG directories the system names. The environment orchestrator MUST write
  nothing into a clone's working tree and MUST NOT edit a repository's ignore
  rules or its `.vscode/`.

## Out of scope

- How workspaces-host works inside and its first-run command. Its own
  specs govern that.
- Containers, Codespaces, published images, macOS and other distributions.
- Editor choice beyond VS Code, which is named because the editor surface is
  its extension (0041-command-line FR-050, 0043-if-console).
- Preparing a machine's programs for a repository's tools: the tools fetch
  their own (0025-tooling-environment FR-015).

## Edge cases

- A repository whose tools need typesetting: they fetch it themselves
  through the toolchain lock, so the workspace adds nothing, per FR-018.
- A person who does not use a workspace: every repository works from a
  clone with `python3` and `uv`, per FR-002.
- A repository with no `.workspaces-host/ws-host.env`: it is not wrong; a
  workspace simply has no siblings to clone for it, per FR-016.
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
- A trusted repository whose launcher changed after trust was granted: `doctor`
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

- A person who chooses a workspace uses a Debian-family Linux distribution
  on bare metal or under WSL, with `python3` available and the ability to
  install `uv`.
- The repositories people work in are hosted on GitHub or on a GitLab host
  the person's configuration names.
- A person can copy and paste a line into a terminal and click a button in
  VS Code.

## Open questions

- **OQ-1**: Whether existing clones keep their `.devcontainer/` files, which
  nothing requires any longer (0025-tooling-environment FR-025), or lose them
  when the repository's own files for a workspace are removed.

## Key entities

- **The flavor** — bare metal on a Debian-family distribution, including
  WSL, with VS Code.
- **A repository's needs** — the optional `.workspaces-host/ws-host.env`,
  naming its siblings.
- **The first run** — `ws-host workspace advance`.
- **Trust** — a person's explicit act, recorded as a link, that lets a
  repository's code run.

## Success criteria

- **SC-001**: A person on a fresh Debian or Ubuntu machine who chooses a
  workspace goes from a repository's README to a working session, with every
  listed repository cloned, by running one install line and `ws-host
  workspace advance`.
- **SC-002**: The same repository's tools pass with and without a workspace.
- **SC-003**: No update changes a clone that holds work the person has not
  pushed.
- **SC-004**: No repository is trusted by being cloned or by being listed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
