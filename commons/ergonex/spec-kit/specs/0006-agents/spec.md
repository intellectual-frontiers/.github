# Feature Specification: Agents

**Spec ID:** 0006-agents
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A coding harness (Claude Code, Codex, herdr running them, or another) is given a machine over SSH. It should be able to install Ergonex there and then work in a well-known workspace: one command that says where the repositories are, what is pinned, what the harness may do and what it may not, that can be driven without a person, and that can be reached as a tool server over SSH. The reference environment is Omarchy (an Arch-based Linux that ships herdr and its own agent layer), run as a disposable virtual machine or on a spare machine for agentic work; Ergonex does not require it, and what differs by distribution is kept in one place. The research that this rests on, with what was run and what was not verified, is in `research.md`. The ticket is intellectual-frontiers/.github#25.

## The persona and the harness

- **FR-001**: Ergonex MUST know a persona (`ergonex:Persona`), the closed set `human` and `agent`, and MUST resolve it for a run from, in this order, the option `--persona`, the variable `ERGONEX_PERSONA`, the `persona` of the manifest and `human`; a word that is none of the two MUST end the run with `ergonex:Usage` naming both.
- **FR-002**: Ergonex MUST know a harness (`ergonex:Harness`), the closed set `claude-code`, `codex`, `herdr` and `other`, resolved from the option `--harness`, the variable `ERGONEX_HARNESS` and `other`, with an optional session identifier from `--session` or `ERGONEX_SESSION` (text of at most 128 characters with no control character); `herdr` names the runtime that hosts agents and not an agent, so that WHERE a run reports `HERDR_ENV=1` and a harness other than `herdr`, the evidence record MUST name both.
- **FR-003**: WHILE the persona is `agent`, a command MUST NOT prompt and MUST NOT read a terminal; WHERE it would ask, it MUST end with `ergonex:Usage` naming the option or the entry of the `agents` policy that answers the question; its default output MUST be the JSON envelope (`headless.envelope/1`), and the text form MUST be had only with `--text`.
- **FR-004**: WHILE the persona is `agent`, a command that changes the host or the workspace (`setup`, `apply`, `render` without `--dry-run` or `--check`, `repos add|remove|delete|adopt` without `--dry-run`, `worktree create|prune`, `remote bootstrap`) MUST be refused with `E-AGENT-DENIED` and the status `ergonex:Findings` unless the `agents` policy of the manifest allows it; a command that only reads MUST be allowed.
- **FR-005**: The manifest MUST take an optional typed `agents` policy: `allow` (a closed list of the command names of FR-004), `repos` (`"all"` or a list of remotes the persona may change), `tier` (`public`, `operator` or `administrator`, the ladder of Headless, `public` where absent), `commit` (the `name`, `email` and `trailer` of FR-008), `disposable` (a boolean) and `remote` (the list of hosts `remote` may reach); the decoder MUST refuse an unknown key and a value outside its set, naming the key, and an absent policy MUST mean that nothing of FR-004 is allowed.
- **FR-006**: WHILE the persona is `agent`, the evidence record of every run (0002-workspace-model FR-041) MUST also name the persona, the harness, the runtime where there is one and the session.
- **FR-007**: Ergonex MUST read the token for the Git host and the package registry from, in this order, `ERGONEX_GITHUB_TOKEN`, then the file named by `ERGONEX_GITHUB_TOKEN_FILE`, then the file `ergonex/token` of the configuration folder (`$XDG_CONFIG_HOME`, commons 0031-install-locations); a file MUST be refused where it is readable by anyone but its owner; a token MUST NOT be accepted as an argument of any command; no output (the report, the problems, the evidence record, the log, the answer of a tool) MUST hold the value of a token it read: it MUST be written `[secret]`; and WHILE the persona is `agent` a token found in the environment MUST be accepted for the run and `agent doctor` MUST give it as a warning, because a secret in the environment of an agent is an ambient secret (estate 0008-estate-workstations FR-015).
- **FR-008**: WHERE the `agents` policy gives a `commit`, `ergonex apply` MUST set `user.name` and `user.email` in the local Git configuration of each repository the policy lets the persona change, and the generated `commit-msg` hook (0003-host FR-014) MUST refuse, WHILE the persona is `agent`, a commit message that lacks the `trailer` line; `agent doctor` MUST give a warning where a repository it may change has no such identity.

## The brief

- **FR-009**: `ergonex agent brief` MUST be a report that changes nothing and gives the map of the workspace: the root and its area, each repository (path, remote, branch, state, worktrees), the pinned tools and whether each is present, the hooks, the policy including `agents`, the commands the persona may run and those it may not (FR-004), how to run the checks of each repository where its `AGENTS.md` says so, and the rules of commit of FR-008; in Markdown with `--format md` and in JSON with `--json`, with the same bytes for the same state, with no secret and no content of a repository's files but the lines it takes from `AGENTS.md`.
- **FR-010**: The Markdown of the brief MUST NOT be longer than 32 KiB (the size that Codex reads as instructions by default, `project_doc_max_bytes`), and WHERE the map is larger it MUST list the repositories by the time of their last change, newest first, and name how many it omitted.

## Writing the harness's files

- **FR-011**: `ergonex agent init --harness H [--scope user|project]` MUST write only the files that the adapter of the harness `H` names, MUST be a report with `--dry-run`, and MUST know the adapters `claude-code`, `codex`, `herdr` and `other` as a closed set, each reaching its harness only through the public files and commands of that harness (a file the harness reads, or its own command); the adapters MUST be instances of one port, `ergonex:HarnessAdapter`, and WHERE Ergonex becomes a Kanon host (OQ-1) they MUST be the instances of its Physical layer.
- **FR-012**: Every file `agent init` writes MUST be written whole beside the old one and renamed over it, MUST touch only what is its own (a block between two marker lines in Markdown, an entry of its own name in JSON and TOML, the keys it owns in a settings file) and MUST keep every other key, entry and hook, including those that another tool wrote, such as the `SessionStart` hook of herdr; run twice with nothing changed it MUST change nothing and say so; and it MUST write no secret.
- **FR-013**: The adapter `claude-code` MUST write the brief as a block of `AGENTS.md` and, WHERE there is no `CLAUDE.md` in the folder, a `CLAUDE.md` that imports it (`@AGENTS.md`); MUST register `ergonex mcp` as the server `ergonex` of `.mcp.json` with the absolute path of the installed command and add `ergonex` to `enabledMcpjsonServers` of the user's `~/.claude/settings.json`, so that a project server needs no interactive approval; and MUST add a `SessionStart` command hook that runs `ergonex agent brief --harness claude-code --format md` in under a second, its plain-text output being the context Claude Code adds.
- **FR-014**: The adapter `codex` MUST write the brief as a block of `AGENTS.md` (the project's, or `~/.codex/AGENTS.md` at the user scope) and the table `[mcp_servers.ergonex]` of `~/.codex/config.toml` or the project's `.codex/config.toml` with the `command` as the absolute path and a `startup_timeout_sec` of at least 30, and MUST NOT claim a server works from `codex mcp list`, which reads the configuration and does not connect.
- **FR-015**: The adapter `herdr` MUST make sure that herdr is installed by the checked installer of herdr or by `mise` (never by running a script it has not checked), MUST run `herdr integration install <agent>` for each coding agent on the `PATH` that herdr names, and MUST NOT write herdr's own files itself.
- **FR-016**: The adapter `other` MUST write only the block of `AGENTS.md`.
- **FR-017**: WHERE the host is Omarchy, the adapters MUST write the personal rules into the block of `~/.agents/AGENTS.md`, which Omarchy links into each harness that exists (`omarchy agent instructions`), and MUST NOT make the directory of a harness that was never used.

## The doctor

- **FR-018**: `ergonex agent doctor` MUST be a report that changes nothing and says, each as a finding of `ergonex:Error`, `ergonex:Warning` or `ergonex:Informational`: whether a token is there and may read packages (0004-onboarding FR-006) and, where its expiry is recorded (0006-agents FR-029), how long it has left; the Git identity (FR-008); the pinned tools; whether the registry and the Git host answer; which of the harnesses are installed and their versions; whether the configuration that `agent init` wrote is still there and agrees with the brief; whether `ergonex mcp` answers a handshake; and the state of jobs (FR-024).
- **FR-019**: `agent doctor` MUST say, as an informational finding, whether the machine is a disposable environment (`ergonex:DisposableEnvironment`: a virtual machine or container, or `disposable: true` in the policy); and WHERE the host is Omarchy and not disposable it MUST recommend, in these words, "run agents on a disposable Omarchy virtual machine or a spare machine, not on a machine you live in", and name the published virtual machine image and `omarchy-setup-security-sshd --key=KEY`, the Omarchy command that turns the SSH server on, as the way in.

## The tool server

- **FR-020**: `ergonex mcp` MUST serve the verbs of the program that the held tier may see as the tools of a tool server on standard input and standard output through the surface of Headless (`serve`, `stdioTransport`), with nothing else on standard output, the logs on standard error, the descriptions made from the command declarations and no second list of them, and MUST be the one way a harness reaches Ergonex as a server.
- **FR-021**: The tier of `ergonex mcp` MUST be the lower of the tier the policy gives (`agents.tier`, `public` where absent) and the tier of `ERGONEX_TIER`, and a call MUST be refused as a tool result with `isError` and a `refusal`, never a prompt, where the tier, FR-004 or the option `--read-only` (or `ERGONEX_READ_ONLY`) forbids it; and a destructive action MUST go only as a preview.
- **FR-022**: `ergonex agent keys line --public-key FILE --role read-only|full` MUST print, as text only and writing no file, the `authorized_keys` line that forces a key to `ergonex mcp` (with `--read-only` for the role `read-only`) and the `Match` block of `sshd_config`, made by `ssh-inbound` of Headless, and MUST refuse a text that is not one public key line without naming any part of it.
- **FR-023**: The tool server MUST answer the revision of the protocol that Headless serves (`2025-06-18`, with `initialize`), and MUST be proved with at least one client that Ergonex did not write (the verification plan); WHEN a client of the revision `2026-07-28` (no handshake) is found that does not accept the earlier one, the server MUST be made dual-era (OQ-3).

## Jobs

- **FR-024**: WHILE the persona is `agent`, a command run with `--job` MUST write a record of the job under `<workspace area>/jobs/<id>/` (a sortable unique identifier, the command line without any secret, its state `queued`, `running`, `succeeded`, `failed` or `abandoned`, its exit status and the path of its evidence record), MUST run in a process that has no controlling terminal and outlives the end of the SSH session that started it, and MUST print the identifier at once; `ergonex agent jobs list|show|wait|cancel` MUST read and act on them, `wait --timeout` ending with `ergonex:Pending` where the job has not ended.
- **FR-025**: A job that changes the host MUST be started only with the hash of the plan it carries out (`--plan-hash`, the hash `ergonex plan` printed, 0002-workspace-model FR-042), and a hash that is not the plan's MUST refuse it and change nothing.
- **FR-026**: WHEN a job is read and its process is not alive and it did not write an end, it MUST be `abandoned` and its record and evidence MUST stay, never be removed or made to look as if they succeeded.

## Reaching a machine

- **FR-027**: `ergonex remote bootstrap TARGET` and `ergonex remote run TARGET -- ARGS` MUST take a target as `ssh://user@host:port` or a host name of the SSH configuration, MUST refuse a target the policy's `remote` list does not name, and MUST reach it only with `BatchMode`, no terminal, `StrictHostKeyChecking=yes`, and a file of known hosts of its own (`<workspace area>/known_hosts`).
- **FR-028**: Before it reaches a host for the first time, `remote bootstrap` MUST have the host's key: from `--fingerprint SHA256:...` given by the caller, or, with `--trust-on-first-use`, from a scan whose fingerprint it prints and records; with neither it MUST refuse, ending with `ergonex:Usage` and printing the fingerprint so that it can be checked by another way; a changed key MUST refuse and say so (RFC 4251, section 4.1: the client must know the server's key beforehand).
- **FR-029**: `remote bootstrap` MUST: probe the host (`uname`, `/etc/os-release`, the architecture) and refuse root unless `--allow-root`; make sure Bun, or Node 26, is there as 0004-onboarding FR-008 says; install the pinned Ergonex of this version from the package registry by a script it sends over the SSH channel on standard input with its SHA-256 checked, never from an address of a script it has not checked; write the token to a file of mode `0600` from standard input (`--token-stdin`), never from an argument or the environment of the local command, with, where it is given, the expiry it records beside it (`--expires-at`); run `ergonex init --persona agent` with the policy of `--policy FILE`, which it decodes locally before sending; run `agent init` for each `--harness`; run `agent doctor --json` and return its report; and prove `ergonex mcp` by a handshake over the same SSH connection.
- **FR-030**: `remote bootstrap` run again with nothing changed MUST change nothing and say `unchanged` for each step, and with `--dry-run` it MUST probe the host and print the steps and change nothing; the token of a GitHub App installation lasts one hour, so `ergonex remote token refresh TARGET --token-stdin` MUST rewrite the file atomically, and the private key of the App MUST never go to the machine.
- **FR-031**: `remote run` MUST run exactly one `ergonex` command on the target without a terminal, bounded by `--timeout`, and give its status and its JSON envelope, and MUST refuse any other program unless the policy says `remote` may run raw commands.
- **FR-032**: Where the target is not Linux, `remote bootstrap` and `remote run` MUST refuse with `ergonex:Environment` naming the phase in which that system comes (macOS, then Windows OpenSSH) and change nothing.

## What differs by distribution

- **FR-033**: Everything that differs by distribution (the package manager, the service manager, how the SSH server is turned on, the `PATH` of a command run over SSH, how a distribution is recognized) MUST be behind one interface, `ergonex:Distro`, whose reference implementation is Omarchy and which has a generic fallback, and no other code MUST test for a distribution by name.
- **FR-034**: The Omarchy implementation MUST recognize Omarchy by `ID=omarchy` in `/etc/os-release` (read in Omarchy 4.5.0), MUST NOT rely on `OMARCHY_PATH` (the desktop session sets it and an SSH command does not), MUST put the installed `ergonex` where an SSH command finds it (`~/.local/bin`, which Omarchy puts on the `PATH` of SSH commands through `pam_env`) and write the absolute path into the files of FR-013 and FR-014 all the same, MUST install tools with `mise` and not with `pacman` unless the policy allows the package manager, MUST NOT treat a `mise` shim that exists as proof that a tool is installed (in Omarchy 4.5.0 `node`, `gh`, `claude` and `codex` are shims whose first run starts an install over the network) and so MUST ask `mise` which tools are installed without running a shim, and MUST NOT change a configuration of Omarchy that Omarchy's own commands own.

## Documentation

- **FR-035**: The site MUST have a how-to page, "Give an agent a machine", that explains the flow of FR-027 to FR-030, the policy, the tiers, the forced-command key and why a disposable Omarchy virtual machine or a spare machine is the place for agentic work, and an AI guide for an agent that is given a machine, each linking to the specifications and not copying them (commons 0011-documentation).

## Where it joins the program

- **FR-036**: This specification amends 0001-ergonex FR-030: the tree of the program MUST also hold the commands `agent` (`brief`, `init`, `doctor`, `jobs`, `keys`), `mcp` and `remote` (`bootstrap`, `run`, `token`), each declared as 0001-ergonex FR-007 says with its action (a report for `agent brief`, `agent doctor`, `agent jobs list|show|wait` and `agent keys line`; an action for `agent init`, `agent jobs cancel`, `remote bootstrap`, `remote run` and `remote token refresh`), and `ergonex mcp` MUST be reachable from the local channel and from SSH only.
- **FR-037**: This specification amends 0001-ergonex FR-022: every command MUST accept `--persona`, `--harness` and `--session`, resolved once at the boundary into a typed value, and the evidence record of 0001-ergonex FR-023 MUST carry them as FR-006 says; and it amends 0004-onboarding FR-004 and FR-006 for the persona `agent`: the token is read as FR-007 says, so that they hold on a machine on which `gh` is not signed in.

- **FR-038**: `ergonex agent register` MUST be an action that writes the declaration of this machine as an asset of the kind `workstation` (estate 0008-estate-workstations FR-020), origin `self`, state `adopted` unless the person gives another, with the attributes the probe-free facts give (`coordinator`, `persona`, `harnesses`, `agents-policy`, and `os-family` and `distro` from `/etc/os-release`), to `fleets/<fleet>/hosts/<id>.ts` of the tenant repository the person names, written whole beside the old one, and MUST refuse a name the estate does not accept or a file that is there already with other content.

## Acceptance scenarios

1. **Given** the persona `agent` and a manifest with no `agents` policy, **When** the harness runs `ergonex setup`, **Then** it is refused with `E-AGENT-DENIED` and nothing changes, and `ergonex status` still runs, per FR-003 and FR-004.
2. **Given** a manifest whose policy allows `apply` for one repository, **When** the persona runs `ergonex apply` and then `ergonex apply` again, **Then** that repository is cloned and the second run changes nothing, per FR-004 and FR-005.
3. **Given** `ERGONEX_GITHUB_TOKEN_FILE` naming a file readable by another user, **When** any command runs, **Then** it is refused naming the mode, and with the file at `0600` no output holds the value, per FR-007.
4. **Given** a workspace and a `.claude/settings.json` that already holds a `SessionStart` hook of herdr, **When** `ergonex agent init --harness claude-code` runs twice, **Then** the hook of herdr is still there, Ergonex's own entries are there once, and the second run says it changed nothing, per FR-012 and FR-013.
5. **Given** `codex` is installed and `ergonex agent init --harness codex` has run, **When** the server named in `config.toml` cannot start, **Then** `agent doctor` finds it by a handshake and `codex mcp list` is not the proof, per FR-014 and FR-018.
6. **Given** a key forced to `ergonex mcp --read-only`, **When** a client over SSH calls a tool that changes the host, **Then** it gets a tool result that refuses with the reason, and a tool that reads gives its answer, per FR-021 and FR-022.
7. **Given** a machine with an SSH server and a key, **When** `ergonex remote bootstrap ssh://agent@host:22 --fingerprint SHA256:... --token-stdin` runs, **Then** Ergonex is installed there, `agent doctor --json` is returned, `ssh host ergonex mcp` answers a handshake, and run again it says `unchanged`, per FR-027 to FR-030.
8. **Given** a host whose key differs from the pinned one, **When** `remote run` is tried, **Then** it refuses and no command runs, per FR-028.
9. **Given** `setup --job --plan-hash H` started over SSH and the SSH session ending, **When** the job is read later, **Then** it is `succeeded` or `failed` with its evidence, and with a hash that is not the plan's nothing is started, per FR-024 and FR-025.
10. **Given** an Omarchy host that is not a virtual machine, **When** `agent doctor` runs, **Then** it recommends a disposable Omarchy virtual machine and names `omarchy-setup-security-sshd`, per FR-019 and FR-034.
11. **Given** a target that is not Linux, **When** `remote bootstrap` runs, **Then** it refuses naming the phase, per FR-032.

## The alignment to standards

- **FR-039**: This specification MUST carry the alignment of its terms to the standards that name something near them (commons 0018-standards-first FR-001), each row saying what was read, how close the term is or that it is `unaligned`, and what was not verified.

  | Term | Standard and term | Relation | Verified |
  |---|---|---|---|
  | Tool server over standard streams (`ergonex mcp`) | Model Context Protocol, revision 2026-07-28, the stdio transport: newline-delimited JSON-RPC; the server writes only messages to `stdout` | `closeMatch` for the transport; the revision served is `2025-06-18` (FR-023) | the stdio and versioning pages of 2026-07-28 were read; the text of 2025-06-18 was not: its name is Headless' constant |
  | Host key pinned before the first connection (FR-028) | RFC 4251 (SSH architecture), section 4.1 *Host Keys* | `closeMatch` | read |
  | One command run on the machine (`remote run`) | RFC 4254 (SSH connection protocol), section 6.5 *Starting a Shell or a Command* (the `exec` request) | `closeMatch` | located and read in part |
  | Forced-command key (FR-022) | the `command=` and `restrict` options of `authorized_keys` in `sshd(8)` of OpenSSH | `closeMatch`, not verified | described by the `ssh-inbound` module of Headless; `sshd(8)` was not read here |
  | Brief and the block of `AGENTS.md` | the AGENTS.md convention ("a README for agents"), as Codex and Claude Code read it | `closeMatch` | agents.md, the Codex page on AGENTS.md and the Claude Code page on memory were read; it is a convention and not a standards body's document |
  | Token of a GitHub App installation (FR-029, FR-030) | GitHub's documentation of installation access tokens: they expire after one hour | `closeMatch` | read; the formats of GitHub's tokens were not read, so no pattern of them is a requirement here |
  | Persona, Harness | none found | `unaligned` | no standard was looked for beyond the sources above; a Decision of the owner is needed before either is a term of an ontology (OQ-2) |
  | Agent policy, Disposable environment, Job, Brief | none found | `unaligned` | as above |
  | Distro | none found for the interface; `ID=` in `os-release` is the file's own field (freedesktop.org os-release, not read here) | `unaligned`, the field not verified | `ID=omarchy` was read in a running Omarchy 4.5.0 |

## Verification plan

What runs against what, and what cannot be verified here. Each test names the requirement it proves (`proves`) and runs the real program.

| Requirement | Test | Runs against |
|---|---|---|
| FR-001 to FR-008, FR-009, FR-010 | the command tests of Ergonex | the real command on temporary workspaces, on Bun and Node 26 |
| FR-011 to FR-017 | file tests of each adapter, run twice | real files in a temporary home, including a `settings.json` that herdr's own installer wrote (the real herdr 0.9.5 binary) and a `config.toml` that `codex mcp add` wrote (the real Codex CLI) |
| FR-013 | `claude mcp list` after `agent init` | the real Claude Code CLI, which performs the handshake and reports `Connected` or `Failed to connect` (observed) |
| FR-014 | `codex mcp get` after `agent init`, and a handshake by a client of the official SDK | the real Codex CLI reads the configuration only (observed); the server is proved by the SDK client |
| FR-020 to FR-023 | a handshake, `tools/list` and calls by a client Ergonex did not write | the official TypeScript SDK client over a real SSH connection, and Claude Code's `mcp list` |
| FR-022 | the forced command refuses what it must | a real `sshd` and a real `ssh` client |
| FR-024 to FR-026 | a job survives the end of its SSH session | a real SSH session closed while the job runs |
| FR-027 to FR-032 | bootstrap, `unchanged` on the second run, a changed host key, a missing token, no network | a real `sshd` in a container (commons lab 0003-lab-arch-family) and in the real Omarchy virtual machine; a target that is not Linux needs no machine |
| FR-033, FR-034, FR-019 | detection by `ID=omarchy`, the `PATH` of a non-login SSH command, a shim that is not installed, the recommendation | the real Omarchy 4.5.0 virtual machine image (observed here: `ID=omarchy`, the `PATH`, the shims; software emulation, about two minutes to SSH; hardware acceleration on a machine with KVM is not verified) |
| FR-015 | the checked installer and the integrations | the real herdr 0.9.5 binary |

**Not verifiable here, and so never claimed:** a full agent session of Claude Code, Codex or herdr (it needs an account of each); herdr's remote machines against our host (they are herdr's own feature: this work does not exercise them); Omarchy on real hardware and with a desktop session; macOS and Windows OpenSSH (nothing was run); the GitHub App installation token itself (it needs the owner's App: the tests use a file with a made-up value and record that).

## Out of scope

- Running or supervising an agent, giving it a model or an account: that is the harness's.
- Installing Omarchy itself, or any change to Omarchy's own configuration.
- A graphical or mobile front end; herdr is that.
- macOS and Windows targets of `remote`: later phases.

## Edge cases

- Two harnesses on one machine: each adapter writes its own block and entry, and the `AGENTS.md` block is one, per FR-012.
- A `CLAUDE.md` that exists and does not import `AGENTS.md`: Claude Code reads only it, so the adapter adds the import line in a block of its own and never rewrites the file, per FR-012 and FR-013.
- `ERGONEX_PERSONA` set to `agent` in a login shell by mistake: the person's commands are refused with the answer FR-003 gives, which names `--persona human`.
- A token file that is a symbolic link to a file of another mode: the mode of the target is the mode, per FR-007.
- The SSH connection drops during `remote bootstrap`: the next run finds each step `unchanged` or finishes it, per FR-030.

## Assumptions

- The harness has SSH access to the machine with a key, as the person gave it; Ergonex does not make users or open ports (on Omarchy that is `omarchy-setup-security-sshd`).
- A harness that is run by a person on their own machine is the `human` persona: the persona is for an agent given a machine.

## Open questions

- **OQ-1**: Whether the harness adapters become a Kanon family (`ergonex-harness-<name>`, packages in the Physical layer of Ergonex). Ergonex does not declare `kanon` today and its root files are not in folders, so it would have to be restructured first; until it is, the adapters are folder instances behind one port (FR-011) so that they can be lifted. The owner leans to the family.
- **OQ-2**: Whether the `ergonex:` terms of this specification (Persona, Harness, Distro, Job, Agent policy, Disposable environment) become an ontology namespace `ergonex`. There is none today: the `ergonex:` names are defined by the specifications. Unaligned terms need Decisions of the owner.
- **OQ-3**: When the tool server must be dual-era. Claude Code 2.1.330 connected to the revision `2025-06-18`; Codex, herdr and other clients are not verified.
- **OQ-4**: Whether the adapter `herdr` is a harness at all: herdr hosts agents and the integrations are per agent. FR-002 and FR-015 treat it as the runtime, as the owner's list names it; the evidence records both.
- **OQ-5**: Who makes the installation token (the controller holds the App's private key and passes the token on standard input) and where that key lives: the owner's.
- **OQ-6**: Whether `claude-code` should register the server with `claude mcp add --scope user` where the command exists, instead of `.mcp.json` and `enabledMcpjsonServers`; both are documented ways.

## Key entities

- **Persona** - `human` or `agent` (`ergonex:Persona`).
- **Harness** - the program and runtime that drives Ergonex (`ergonex:Harness`).
- **Agent policy** - the `agents` part of the manifest: what the persona may change (`ergonex:AgentPolicy`).
- **Brief** - the map of the workspace for an agent (`ergonex:Brief`).
- **Harness adapter** - what writes one harness's files (`ergonex:HarnessAdapter`).
- **Job** - a long run that outlives its SSH session (`ergonex:Job`).
- **Distro** - what differs by distribution (`ergonex:Distro`).
- **Disposable environment** - a machine meant to be thrown away (`ergonex:DisposableEnvironment`).

## Success criteria

- **SC-001**: A harness given an SSH machine and a key installs Ergonex with one command, reads the brief and works through the tool server within its tier, and each step is proved by a test that names what it ran against.
- **SC-002**: Nothing the persona may not do can be done by it, and nothing a token holds is ever shown.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
