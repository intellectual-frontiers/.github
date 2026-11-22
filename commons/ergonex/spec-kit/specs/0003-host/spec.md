# Feature Specification: Ergonex host: typed templates, generated files and what is managed

**Spec ID:** 0003-host
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What Intellectual Frontiers Workspaces writes (0002-workspace-model) and how: the manifest as the source state, typed TypeScript templates that generate `*.auto.*` files, a state record that lets `ergonex verify` see a hand edit or a drift, the hooks and the local Git configuration of each repository, the shell snippet that is printed and never written unless asked, and the list of what is not managed. The ideas of source state and target state, templates over data, `apply`, `diff`, `status`, `verify` and a state record are chezmoi's, credited as inspiration; no chezmoi code, program or template language is used.

## Source state and target state

- **FR-001**: The source state MUST be the typed manifest `<home>/.ergonex/workspace.ts` (repositories, tool catalog, policy and the data the templates read, such as the Git identity and the groups of repositories), read once at the boundary by the kernel's decoder, and a manifest that does not decode MUST be reported as `ergonex:Error` findings naming each field and MUST stop the run before anything is changed.
- **FR-002**: The target state MUST be the `ergonex:Plan` made from the manifest and the observed state (0002-workspace-model FR-021), and Ergonex MUST NOT rewrite the manifest, which `ergonex setup` creates once, as a starter, where there is none.

## Typed templates

- **FR-003**: A template MUST be a TypeScript function from the decoded data to a list of generated files, and MUST NOT be text in a template language: Ergonex MUST have no template parser, no `eval`, no `new Function` and no interpolation of data into code, so that a template is type-checked and cannot inject.
- **FR-004**: A generated file (`ergonex:GeneratedFile`) MUST have a `RepoPath` inside the root (the type refuses `..`, an absolute path and a drive), its content, a mode of `0644` or `0755` and a header, in the comment syntax of its format (a `_generated` member in JSON), naming its generator and saying it is not to be edited; its name MUST carry `.auto.`, except a Git hook, whose name Git fixes and which lives in `hooks/`.
- **FR-005**: The templates MUST generate, from the manifest: a `<group>.auto.code-workspace` file at the root for each group of repositories the manifest names, `AGENTS.auto.md` at the root (FR-022), `<home>/.ergonex/tools.auto.json` (the resolved tool catalog), `<home>/.ergonex/modules.auto.json` (the registered modules), the hooks (FR-014) and, where FR-023 allows, `.envrc.auto`.
- **FR-006**: A `*.auto.code-workspace` file MUST list each folder of its group by a path relative to the file, with `/` between segments, so that it opens the same on every operating system and no symbolic link is needed.
- **FR-007**: A generated file MUST be deterministic: the same data MUST give the same bytes, with no time, no host name, no user name and no absolute path of the user's computer in its content, in UTF-8 without a byte-order mark, with LF line endings and one final newline, whatever the operating system.
- **FR-008**: A generated file MUST NOT be committed into a repository that is not the workspace's own, and Ergonex MUST NOT write one inside a repository's working tree.

## The state record, verify and render

- **FR-009**: The state record (`ergonex:StateRecord`) MUST be `<state>/state.auto.json`, in the state folder of commons 0031-install-locations, decoded as typed data, and MUST hold the path, the SHA-256 and the generator of each generated file as it was written, the hash of the last plan, the version of Ergonex, and the day each tool or module outside the catalog was first seen.
- **FR-010**: `ergonex verify` MUST compare the disk with the record and the record with what the templates give now, and MUST report: a generated file whose bytes differ from the record (a hand edit) as an `ergonex:Error`, a recorded file that is missing, an `.auto.` file the record does not hold, and a file the templates would now write differently (a drift) each as an `ergonex:Warning`; it MUST change nothing.
- **FR-011**: IF a generated file's bytes differ from the state record, THEN `render` and `apply` MUST NOT overwrite or remove it and MUST report it as refused with its path, unless the run says `--force`.
- **FR-012**: `ergonex render` MUST write the generated files, and `ergonex render --check` MUST write nothing, name each file that would change and end with the exit status `ergonex:Findings`, and `--dry-run` MUST show the difference as a unified diff.

## Git configuration and hooks

- **FR-013**: Ergonex MUST set Git's configuration only in each managed repository's own local configuration, each setting an `ergonex:ConfigureRepo` action of the plan: `core.hooksPath` as the absolute path of `<home>/.ergonex/hooks` with `/` between segments, the commit signing the policy requires (`commit.gpgsign`, `gpg.format` as `openpgp` or `ssh`, and the key the manifest names), `user.name` and `user.email` where the manifest names them, and on Windows `core.longpaths`; it MUST NOT write to the global or the system configuration, and MUST NOT remove a setting it did not set.
- **FR-014**: The hooks MUST be generated into `<home>/.ergonex/hooks/` as POSIX `sh` scripts of mode `0755` (Git for Windows runs hooks with its own `sh`): `pre-commit` (the plaintext-token scan of the staged changes, 0002-workspace-model FR-031), `commit-msg` (the issue named by every commit, `commons 0020-ifccm`) and `pre-push` (signed commits where the policy requires them), each running its checker with the runtime of the workspace.
- **FR-015**: A hook MUST only read: it MUST NOT change the commit, the tree or the configuration, and MUST NOT use the network; and IF a hook cannot run its checker, THEN it MUST exit non-zero and say why where the manifest names a regulated domain, and exit zero with the same message on standard error elsewhere.
- **FR-016**: WHERE the user asks with `ergonex setup --git-include`, Ergonex MUST add to the user's global Git configuration one marked `[include]` of a file generated in the workspace, after showing the exact change and asking, and MUST NOT otherwise read or write it; this and FR-019 are the only writes outside the root, besides the Windows long-path setting (0001-ergonex FR-017).

## The shell snippet

- **FR-017**: `ergonex shell print <bash|zsh|fish|pwsh|nu>` MUST print the snippet for that shell on standard output and nothing else, MUST write no file and change nothing, and MUST exit 2 for another shell.
- **FR-018**: The snippet MUST do four things and no more, besides the token of 0004-onboarding FR-004 and the short name of FR-027: export `ERGONEX_HOME` where it is not set, add `~/.local/bin` (on Windows, `<data>/tools/bin`), where the shims of the pinned tools and of the `ergonex-*` modules are, to the `PATH`, define the completions of `ergonex`, and define one function, `wcd`, that changes to a repository of the workspace by its name.
- **FR-019**: `ergonex shell install` MUST write one block (and with `--dry-run` show it as a unified diff) between the lines `# >>> ergonex >>>` and `# <<< ergonex <<<` in the shell's start-up file (`~/.bashrc`, `~/.zshrc`, `~/.config/fish/conf.d/ergonex.fish`, the PowerShell `$PROFILE`, or the Nushell `config.nu`, or the file `--rc` names) and ask, MUST write only after a yes (and exit 2 where there is no terminal and no `--yes`), MUST leave one block where it is run twice, and `--uninstall` MUST remove exactly that block and nothing else.

## What is not managed

- **FR-020**: Ergonex MUST NOT read, write or manage, outside FR-016, FR-019 and the Windows long-path setting: the global and system Git configuration (`~/.gitconfig`, `$XDG_CONFIG_HOME/git`, `/etc/gitconfig`), any shell start-up file, `~/.ssh`, the settings of an editor or an IDE, a credential store, the user's environment variables or `PATH` as the system stores them, a system package manager, or any file outside the root.

## Not a dependency

- **FR-021**: Ergonex MUST NOT import, run or require chezmoi, or any program that templates dotfiles; the credit in 0002-workspace-model FR-046 is for the ideas.

## Generated guidance

- **FR-022**: `AGENTS.auto.md` MUST tell an agent the layout of the workspace, its rules (plan before apply, fast-forward only, one issue for every commit, no credential in a file) and its commands, from the manifest, with no secret and no absolute path of the user's computer.
- **FR-023**: `.envrc.auto` MUST be generated only where the manifest says `direnv` is wanted and a probe finds `direnv`, and it MUST only add `~/.local/bin` to the `PATH`.
- **FR-024**: The templates MUST also generate `lefthook.auto.yml` at the root, which calls the three generated hooks by their relative path and holds no checker of its own, for a person who runs lefthook in the workspace's own repository.
- **FR-025**: A generated hook MUST run `ergonex hook <name>` with `--home` the root it finds from its own place (it holds no absolute path), MUST send what it prints to standard error, and MUST read its status as 0 (go on), 1 (stop) or anything else (it cannot run its checker, FR-015).
- **FR-026**: `ergonex shell install` MUST NOT create a start-up file that does not exist: where the shell's start-up file is absent it MUST write nothing and say how to create it (the command to run and the path), and `--uninstall` MUST NOT create one either.
- **FR-027**: The snippet MUST also define `enx` as a short name for `ergonex` (an alias of the shell, or for Nushell the equivalent) and register for `enx` the completions of `ergonex`, and only where no other program, alias or function named `enx` is found: the shells that can ask at the time the snippet is sourced (bash, zsh, fish, PowerShell) MUST ask then and define nothing where something is found, and Nushell, whose aliases are fixed when a file is read, MUST be told by `ergonex shell print` and `shell install`, which look for a program named `enx` on the `PATH` when they run, and MUST leave the alias out, saying so in a comment, where one is found. The short name is a contribution of this snippet and nothing else: `ergonex` stays the name of the command, of its library, of its environment variables, of the hooks and the generated files it writes, and of every document; there is no program named `enx`. An alias exists only in an interactive shell that sourced the snippet, so a script, a hook, a non-interactive `ssh host command` and an agent MUST use `ergonex`, and the documentation of the snippet MUST say so. The marked block of `shell install` and `shell uninstall` MUST stay the one block of FR-019 and both MUST stay safe to repeat.
- **FR-028**: `ergonex doctor` MUST report every program named `enx` that it finds on the `PATH` (`which -a`): where there is one, a warning that names each path and says that the short name of FR-027 is defined only where none is found and that `ergonex` always works; where there is none, an `ok` that says the short name is free. A program found on the `PATH` MUST NOT be run, renamed or removed.

## Out of scope

- The command's modules, discovery and exit codes: `0001-ergonex`. The layout, portability, plan and policy: `0002-workspace-model`.
- The rules of commits and branches the hooks enforce: `commons 0020-ifccm`.

## Edge cases

- A template that returns a path with `..` or a drive: its file does not type-check as a `RepoPath` and the run stops before writing, per FR-004.
- A hand-edited `AGENTS.auto.md`: `ergonex verify` reports an error, `render` refuses to overwrite it, and `render --force` replaces it, per FR-010 and FR-011.
- Two generated files whose paths differ only in case: refused as in 0002-workspace-model FR-011, per FR-004.
- A repository whose local configuration already sets `core.hooksPath` to another folder: replaced by `ergonex:ConfigureRepo` and shown in the plan, per FR-013.
- `ergonex shell install` run twice: one block, per FR-019.
- `ergonex shell print nu` where the user's rc file already has text around the block: that text is not touched on `ergonex shell uninstall`, per FR-019.
- A workspace on Windows where a file is CRLF after a checkout: a generated file is LF, and `verify` compares bytes, per FR-007.
- A manifest field of the wrong type: reported with its path and nothing is written, per FR-001.

## Scenarios

- **Given** a manifest that names two groups of repositories, **When** `ergonex render` runs, **Then** two `*.auto.code-workspace` files are at the root, each listing its folders by relative paths, and no symbolic link is made (FR-005, FR-006).
- **Given** a rendered workspace, **When** `ergonex render --check` runs and nothing has changed, **Then** it writes nothing and exits with no findings, and after the manifest changes it names the files that would change (FR-012, FR-007).
- **Given** a generated file edited by hand, **When** `ergonex verify` runs, **Then** it reports an error naming the file, and `ergonex render` leaves the file as it is (FR-010, FR-011).
- **Given** a managed repository, **When** the plan is applied, **Then** its local configuration holds the hooks path and nothing is written to the user's global Git configuration (FR-013, FR-020).
- **Given** a regulated manifest and a machine with no `bun` or `node`, **When** a commit is made, **Then** the `commit-msg` hook fails with the reason (FR-014, FR-015).
- **Given** a shell name, **When** `ergonex shell print bash` runs, **Then** the snippet is on standard output, no file has changed, and the snippet holds the four things and no other (FR-017, FR-018).
- **Given** a start-up file with other text, **When** `ergonex shell install bash` and later `ergonex shell uninstall bash` run, **Then** the file is again as it was (FR-019).

## Assumptions

- chezmoi's ideas are credited and not used as code: the typed templates are TypeScript functions because a function is checked by the compiler and a template language is not (FR-003, FR-021).
- Git for Windows ships `sh`, which runs the hooks on Windows (FR-014); a Windows machine without Git for Windows has no Git to configure.
- A group of repositories in the manifest replaces the symlinked workspace files of the earlier tools (0002-workspace-model FR-013).
- The generated hooks run the TypeScript the library holds with Bun or Node 26 until a compiled checker exists (owner decision of 2026-11-17, issue #10).
- This specification is Active from 2026-11-17: the requirements it does not yet prove say so in the enforcement register.

## Open questions

None.

## Key entities

- **Manifest** - the typed source state, `workspace.ts`.
- **GeneratedFile** - a file a template makes, with its path, content, mode and header.
- **StateRecord** - the hashes of what was written, and the first-seen days.
- **Hook** - a generated script Git runs before a commit or a push.
- **Snippet** - the lines `ergonex shell print` prints for a shell.

## Success criteria

- **SC-001**: A hand edit or a drift of any generated file is found by `ergonex verify`, and no run overwrites a hand edit without `--force`.
- **SC-002**: Nothing outside the workspace changes unless the user asked for it and saw the exact change first.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
