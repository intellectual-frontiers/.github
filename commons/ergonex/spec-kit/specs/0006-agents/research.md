# Research note for 0006-agents: what was read, what it says, what is not verified

Written 2026-11-22 for intellectual-frontiers/.github#25, before the specification. Each source says what was read and when; what was not read is named as not verified. Nothing here is a decision: the decisions are in `spec.md` and in the ticket.

## What was run, and what it showed

| Check | Result |
|---|---|
| `claude mcp list` (Claude Code 2.1.330, installed from npm into a scratch folder, no login) against a stdio server (`opsfolio mcp`, the Headless MCP surface) | Connected. It performs the handshake: a server that does not exist is shown as `Failed to connect`. |
| `codex mcp list` (Codex CLI 0.171.0, same way) against the same server and a server that does not exist | Both are listed as `enabled`, auth `Unsupported`. **`codex mcp list` does not connect**: it reads `config.toml` only, so it proves a configuration and not a server. |
| Codex needs its `CODEX_HOME` directory to exist; a missing one is a startup error | Observed. |
| herdr 0.9.5, installed by its own `install.sh` (which checks a SHA-256 from the release manifest) into a scratch folder, then `herdr integration install claude` and `codex` into a scratch home | It wrote a `SessionStart` hook into the harness's own `settings.json` (Claude Code) and `hooks.json` and `config.toml` (Codex). Ergonex's files must therefore merge into those files and never replace them. |
| A `archlinux` container built with `pacman -Syu systemd openssh sudo ...`, with the proxy CA as a build secret | Builds in 22 s. pacman needs `--disable-sandbox` where the kernel has no Landlock (this host has none; Omarchy's own CI does the same). |
| The same Arch container with systemd as process 1 | **Exits 255 with no output on this host.** The host kernel is cgroup v1 (no `/sys/fs/cgroup/cgroup.controllers`), and the systemd that Arch ships today (262.2) has no cgroup v1 support. It will run on a cgroup v2 host. The Ubuntu and Rocky machines of `lab` still run here (their systemd versions are older). |
| A plain Arch container with `mirror.omarchy.org` first in its mirror list | `git`, `tmux`, `mise`, `starship`, `gum`, `fzf`, `ripgrep`, `fd`, `jq`, `github-cli` and `openssh` are in `core` and `extra`. `herdr`, `mise-bin` and `yay` are **not**: they come from Omarchy's own package repository, which this does not add. |
| Omarchy's published VM image, 4.5.0 (`https://nightly.omarchy.org/stable/latest.json`), downloaded and its SHA-256 and the kernel and initrd checked | Matches the manifest. **It boots here with no `/dev/kvm`**, by QEMU software emulation (`-accel tcg`, a patched copy of Omarchy's `vm-boot` kept outside the repository): SSH answered after 137 s and 124 s on four processors and 6 GiB (two boots). An earlier statement that a full Omarchy virtual machine cannot run in this sandbox was wrong. |
| What a real Omarchy 4.5.0 shows over a non-login SSH session (`ssh omarchy@host bash -s`) | `/etc/os-release` has `ID=omarchy`, `ID_LIKE=arch`, `VERSION_ID=4.5.0`; `PATH` is `/usr/local/sbin:/usr/local/bin:/usr/bin:~/.local/share/mise/shims:~/.local/bin` (the `pam_env` line works); `OMARCHY_PATH` is unset; `/usr/share/omarchy` exists; `sshd.service` is active and enabled in the image; `~/.agents/skills` and `~/.claude/skills` exist; `herdr` is `/usr/bin/herdr` 0.9.1; `node`, `gh`, `claude` and `codex` are **mise shims**, not installed programs: running one starts an install over the network (`gh auth status` tried and failed here); `pacman -Q omarchy` printed only database warnings, so `pacman` is not a reliable test for Omarchy; the VM has DNS but no HTTPS to the outside, because the sandbox's proxy re-signs TLS and the image does not trust its CA. |

## Omarchy (read at commit c1e3553 of github.com/basecamp/omarchy, 2026-11-22, and omarchy.org)

- Omarchy describes itself as "Beautiful, fun & agentic Linux by DHH", version 4.5.0 at the time of reading, installed from an ISO (x86 and ARM) or by an installer next to macOS on Apple Silicon.
- It is Arch Linux based: packages are `pacman` packages from the `omarchy-pkgs` repository (`omarchy` and `omarchy-settings` and others), and the core list is `install/omarchy-base.packages` (179 lines). That list holds, among others: `git`, `mise-bin`, `tmux`, `herdr`, `docker`, `yay`, `starship`, `gum`, `fzf`, `ripgrep`, `fd`, `jq`, `base-devel`, `networkmanager`. It holds no `openssh`, no `github-cli` and no Node or Bun: tools come through `mise`.
- **The SSH server is not on by default.** `omarchy-setup-security-sshd [--key=KEY | --gh-keys USER]` installs `openssh`, makes host keys, enables `sshd.service`, opens port 22 in UFW (rate limited) and authorizes a key, unattended when a key is given.
- **SSH commands run without a login shell.** `install/config/ssh-command-path.sh` writes `PATH` into `/etc/security/pam_env.conf` so that `ssh host cmd` finds `~/.local/share/mise/shims` and `~/.local/bin`. `OMARCHY_PATH` is set by the desktop session (uwsm), so it is **not** set in an SSH command. `omarchy-version` reads `pacman -Q omarchy`; the default tree is `/usr/share/omarchy`.
- **Omarchy already has an agent layer**, which Ergonex must meet and not duplicate: `bin/omarchy-agent*` (accounts, usage collectors, launcher, skills), `omarchy-agent-instructions` (one `~/.agents/AGENTS.md` linked into the global-instructions place of each harness that exists: Claude Code, Codex, Pi, OpenCode and others), `omarchy-agent-skills-link` (skills linked into `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills` and others), and `omarchy-agent-integrate-herdr`, a `mise` postinstall hook (`etc/mise/conf.d/omarchy.toml`) that runs `herdr integration install <agent>` for each coding agent `mise` installs (claude, codex, pi, opencode, copilot, grok, qwen, cursor and others).
- **Herdr is part of Omarchy**: in `omarchy-base.packages`, configured in `config/herdr/config.toml`, with `omarchy-install-ai-herdr` for the app (`https://releases.herdr.dev/app/install.sh`) and tests of herdr's saved SSH machines.
- **Omarchy publishes a disposable VM**: a `qcow2` of each release with kernel, initrd and command line, user `omarchy`, SSH by key only; `vm-boot` makes a key for each boot, hands it in through an SMBIOS systemd credential, runs on a copy-on-write overlay and deletes it on exit. It needs KVM. Its own CI boots it in QEMU inside an Arch container.
- Not read: the `omarchy-pkgs` repository (package recipes, the `[omarchy]` pacman repository definition), the manual in full, and the installer's disk handling. Why `pacman -Q omarchy` finds nothing in the published virtual machine image is not known.

## herdr (read at herdr.dev and github.com/herdrdev/herdr, 0.9.5, 2026-11-22)

- "The runtime your coding agents live on": a Rust multiplexer, Apache-2.0, with a background server that keeps terminals running when the client or SSH connection is lost, and restores the saved layout after a restart (the original processes do not survive). It marks each pane working, blocked or idle.
- **Saved SSH machines**: `herdr machine add|status|reconnect`; each machine keeps its own herdr server; host-key checking is unchanged (an unknown or changed key stays "Attention"); an interactive setup can install or update the remote package after confirmation, and background reconnects only discover installed packages.
- **Integrations**: `herdr integration install|uninstall <agent>` for pi, omp, claude, codex, copilot, devin, droid, kimi, opencode, kilo, hermes, qodercli, qwen, letta, cursor, mastracode, antigravity-cli and grok. Every integration tells herdr which session the agent is in so it can resume it; some also report state.
- **Agent surface**: a CLI and a local socket API (`herdr api schema` prints the schema bundled with the binary), an agent skill file (`herdr --skill`) used when `HERDR_ENV=1` is set (the agent runs in a herdr pane).
- Not read: the full socket schema, the `hc` helper's contract, herdr's mobile app and its plugin marketplace.
- The README at github.com/ogulcancelik/herdr is the same project; the maintained repository is `herdrdev/herdr`. Several unrelated repositories carry the name.

## Claude Code (docs at code.claude.com, read 2026-11-22; CLI 2.1.330 run)

- **Instructions**: `CLAUDE.md` (project, user, managed); `AGENTS.md` is read when there is no `CLAUDE.md` in the working directory or above, and a `CLAUDE.md` can import it (`@AGENTS.md`).
- **MCP**: `claude mcp add [--scope local|project|user] NAME -- COMMAND ARGS`, `claude mcp list` (health), `claude mcp get`. A project server in `.mcp.json` is "Pending approval" until a person approves it interactively; approvals through the user's `~/.claude/settings.json` (`enabledMcpjsonServers`) apply even in an untrusted folder; in `claude -p` runs project servers are loaded without asking.
- **Hooks**: `SessionStart` (matchers `startup`, `resume`, `clear`, `compact`, `fork`) in `settings.json`; plain-text stdout of a `SessionStart` command hook is added to the context; hooks run in the background but the first prompt waits for them, so they must be fast.
- **Permissions**: `permissions.allow` and `permissions.deny` with rules like `Bash(npm run test *)`.

## Codex CLI (docs at developers.openai.com/codex, read 2026-11-22; CLI 0.171.0 run)

- **Instructions**: `AGENTS.md` (global `~/.codex/AGENTS.md` or `AGENTS.override.md`, then from the project root down to the working directory), concatenated root first, limited by `project_doc_max_bytes` (32 KiB default).
- **MCP**: `[mcp_servers.NAME]` in `~/.codex/config.toml` or a project `.codex/config.toml`, with `command`, `args`, `env`, `env_vars`, `cwd`, `startup_timeout_sec` (default 10), `tool_timeout_sec` (default 60); `codex mcp add NAME --env K=V -- COMMAND`, `codex mcp list`, `get`, `remove`, `login`.

## Model Context Protocol (modelcontextprotocol.io, read 2026-11-22)

- The newest revision on the site is **2026-07-28**. It has **no initialization handshake**: every request carries its protocol version and capabilities in `_meta`, and the server accepts or rejects each request. The earlier revisions, up to `2025-11-25`, are "legacy": they open a session with `initialize`. A server or client that supports both is "dual-era".
- **stdio transport** (read in full): newline-delimited JSON-RPC, no embedded newlines; the server reads `stdin` and writes `stdout` and nothing else to `stdout`; `stderr` is for logs; the server does not write requests to `stdout`.
- Commons' `headless/src/surfaces/mcp` implements the legacy revision `2025-06-18` (`PROTOCOL_VERSION`) with `initialize`, `ping`, `tools/list` and `tools/call`. Claude Code 2.1.330 connected to it. Whether Codex, herdr and other clients accept it, and when a modern-era server is needed, is not verified.

## Standards read

- RFC 4251 (SSH architecture), section 4.1 *Host Keys*: the client must have a priori knowledge of the server's public host key; two trust models (a local database of host names and keys, or a certification authority). Read.
- RFC 4254 (SSH connection protocol), section 6.5 *Starting a Shell or a Command*: the `exec` request, and the requirement that precautions be taken to prevent the execution of unauthorized commands. Located and read in part.
- RFC 4252 (user authentication, public key) and RFC 4253 (transport): downloaded, **not read for this work**.
- GitHub docs, *Generating an installation access token for a GitHub App*: the token "will expire after 1 hour". Read.
- agents.md: "a README for agents", an open format used by many projects. Read (a convention, not a standards body's document).

## Headless and Ergonex (read in this checkout)

- `headless/src/surfaces/ssh-inbound` already generates the text of forced-command keys (`restrict,command="PROGRAM mcp"`, with `--read-only` for a key that may only read) and the `Match` block of `sshd_config`; it writes text and reads no file. `serve` and `stdioTransport` give the tool server; `opsfolio mcp` (in erga) is the model for a verb that serves the program's own tree by tier.
- Ergonex does **not** declare `kanon` in `library.ts`. Its `src/` has files at its root (`plan.ts`, `manifest.ts`, `policy.ts` and others) and folders `commands`, `host`, `modules`, `platform`, `setup` and others; Kanon units are folders, so making Ergonex a Kanon host means moving the root files into folders. Its module mechanism (`--ergonex-manifest`, `modules.auto.json` with a SHA-256) lets an external program `ergonex-<name>` be run as `ergonex <name>`.
- There is no `ergonex` namespace in `commons/ontology`: the `ergonex:` names in the specifications (`ergonex:Error`, `ergonex:GitManager`) are defined by the specifications. The terms of 0006 follow that convention.
- A plan has a hash and an evidence record names it (0002-workspace-model FR-042).

## Not verified

- Omarchy's package repository and its `pacman` definition; how Omarchy behaves on real hardware and with a desktop session.
- Whether Codex, herdr and other clients accept the legacy MCP revision; the contents of the herdr socket schema.
- The token formats of GitHub (not read); the text of `sshd(8)` for `command=` and `restrict`.
- Windows OpenSSH and macOS behavior: nothing was run.
- A full agent session in any harness: it needs an account.
