# Feature Specification: Workspaces

**Spec ID:** 0026-workspaces
**Status:** Draft

**Input:** How people, technical or not, start working in an
Intellectual Frontiers repository. The reference environment
(0025-tooling-environment FR-005) is one opinionated environment that
runs in several flavors. Each repository carries a devcontainer that
selects the environment, lists the repositories it works alongside, and
logs in to GitHub before anything is cloned. Someone on macOS or
Windows 11 with nothing installed starts in a browser or one click;
someone who prefers a bare-metal or virtual machine install gets the
same result there.

## Flavors

- **FR-001**: The reference environment MUST be treated as one
  environment that runs in any of these flavors, each built from the
  same workspaces-host-v3 flake at the same commit: bare-metal Linux
  with Nix; a Linux virtual machine with Nix (including WSL on Windows
  and a Linux virtual machine on macOS); the published OCI container
  image; a devcontainer, run locally or in GitHub Codespaces; and a
  cloud agent session. The flavors MUST be recorded in the ontology's
  workspace flavor scheme (`ifcore:WorkspaceFlavorScheme`).
- **FR-002**: A tool, a devcontainer, or a contributor instruction MUST
  NOT depend on which flavor it runs in. Anything that works in one
  flavor and not another is a defect in workspaces-host-v3, fixed there
  (0025-tooling-environment FR-007).
- **FR-003**: A new flavor MUST be added by adding its concept to the
  workspace flavor scheme and naming it in FR-001; nothing else moves.

## Each repository's devcontainer

- **FR-004**: Every Intellectual Frontiers repository that people or
  agents work in MUST carry `.devcontainer/devcontainer.json` naming a
  published workspaces-host-v3 image at the pinned tag
  (0025-tooling-environment FR-008). The image chosen MUST be the one
  that carries the personas the repository's tools need; that choice is
  how a repository names its personas.
- **FR-005**: Every such repository MUST carry
  `.devcontainer/ws-repos.json`, in the form workspaces-host-v3's
  `ws-repos` reads, listing the Intellectual Frontiers repositories it
  is worked alongside. By default every repository lists the public
  root (`.github`), the vault (`eidolon`), and
  `www.intellectualfrontiers.com`, so a session started from any of them
  has all three.
- **FR-006**: A repository's devcontainer MUST add nothing to the
  environment beyond the image, its `ws-repos.json`, editor extensions,
  the environment's first-run command (FR-008), and, where the
  environment does not yet do it, the linking FR-015 requires
  (`.devcontainer/workspace-links.sh`, identical in every repository).
  Any package, tool, or setup step belongs in workspaces-host-v3
  (0025-tooling-environment FR-007), except Python packages a tool
  obtains from a lock (0025-tooling-environment FR-013).

## Authentication and first run

- **FR-007**: A person or agent MUST be logged in to GitHub (`gh auth
  login`, with gh as git's credential helper) before the environment
  clones or pushes anything, in every flavor. Where the flavor already
  supplies a GitHub token, as GitHub Codespaces does, that login counts.
- **FR-008**: A devcontainer MUST run workspaces-host-v3's first-run
  command when a person attaches to it, not when the container is
  created: the command checks the GitHub login, asks for one if it is
  missing, and then clones or updates every repository in the
  repository's `ws-repos.json`. It MUST be safe to run on every attach.
- **FR-009**: Contributor documentation MUST state the GitHub login as
  the first step on every path, before any clone or command.

## Starting points

- **FR-010**: Each repository's README MUST open its contributor section
  with three starting points, in this order: an "Open in GitHub
  Codespaces" link; an "Open in Dev Containers" link for a local
  container; and a link to workspaces-host-v3's installation for a
  bare-metal or virtual machine install.
- **FR-011**: The default starting point for someone on macOS or
  Windows 11 without a Nix install MUST be GitHub Codespaces, which needs
  nothing installed locally. The second MUST be a local devcontainer
  (VS Code with a container runtime; on Windows, Docker Desktop's WSL 2
  backend). A bare-metal or virtual machine install MUST remain fully
  supported for anyone who prefers it.
- **FR-012**: The published images MUST be available for `linux/amd64`
  and `linux/arm64`, so a local devcontainer on an Apple Silicon Mac
  runs natively.
- **FR-013**: Someone on a bare-metal or virtual machine install MUST
  reach the same environment as the repository's devcontainer by
  activating the same personas (`ws-persona activate`) and pointing
  `ws-repos` at the same `ws-repos.json`.
- **FR-014**: Every flavor MUST lay out cloned repositories the way
  `ws-repos` does, so contributor instructions read the same in each.
  A tool MUST NOT depend on that layout (0025-tooling-environment
  FR-002).
- **FR-015**: Every repository MUST live at `~/workspaces/<host>/<org>/
  <repo>`, the layout `ws-repos` manages, and every repository in a
  repository's list MUST be cloned there by `ws-repos ensure`, never as
  a second copy elsewhere. Where a flavor opens the repository somewhere
  else, as GitHub Codespaces and a Dev Container cloned into a volume
  open it at `/workspaces/<repo>`, the opened checkout MUST be
  registered at its `~/workspaces` path, so `ws-repos ensure` pulls it
  rather than cloning it again, and every other repository in its list
  MUST be reachable beside it, so `../<repo>` resolves as it does on any
  other host.

## Out of scope

- How workspaces-host-v3 builds each flavor, its personas, and its
  first-run command. Its own constitution and specs govern that.
- Who may use GitHub Codespaces at the company's expense, and its
  machine sizes.
- Editor choice. VS Code is named because devcontainers and Codespaces
  open in it by default; any editor that opens a devcontainer works.

## Edge cases

- A repository whose tools need typesetting: its devcontainer names the
  image that carries the `press` persona, per FR-004; nothing is added
  to the devcontainer itself, per FR-006.
- A container created with no GitHub login: nothing is cloned at
  create; the first attach asks for the login and then clones, per
  FR-007 and FR-008.
- A Codespace: GitHub's own token satisfies the login, so the first-run
  command clones without prompting, per FR-007.
- A Codespace, or a Dev Container cloned into a volume, opens the
  repository at `/workspaces/<repo>`: that checkout is linked in at its
  `~/workspaces` path and its siblings are linked beside it, so
  `ws-repos ensure` clones only the others, into `~/workspaces`, per
  FR-015.
- A private repository listed in `ws-repos.json` that the person cannot
  read: the first-run command reports it and clones the rest, per
  FR-008.
- An Apple Silicon Mac running a local devcontainer: it pulls the arm64
  image, per FR-012.
- A power user who never opens a devcontainer: they activate the same
  personas and use the same `ws-repos.json`, per FR-013.
- A step that works in a devcontainer but not on bare metal: a defect
  in workspaces-host-v3, fixed there, per FR-002.

## Assumptions

- GitHub Codespaces and devcontainers remain able to start from a
  published container image with no build step.
- The repositories people work in are hosted on GitHub.

## Open questions

None.

## Key entities

- **A flavor** — one way to run the reference environment: bare metal,
  virtual machine, container image, devcontainer, or cloud agent
  session.
- **A repository's devcontainer** — the image it selects, the
  repositories it lists, and the first-run command it runs on attach.
- **The repository list** — `.devcontainer/ws-repos.json`, the
  repositories a session started from that repository clones.
- **A starting point** — Codespaces, a local devcontainer, or a
  bare-metal or virtual machine install.

## Success criteria

- **SC-001**: Someone on macOS or Windows 11 with nothing installed goes
  from a repository's README to a working session, with every listed
  repository cloned, by following one link and logging in to GitHub.
- **SC-002**: The same repository's tools pass in every flavor.
- **SC-003**: No Intellectual Frontiers repository's devcontainer
  installs anything.
- **SC-004**: A bare-metal or virtual machine user and a devcontainer
  user starting from the same repository end with the same tools and
  the same repositories.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
