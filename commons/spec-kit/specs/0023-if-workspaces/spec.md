# Feature Specification: Intellectual Frontiers Workspaces

**Spec ID:** 0023-if-workspaces
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Intellectual Frontiers Workspaces (IFWS, `commons/ts/workspaces/`) is the managed place on a person's or an agent's computer where the repositories, worktrees, approved tools, policy and generated workspace files of Intellectual Frontiers live: one root, a layout that mirrors the Git remotes, paths that are valid on Linux, macOS and Windows alike, a plan that is shown before anything is done, and evidence of every run. It is rung 10 of the ladder (0016-ladder), the rung of the environment the other rungs are worked in. "Mizan" names only the specifications and ontology strategy this specification is written in; the product is IFWS and its command is `ifws` (0025-ifws).

## The workspace

- **FR-001**: The workspace MUST be one root folder, `$IFC_WORKSPACES_HOME`, which is `$HOME/workspaces` where the variable is not set (`%USERPROFILE%\workspaces` on Windows), and which `--home` overrides for one run; the root is the `ifws:Workspace`.
- **FR-002**: The workspace's own area MUST be `<home>/.if-workspaces/`, holding the typed manifest `workspace.ts`, the generated files (`*.auto.*`), the state record, the evidence records (`evidence/`), the installed tools (`tools/`), the Git hooks (`hooks/`) and `modules.auto.json`; nothing else of IFWS MAY be outside the repositories and worktrees.
- **FR-003**: IFWS MUST read and write only inside the root, with these exceptions, each opt-in and each the work of `ifws setup` alone (0025-ifws FR-017, FR-020): the shell snippet block and the global Git include of 0024-ifws-host, and the Windows long-path setting of 0025-ifws; it MUST NOT read a private key, a credential store or any file of `~/.ssh`.
- **FR-004**: IFWS MUST manage only the workspace: it MUST NOT be a dotfiles or user-profile manager, and the scope statement of `ifws` is that it manages only Intellectual Frontiers Workspaces, is not a general IFC or Mizan controller and does not front `ifc` (0025-ifws FR-002).
- **FR-005**: The library, its command and its templates MUST live in `commons/ts/workspaces/` and be on rung 10 of the ladder, whose kind is environment (0016-ladder FR-010); a rung below MUST NOT import it.

## Layout

- **FR-006**: A repository MUST be at `<home>/<git-host>/<path...>/<repo>`, which mirrors its remote URL: the host name in lower case, then the path of the remote as the host writes it, so that GitHub gives `github.com/<owner>/<repo>` and GitLab gives its groups to any depth.
- **FR-007**: A worktree MUST be at `<home>/.worktrees/<git-host>/<path...>/<repo>/<branch-slug>`, and IFWS MUST create one only where another person or agent, or uncommitted work, is on the repository; otherwise the repository's own checkout is the place to work.
- **FR-008**: IF a Git host or a path segment of a remote is named like a folder of the workspace (`.worktrees`, `.if-workspaces`, `.git`), THEN IFWS MUST refuse it and name it.

## Portability

- **FR-009**: A path segment MUST be a `PortableSegment`, a branded type made only by a function that refuses: an empty segment, `.` and `..`; the characters `<`, `>`, `:`, `"`, `/`, `\`, `|`, `?` and `*` and the control characters; a name ending in a dot or a space; a Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM0` to `COM9` and `LPT0` to `LPT9`, with the superscript digits in their place) in any case and with any extension; a name longer than 255 bytes in UTF-8; and a name that is not in Unicode normalization form NFC.
- **FR-010**: A path of the workspace MUST be a `RepoPath` or a path made from one, held with `/` between segments in data and given the native separator only where it meets the operating system.
- **FR-011**: IF two repositories, two worktrees or two generated files have paths that are equal after NFC and Unicode case folding, THEN IFWS MUST refuse both, on every file system, and name both.
- **FR-012**: WHILE long paths are not enabled on Windows, a path of the workspace longer than 259 characters (Windows' limit of 260 counts the terminating character) MUST be an `ifws:Error` naming the path.
- **FR-013**: IFWS MUST NOT create a symbolic link and MUST NOT need one, and a file that a symbolic link served in the earlier workspace tools (the VS Code workspace files) MUST be a generated `*.auto.code-workspace` file (0024-ifws-host FR-005).
- **FR-014**: IF the root is on FAT or exFAT (no execute bit, a two-second time resolution), on a network share (unreliable locks) or under WSL on a Windows drive (`/mnt/c`: slow, case-insensitive), THEN `ifws doctor` MUST report an `ifws:Warning` saying which and why, as found by a probe and never guessed from the path alone.

## Git hosts

- **FR-015**: The workspace MUST reach a Git host only through one `ifws:GitManager` interface, shaped at the same time for GitHub (public and private repositories), GitLab (public and private repositories, groups to any depth) and plain Git, and the interface MUST NOT be fixed until the three adapters pass the same conformance tests.
- **FR-016**: Every Git manager MUST offer the common capabilities: the clone URL of a repository and its path in the workspace (`ifws:CloneUrl`), authentication (`ifws:Credentials`), the default branch (`ifws:DefaultBranch`) and whether a commit's signature verifies (`ifws:SignedCommits`); and GitHub and GitLab MUST also offer protected branches (`ifws:ProtectedBranches`), issues (`ifws:Issues`) and pull or merge requests (`ifws:ChangeRequests`) behind the same calls.
- **FR-017**: A capability that a Git manager's kind does not list (`ifws:supports`) MUST be answered with a typed result that says it is unsupported, naming the manager and the capability, and MUST NOT be silently skipped, emulated or thrown: GitLab alone offers groups to any depth (`ifws:NestedGroups`), and plain Git offers no protected branches, issues or change requests.
- **FR-018**: A Git manager MUST authenticate through a Git credential helper, through the host's own command-line tool (`gh`, `glab`) or through a token read from the environment, and IFWS MUST NOT write a credential into any file, a remote URL or the evidence.
- **FR-019**: The kind of manager for a remote MUST be GitHub for `github.com`, GitLab for `gitlab.com` and for a host the manifest names as GitLab, and plain Git for every other host; a self-hosted GitLab MUST be named in the manifest and MUST NOT be guessed from a URL.
- **FR-020**: A repository whose path is deeper than its manager supports (more than two segments on a host without `ifws:NestedGroups`) MUST be refused with the manager and the path named.

## Plan and apply

- **FR-021**: IFWS MUST be a plan and an apply: `plan(desired, observed)` MUST be a pure function from the manifest and the observed state to an `ifws:Plan`, an ordered list of `ifws:Action`s, and MUST NOT read or write anything itself; the plan is a plan in the sense of PROV-O.
- **FR-022**: A repository MUST be observed as exactly one `ifws:RepoState` (`ifws:Missing`, `ifws:Clean`, `ifws:Dirty`, `ifws:Ahead`, `ifws:Behind`, `ifws:Diverged`, `ifws:Locked`, `ifws:Detached`, `ifws:WrongRemote` or `ifws:NotARepo`), and the plan's action for it MUST be the state's `ifws:defaultAction`: clone where it is missing, fast-forward where it is behind, refuse where it is on the wrong remote or not a repository, and skip, with the reason, in every other state.
- **FR-023**: Every action MUST be of one `ifws:ActionKind`: `ifws:Clone`, `ifws:FastForward`, `ifws:CreateWorktree`, `ifws:ConfigureRepo`, `ifws:ConfigureHost`, `ifws:WriteGenerated`, `ifws:RemoveGenerated`, `ifws:InstallTool`, `ifws:Skip` or `ifws:Refuse`, and a switch over them MUST be exhaustive.
- **FR-024**: A plan MUST change nothing, and `apply` MUST observe a repository again before each action on it and MUST NOT carry out an action whose observed state differs from the plan's, reporting it as skipped.
- **FR-025**: WHEN a plan has been applied and nothing has changed since, the next plan MUST hold only `ifws:Skip` actions.
- **FR-026**: The workspace MUST update a repository by fast-forward only: IFWS MUST NOT rebase, reset, merge, force or discard, and the plan MUST hold an `ifws:FastForward` only for a state that is `ifws:fastForwardable`, which is `ifws:Behind` alone.
- **FR-027**: IFWS MUST NOT delete a folder whose state `ifws:holdsLocalWork` (every state but `ifws:Missing`, `ifws:Clean` and `ifws:Behind`), nor a worktree with unpushed commits or uncommitted changes, nor a generated file whose bytes are not the ones the state record holds.
- **FR-028**: WHILE a Git lock file is present in a repository, the repository MUST be `ifws:Locked` and IFWS MUST NOT act on it or remove the lock; two runs of `ifws` on one workspace MUST NOT write at once, the second waiting or refusing with the first named.
- **FR-029**: An action of a kind that is `ifws:destructive` MUST appear in the plan and MUST NOT be carried out unless the run says `--allow-destructive`; without it the action is reported as skipped.
- **FR-030**: IFWS MUST NOT carry out an action of a kind with `ifws:hostChange` (`ifws:InstallTool`, `ifws:ConfigureHost`) in any run but `ifws setup --apply` (0025-ifws FR-017), and a plan made by any other command MUST NOT hold one.

## Policy

- **FR-031**: IF a managed file or setting holds a plaintext token (a personal access token of GitHub or GitLab, a password in a remote URL, an authorization header), THEN IFWS MUST report an `ifws:Error` naming the file and the line and MUST NOT print the secret; the scan MUST run on the generated files, the manifest and the local Git configuration of each repository, and no run is without it.
- **FR-032**: WHERE the manifest names a regulated domain (`ifws:regulatedDomain`), the policy MUST require signed commits (`ifws:requiresSignedCommits`, OpenPGP or SSH), a commit in a managed repository that is not signed and verified MUST be an `ifws:Error`, and the Git hooks MUST fail where they cannot check; elsewhere the same commit MUST be an `ifws:Warning`.
- **FR-033**: A tool or an `ifws-*` module that is not in the catalog MUST be an `ifws:Informational` finding from the day it is first seen and an `ifws:Warning` once it is more than `ifws:unapprovedGraceDays` (90) days old, the day recorded in the state record and never restarted by a later run.
- **FR-034**: The rules of branches and commits MUST be those of the IFCCM (`0020-ifccm`): every commit names an issue and a worktree's branch is named for its issue, and the workspace's hooks and `ifws worktree` MUST apply them without a rule of their own.
- **FR-035**: A finding MUST be an `ifws:Finding` with a rule identifier, an `ifws:Severity` (`ifws:Informational`, `ifws:Warning` or `ifws:Error`), a message, what it is about and the day it was first seen, and every command MUST be able to write its findings as a SARIF 2.1.0 log whose results have the level of the severity's `ifws:sarifLevel` (`note`, `warning`, `error`).
- **FR-036**: A message of `ifws doctor` MUST state what is wrong and what to do: that Windows long paths are not enabled is a message of `ifws doctor` (an `ifws:Informational` finding while no path exceeds the limit of FR-012, an `ifws:Error` once one does) and it MUST name `ifws setup` as the way.

## Tools

- **FR-037**: The tool catalog (`ifws:ToolCatalog`) MUST be in the manifest and MUST hold, for each `ifws:Tool`, its name, one pinned version (never `latest` and never a range), what it provides and, for each operating system and architecture, an `https` URL and a SHA-256.
- **FR-038**: IFWS MUST verify `git`, `bun` and `node` by a probe of their versions and MUST NOT install them; Bun is the default runtime, Node 26 the backup, and Deno is not a runtime of IFWS.
- **FR-039**: IFWS MUST install a tool only from a pinned artifact of the catalog, into `<home>/.if-workspaces/tools/<name>/<version>/`, after the SHA-256 of the downloaded bytes equals the pin, and MUST refuse, writing nothing, an artifact whose hash differs.
- **FR-040**: The catalog MUST be expressible as OSCAL `inventory-item`s and the inventory of what is installed as SPDX and as CycloneDX, so that the workspace's configuration and its tools can be given to an assessor in those forms.

## Evidence

- **FR-041**: Every run of every command MUST write one evidence record under `<home>/.if-workspaces/evidence/`, in the shape of an IFQS test record (`0021-ifqs`), named by the run's UTC time and identifier, never overwritten; a check that did not run is recorded as `not_run` with its reason.
- **FR-042**: An evidence record MUST name the command and its options, the plan's hash, the version of each tool probed or installed, the state record's hash, the findings and the exit status, and MUST NOT hold a credential or the content of a file.
- **FR-043**: WHERE the manifest names a regulated domain, the evidence of a run MUST name the version of every tool it used, so that the validation of the software used in the quality system, which 21 CFR Part 820 (the QMSR, incorporating ISO 13485:2016) requires and the FDA's Computer Software Assurance guidance describes, can cite it. Authority: mzid:authority-21-cfr-820.

## Vocabulary and standards

- **FR-044**: The terms of this specification MUST be the typed ontology `commons/ontology/ifws/` (prefix `ifws:`), whose every class and code-list class has an audit record of the standard it rests on, or of why none does (0018-standards-first FR-003 to FR-005), and whose code lists hold the keys named in this specification.
- **FR-045**: The workspace MUST support the controls CM-2, CM-3, CM-5, CM-6, CM-7, CM-8, CM-10, SA-10, SI-7 and IA-5 of NIST SP 800-53 (and the FedRAMP baselines that select them), and the section Standards and controls MUST name, for each, the requirement of this or of a sibling specification that supports it.
- **FR-046**: The workspace's documentation MUST credit the author of the earlier workspace tools, whose layout, `ensure`, `status` and `doctor` ideas and code it carries on, and chezmoi (inspiration for the source and target state, templates over data, `apply`, `diff`, `status`, `verify` and a state record, with no chezmoi code or program used), and MUST name Git's `git-foo` convention as the model of its modules.
- **FR-047**: A remote's identity MUST be its host name (lower case, with no port) and its path, so that the HTTPS, `git://`, `ssh://` and scp-like spellings of one remote name one repository and one path of the workspace; and a credential written into a remote URL (`https://user:token@host/...`) MUST be dropped on reading it and MUST NOT appear in any result, state, finding or message.

## Out of scope

- The command, its modules and exit codes: `0025-ifws`. The generated files, the hooks, the Git configuration and the shell snippet: `0024-ifws-host`.
- The rules of branches and commits: `0020-ifccm`. The shape of a test record: `0021-ifqs`.
- A user's profile: the global Git configuration, shell start-up files, SSH keys, editor settings and credential stores are not the workspace's.

## Standards and controls

- **CM-2 Baseline Configuration**: the manifest and its generated files (FR-002; 0024-ifws-host FR-001, FR-009).
- **CM-3 Configuration Change Control**: the plan before the apply and its evidence (FR-021, FR-024, FR-041).
- **CM-5 Access Restrictions for Change**: fast-forward only, protected branches and signed commits (FR-016, FR-026, FR-032).
- **CM-6 Configuration Settings**: the local Git configuration and the hooks path (0024-ifws-host FR-013).
- **CM-7 Least Functionality**: the tool catalog and the unapproved-tool finding (FR-033, FR-037).
- **CM-8 System Component Inventory**: the catalog and the inventory of what is installed (FR-037, FR-040).
- **CM-10 Software Usage Restrictions**: pinned versions and hashes, and no tool outside the catalog after 90 days (FR-033, FR-039).
- **SA-10 Developer Configuration Management**: the layout, the state of every repository, the issue named by every commit (FR-006, FR-022, FR-034).
- **SI-7 Software, Firmware, and Information Integrity**: the SHA-256 of every installed tool and generated file, and `ifws verify` (FR-039; 0024-ifws-host FR-010).
- **IA-5 Authenticator Management**: no credential in a file, and the plaintext-token scan (FR-018, FR-031).
- Also: FedRAMP baselines (which select these controls), the FDA's QMSR and Computer Software Assurance for software tools (FR-043), IEC 62304 (software configuration management), SLSA and OpenSSF Scorecard (source control and signed commits as practices), Git's signing formats (OpenPGP and SSH), SARIF 2.1.0 for findings (FR-035), OSCAL `inventory-item`, SPDX and CycloneDX for the tool inventory (FR-040) and PROV-O's Plan for a plan (FR-021).

## Edge cases

- A remote whose owner is `Org` and another whose owner is `org` on the same host: both refused on every file system, per FR-011.
- A repository named `con` or `aux.git`: refused with the Windows device name named, per FR-009.
- A branch whose name ends in a dot or holds a colon: its slug has neither, or the worktree is refused, per FR-009.
- A repository in a GitLab subgroup three levels deep: cloned at that path, per FR-006 and FR-020; the same path on GitHub: refused, per FR-020.
- A repository with uncommitted changes and a remote that moved on: skipped with the reason, never fast-forwarded, per FR-022 and FR-026.
- A repository whose folder holds another remote's clone: refused, never overwritten, per FR-022 and FR-027.
- A stale `index.lock`: the repository is locked, IFWS does not remove the lock, per FR-028.
- A workspace under `/mnt/c` in WSL: a warning from `ifws doctor`, per FR-014.
- A token pasted into a remote URL of the local Git configuration: an error naming the file and not the token, per FR-031.
- A tool found on the path that the catalog does not list: informational for 90 days, then a warning, per FR-033.
- A downloaded artifact whose hash is not the pin: refused and nothing written, per FR-039.

## Scenarios

- **Given** a workspace whose manifest names a repository that is not on disk, **When** `ifws plan` runs, **Then** the plan holds one `ifws:Clone` for it at the path that mirrors its remote and nothing has changed (FR-006, FR-021, FR-022, FR-024).
- **Given** a repository that is behind its remote and has no local change, **When** the plan is applied, **Then** the branch is fast-forwarded and a second plan holds only skips (FR-022, FR-025, FR-026).
- **Given** a repository with an uncommitted change, **When** its remote has new commits and the plan is applied, **Then** the repository is skipped with its reason and nothing in it is touched (FR-022, FR-026, FR-027).
- **Given** two remotes whose paths differ only in case, **When** the manifest is decoded, **Then** both are refused and named, on every file system (FR-011).
- **Given** a Windows workspace with long paths off and a repository whose path is 270 characters long, **When** `ifws doctor` runs, **Then** it reports an error naming the path and says that `ifws setup` can turn long paths on (FR-012, FR-036).
- **Given** a GitHub manager, **When** nested groups are asked for, **Then** the answer is that they are unsupported, naming GitHub and the capability (FR-017).
- **Given** a manifest that names a regulated domain, **When** a commit that is not signed is in a managed repository, **Then** `ifws doctor` reports an error, and where no domain is named it reports a warning (FR-032).
- **Given** a tool on the path that the catalog does not list, first seen 91 days ago, **When** `ifws doctor` runs, **Then** it reports a warning, and 89 days ago it reported an informational finding (FR-033).
- **Given** any command, **When** it ends, **Then** one evidence record is under `.if-workspaces/evidence/` and holds no credential (FR-041, FR-042).

## Assumptions

- The earlier workspace tools, kept private, are the origin of the layout and of the `ensure`, `status` and `doctor` behavior: their author is credited in the workspace's own documentation (FR-046), and nothing about them is in this repository but this credit.
- chezmoi (Tom Payne and contributors, MIT license) is credited as inspiration for ideas only; IFWS never calls it or depends on it (FR-046).
- `git`, `bun` and `node` are the user's own: IFWS verifies them and tells how to install them (FR-038).
- Pinned artifacts for each operating system and architecture are published by their projects with a checksum IFWS can pin (FR-039).

## Open questions

- **OQ-1**: How much room under a repository's path IFWS leaves for the files inside it before FR-012 calls a path too long; the limit is 259 characters for a file, and a repository's own files are not known when the path is chosen.
- **OQ-2**: Whether a regulated harness may waive the signed-commit rule for a bot account that signs through the host (GitHub's web-flow key), and under which record.
- **OQ-3**: The Decision records that justify each `unaligned` term of the ontology (0018-standards-first FR-005), written within their 90 days.

## Key entities

- **Workspace** - the root and everything under it (`ifws:Workspace`).
- **Repository, Worktree** - a clone at the path that mirrors its remote, and a worktree of it for one branch.
- **GitManager** - the one interface to GitHub, GitLab or plain Git.
- **Plan, Action** - the ordered steps that bring the workspace to its manifest; each step has a kind.
- **Finding** - what a check reports, with a severity.
- **Tool, ToolCatalog** - the pinned programs the workspace approves.
- **WorkspacePolicy** - what the workspace requires of itself.

## Success criteria

- **SC-001**: A person and an agent on Linux, macOS and Windows get the same layout from the same manifest, and a path that would break on one of them is refused on all.
- **SC-002**: A run never loses work that exists nowhere else, and every change it makes was shown in a plan first.
- **SC-003**: An assessor can read from the evidence records which tools, at which versions, were used on which day.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
