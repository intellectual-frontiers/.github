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
  a program gets no input, or the terminal device, and every question is asked of and answered on the terminal device alone. The documented first step MUST install `curl` and `wget` with `apt` (`cd && sudo apt update && sudo apt install -y curl wget`), because a bare Debian has neither.
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
  (no terminal) and the person is not signed in, it MUST stop before cloning with the one command to run, exit status 0. Before it opens the sign-in it MUST say, in plain words with colour and emoji where the terminal shows them, what GitHub and a repository are, that the person needs a GitHub account the owner has given access to `archon`, and the four steps: read the one-time code, press Enter, type the code at github.com/login/device and click Authorize, then come back; where nobody can answer, it MUST print the same instruction for later.
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

- **FR-024**: The only things the script asks of a person are the Linux password (once, up front, with the reason) and the GitHub sign-in, which comes right after the packages so that everything
  after it runs by itself. The answer to every other question, among them the login shell and every program `archon` would ask to install with `apt`, is yes without asking: the script sets
  `ARCHON_ASSUME_YES=1` for the `archon` commands it runs, and fish becomes the login shell unless `BOOTSTRAP_CHSH=no`.
- **FR-025**: The screen MUST stay calm: a group of steps is one line when it is done (a tick, or a warning when something needs attention), a step that worked leaves no line behind
  (`BOOTSTRAP_VERBOSE=1` shows them), no progress line is wider than the terminal, and the names of packages and versions stay in the log, which is shown only when a step fails.
- **FR-026**: Every environment variable name in a message (capitals with an underscore, such as `BOOTSTRAP_PROMPT`) MUST be shown in bright yellow where the terminal has colour.
- **FR-027**: The last instruction MUST be `exec fish -l` when fish was set up, and `exec bash -l` only when it was not.
- **FR-028**: The script MUST write everything it does to a log, `~/.archon-bootstrap/log/bootstrap-<date>-<time>.log` (`BOOTSTRAP_LOG_DIR` changes the folder): every message, and the whole output of every
  step, whether it worked or not, under a header naming the step and its exit status.
- **FR-029**: A step that fails MUST stop the setup (exit status 4), never leaving the person at a prompt in the middle of a wall of text: it MUST say in colour and emoji what failed and what it said,
  name the log and the line where the problem starts, as a path relative to the home folder, and write `support-<date>-<time>.txt` beside the log, with the computer, the failed step and the end of the log
  and no password, token or key. It MUST tell a person who does not know what to do how to ask for help: copy the support file's path, send that one file to the support team (`BOOTSTRAP_SUPPORT`
  names who) and say what they were doing. A sign-in that did not finish is the one stop that is not an error (exit status 5) and says how to sign in and run the setup again.
- **FR-030**: `archon doctor` MUST NOT run before every installation is complete, since a program that is not installed yet would show as missing.
- **FR-031**: A long step that can count its work (installing the programs) MUST show how many are done of how many, beside the seconds it has taken (`Installing programs: 57 of 130 (176s)`), so a person can tell it is working and not stuck.
- **FR-032**: Programs that do not touch each other MUST be fetched at the same time, at most `BOOTSTRAP_JOBS` at once (by default twice the number of processors, at least 2 and at most 6: the work waits on the network, so processors are not the limit, but unpacking needs some): each job has a work folder of its own, writes only to its own
  folder under the tools folder and to its own link, never uses `apt`, and is logged in full; the setup waits for them all behind one progress line (`Installing tools: 7 of 24`), and a failure
  stops it after the others finish, naming the one that failed (FR-029).
- **FR-033**: The packages the rest of the setup needs to download, unpack and sign in (`git`, `curl`, `wget`, `tar`, `xz-utils`, `unzip`, `jq`, `gh`, `fish`) MUST be installed first, in front of
  the person; the other packages MAY be installed by `apt` in the background while the person signs in and the tools download, because `apt` and those downloads touch different files. At most one
  `apt` runs at a time: the setup MUST wait for the background install before it checks what was installed and before it runs an `archon` command, which may use `apt` itself.
- **FR-034**: Making fish the login shell MUST NOT ask a second password while the administrator rights asked for at the start are still good (it runs `chsh` through `sudo`); where a password is still needed, the script MUST say right before `chsh` runs which password it is: the Linux password of the named user, the same one typed at the start.
- **FR-035**: The GitHub sign-in MUST NOT open a browser (it runs `gh auth login --web --skip-browser`, with no `BROWSER` that could start a text browser); it MUST show the one-time code step and the address `https://github.com/login/device` for the person to open in their own browser.
- **FR-036**: A download MUST NOT wait for ever: no connection in 20 seconds, or under 1 KB a second for 60 seconds, fails it (and it is retried); the progress line of the parallel installs MUST show while jobs are being started as well as while they finish, and name a program still being fetched.
- **FR-037**: The script MUST say at its start whether `ARCHON_POSTHOG_KEY` is set (telemetry on) or not (telemetry off), and in the second case how to set it before starting and that nothing breaks without it.
- **FR-038**: With `ARCHON_POSTHOG_KEY` set (and not `DO_NOT_TRACK=1` or `ARCHON_OBSERVE=off`, and not a dry run) the script MUST report to PostHog, with environment `bootstrap`: `bootstrap_started`, one `bootstrap_step` for each step (name, phase, outcome, exit code, duration; the GitHub sign-in is a step, so the time a person takes is seen), `bootstrap_failed` (the step, the log and support file paths relative to the home folder, the last lines the step printed with tokens removed and the home folder shortened) and `bootstrap_finished` (outcome, duration, step and problem counts). Each event carries a device id made from the machine (a hash of its machine id, else a random id kept in `~/.archon-bootstrap/device-id`), the kind of computer (WSL and its version, virtual machine, container or machine), the system and its version, kernel, architecture, processors, memory and free disk, and never a user name, host name, password, token or file. Sending MUST NOT fail or slow the setup beyond three seconds at its end; the `archon` commands it runs carry `ARCHON_ENVIRONMENT=bootstrap`.
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
