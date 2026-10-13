# Feature Specification: Machine bootstrap

**Spec ID:** 0053-machine-bootstrap
**Status:** Draft

**Input:** How a person turns a slim Debian into a complete working environment and a clone of the harness repository with one line
typed into a terminal: `bin/bootstrap-archon.sh`, fetched from this public root and run from a pipe. The machine is Debian 12 or 13, `amd64`
or `arm64`, under WSL (Windows Subsystem for Linux) 2 or in a virtual machine (0026-workspaces FR-001). The script is a self-contained port of
what `ws-host` installs for its default kits (`base`, `shell` and `embedded-sql`) and does for the terminal's look, git and the workspaces
folder; it never calls, clones or depends on `ws-host` (0026-workspaces FR-002). It ends by running `archon`'s own `doctor`, `toolchain ensure`
and `check` in the clone, so the machine is ready for the harness's next commands. The harness repository is private: the script signs the
person in to GitHub before it clones.

## The entry

- **FR-001**: The script MUST run unchanged from a pipe (`curl -fsSL URL | sh`), from a checkout, and as `sh bin/bootstrap-archon.sh`,
  using only POSIX `sh` until it has installed `bash` and `fish`. It MUST NOT let any program it runs read the script's own standard input:
  a program gets no input, or the terminal device, and every question is asked of and answered on the terminal device alone.
- **FR-002**: The script MUST be safe to run again: a step whose result is already in place MUST change nothing, and a file of the person's
  that the script edits MUST be edited only between its own marked lines, with a copy of the file kept first (FR-009).
- **FR-003**: `--dry-run` MUST list, in order, every step the script would take on this machine, write nothing, fetch nothing, and ask for no
  password; the list MUST be the same steps a real run takes.
- **FR-004**: The script MUST stop at once, with exit status 3, the reason, and the fix, when the machine is not Linux, not Debian-family,
  or not `x86_64` or `aarch64`, or when `HOME` is not an existing folder other than `/`; and MUST say plainly that Debian 12 and 13 are
  the supported releases when it runs on another Debian-family release.
- **FR-005**: The script MUST fetch its data files (the prompt themes, the managed-file helper) from the same address it was fetched from
  (`BOOTSTRAP_URL`) when it runs from a pipe, and MUST use the copies beside it when it runs from a checkout.
- **FR-023**: The script MUST stay optional: no `agora` command, check, workflow or hook of this repository calls it or needs it, and a
  repository's tools work from a clone on a computer that never ran it (0025-tooling-environment FR-033).

## Privilege and packages

- **FR-006**: The script MUST say what needs administrator rights and why, and ask for the password once, before the first step that
  needs it, and MUST ask for none when the person is already administrator, when nothing needs it, or when `BOOTSTRAP_NO_APT=1`. Rights
  MUST be kept for the length of the run and MUST NOT be requested again.
- **FR-007**: The script MUST install with `apt` the packages the default kits name for Debian and that the machine lacks: the standard
  userland, `git`, `gh`, `curl`, `wget`, `xz-utils`, `unzip`, `ca-certificates`, `jq`, `ripgrep`, `fd-find`, `bash-completion`, `python3`, `nodejs`,
  `npm`, ImageMagick with WebP, `sqlite3`, `shellcheck`, `chromium` and, where the distribution ships it, `glab`. It MUST install no compiler
  or build tool itself; a program that needs one is installed by `archon` (FR-021). A package the distribution lacks MUST be reported, not
  fatal.
- **FR-008**: Every program the script fetches outside the package manager MUST be checked before it is unpacked: against a SHA-256 written
  in the script for a pinned release, or against the checksum its publisher states for the release file for a program that follows its newest
  release. A mismatch, or a release with no checksum, MUST install nothing and be reported. A pinned program: `mise` (which installs `uv` and
  Python), `chezmoi`, `oh-my-posh`, `glab` where `apt` has none, and `fish` where `apt` has none of version 4.

## The terminal

- **FR-009**: `chezmoi` MUST manage the person's shell startup files: a source state under the script's data directory, rewritten at every run,
  whose only files are `modify_` scripts that add or refresh marked blocks in `~/.bashrc`, `~/.config/fish/config.fish` (when `fish` is
  installed) and `~/.gitconfig`. A block begins `# >>> workspaces-host: …` and ends `# <<< workspaces-host <<<`, so a person's own `ws-host`
  and this script recognise one another's lines. A file MUST be copied to the state directory before it changes; a block that lost its end
  line MUST leave the file alone; a block the person edited MUST be kept unless they name a prompt on the command line.
- **FR-010**: The prompt MUST be `oh-my-posh` with the `ws-host-pretty` theme, byte for byte the theme `ws-host` ships, unless the person says
  `plain` (`BOOTSTRAP_PROMPT=plain`, or `WS_HOST_PROMPT=plain` in `~/.config/workspaces-host/ws-host.env`) or `no`. The script MUST tell the person
  that the pretty theme needs a Nerd Font (a font that carries icon characters) in the terminal, say in numbered steps how to install one on
  Windows and choose it in Windows Terminal, and say how to choose the plain theme instead.
- **FR-011**: `fish` MUST be installed at version 4 or later: from `apt` where the distribution's package is version 4 or later, else the
  fish project's own static release, pinned (FR-008), unpacked under the script's tools directory and linked into `~/.local/bin`.
- **FR-012**: The script MUST offer to make `fish` the login shell (the program that starts in each new terminal) with `chsh` only at a
  terminal, only after everything else is installed, and only if the person agrees; it MUST do nothing to the login shell when there is no
  terminal, when `BOOTSTRAP_NO_CHSH=1`, or when the person declines, and MUST NOT fail the run when `chsh` fails.
- **FR-013**: The script MUST install the everyday tools the default kits install: `mise`, `uv` and Python, the modern command line tools
  (`eza`, `bat`, `zoxide`, `fzf`, `delta`, `btop` and the rest of `ws-host`'s list) at their newest release (FR-008), DuckDB, the SQLite command
  line tools, and the embedded-SQL tools. A tool that cannot be installed MUST be reported at the end and MUST NOT stop the run.
  The script MUST make bash and fish use the modern tools unless `WS_HOST_MODERN=no`.

## Git and GitHub

- **FR-014**: The script MUST sign the person in to GitHub with `gh auth login --web` (a one-time code and a browser; no password, token or
  SSH key is typed or kept by the script), make `gh` git's credential helper for `github.com`, and continue. Where nobody can answer
  (no terminal) and the person is not signed in, it MUST stop before cloning with the one command to run, exit status 0.
- **FR-015**: The script MUST set `user.name` and `user.email` in git's global configuration from the signed-in GitHub account (the name, and
  GitHub's private `noreply` address) only where git has none, MUST set a value given in `BOOTSTRAP_GIT_NAME` or `BOOTSTRAP_GIT_EMAIL` over the
  existing one, and MUST NOT change anything else in git's configuration.

## The workspace and the clone

- **FR-016**: The script MUST create the workspaces folder, `~/workspaces` unless `WS_HOST_HOME` names another, and clone the harness
  repository (`ARCHON_URL`) to `<workspaces>/github.com/intellectual-frontiers/archon` (0026-workspaces FR-015). An existing clone MUST be updated by
  fetch and fast-forward alone (0026-workspaces FR-019); a clone with changes, diverged commits or no upstream MUST be left exactly as it was, with the words that the
  person's work is safe, and exit status 0. A clone that fails for want of access MUST say whose access is missing and what to do.

## The finish

- **FR-017**: In the clone the script MUST run `./archon doctor`, then `./archon toolchain ensure` for the entries `./archon toolchain list`
  shows as not ready and not marked optional (or the names in `BOOTSTRAP_TOOLCHAIN`), then `./archon check`; MUST run all three even when
  one fails; MUST show each one's output; and MUST exit non-zero, after printing everything, when any failed.
- **FR-018**: The script MUST end by saying what to do next: `archon orch status` to see the harness's state, then `archon orch dev`;
  it MUST NOT name a command `archon` does not have. It MUST link `~/.local/bin/archon` to a wrapper that runs the clone's launcher, and
  MUST tell the person, when `~/.local/bin` was not on their `PATH`, the one line that makes the window find it.

## What the person sees

- **FR-019**: A step that takes a while MUST show one line with a spinner and the elapsed time, only at a terminal and only after half a
  second; elsewhere it MUST print one plain line when it starts; what a quiet step printed MUST be shown only when it fails, and kept in a
  log file whose path is then shown. Colour and emoji MUST appear only at a terminal, never with `NO_COLOR` or `TERM=dumb`, and emoji only
  where the locale is UTF-8.
- **FR-020**: The script MUST honour these switches so that it can be tested: `BOOTSTRAP_URL`, `ARCHON_URL`, `BOOTSTRAP_NO_APT`,
  `BOOTSTRAP_NO_DOWNLOAD` (no fetched program), `BOOTSTRAP_NO_RUNTIME` (no `mise`, Python or `uv`), `BOOTSTRAP_NO_DOTFILES`, `BOOTSTRAP_NO_AUTH`, `BOOTSTRAP_NO_CHSH`, `BOOTSTRAP_NO_CLONE` and
  `BOOTSTRAP_NO_ARCHON`; with all of them set it MUST change nothing but the workspaces folder and its own directories.
- **FR-021**: A program `archon` obtains for its commands (Java, a browser, a typesetter, a compiler) MUST be left to `archon toolchain
  ensure`, which asks for administrator rights itself where it needs them.

## Documentation

- **FR-022**: The `README.md` of this repository MUST carry a section, *Set up a new computer*, with the one-line command, what it does, what it
  needs, and each term of art (WSL, chezmoi, Oh My Posh, Nerd Font, fish, login shell, workspace) defined where it is used.

## Out of scope

- Installing WSL, a virtual machine or Windows Terminal, and installing a font on Windows: the vendors' instructions.
- Ubuntu and other distributions; a hosted environment (0026-workspaces FR-003).
- `ws-host`'s own commands, its editor extension and its trust model; this script installs none of them.

## Edge cases

- Run as root in a container, with no `sudo`: nothing asks for a password and the packages install, per FR-006.
- Run twice: the second run changes no file and installs nothing, and its step list is shorter, per FR-002.
- A pipe with no terminal and no sign-in: the script installs everything, stops before the clone and prints the sign-in command, per FR-014.
- A clone with uncommitted work: left exactly as it was, per FR-016.
- Debian 12, whose `fish` is version 3: the pinned static release is used, per FR-011.
- `~/.bashrc` is a symbolic link into the home folder: the file it points to is the one edited; a link that leaves the home folder leaves
  the file alone and says so, per FR-009.
- A release with no checksum from its publisher: that tool is not installed, the run goes on, and the end says which, per FR-008 and FR-013.
- `chsh` asks for a password nobody can type: it fails, the run still ends well, and the command is printed, per FR-012.
- `--dry-run` on a machine with nothing installed: the same steps a real run takes are listed, nothing is fetched, per FR-003.

## Assumptions

- The machine has internet access to `github.com`, `raw.githubusercontent.com`, `api.github.com`, `cdn.ohmyposh.dev` and `mise.jdx.dev`.
- The person has a GitHub account with access to the harness repository.
- The pins in the script are the versions `ws-host` pins; they move together when `ws-host` moves them.

## Open questions

- **OQ-1**: Which `toolchain list` entries are "needed by default". FR-017 takes every entry not ready and not marked optional in its
  summary; `archon` has no explicit field, and a field would let a person's machine ask for fewer.
- **OQ-2**: 0026-workspaces FR-017 keeps a non-public repository out of public specifications and code; this spec and the script name
  the harness repository because the person asked for the clone. Whether that rule should name this script as an exception.

## Key entities

- **The bootstrap script** - `bin/bootstrap-archon.sh`, with its data in `bin/bootstrap/`.
- **The managed files** - the marked blocks in `~/.bashrc`, fish's `config.fish` and `~/.gitconfig`, kept by `chezmoi`.
- **The workspace** - the folder `~/workspaces` and the clone under it.

## Success criteria

- **SC-001**: On a fresh Debian 12 or 13 under WSL 2, one pasted line leaves a person with a coloured prompt, `fish` available, `gh` signed in,
  the harness cloned, and `./archon doctor`, `toolchain ensure` and `check` having run.
- **SC-002**: A second run changes no file.
- **SC-003**: `--dry-run` writes nothing and lists the steps.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
