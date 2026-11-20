<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="profile/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="profile/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

**Documentation: <https://intellectual-frontiers.github.io/.github/>** · **Strategy: [`MIZAN.html`](https://htmlpreview.github.io/?https://github.com/intellectual-frontiers/.github/blob/main/MIZAN.html)** (a rendered preview)

This public repository holds the organization's landing page ([`profile/README.md`](profile/README.md)), the one-command installers of agora ([`bin/`](bin/),
`agora-install.sh` and `agora-install.ps1`, which sign GitHub CLI in and run the installer of the private `erga` repository), and
[`commons/`](commons/about.ts), what any company or harness of Intellectual Frontiers may use. The documentation site is made from commons' TypeScript
and its specifications. Everything else lives in the private `erga` repository.

## Mizan: how we keep specifications, ontology and code in balance

*Mizan* (Arabic, "balance, scale") is the **IF Spec Profile**: a profile of [GitHub Spec Kit](https://github.com/github/spec-kit) that adds what Spec Kit lacks. Its aim is to reduce **drift**, the slow separation of what a specification says, what the ontology defines and what the code does. These are its tenets.

1. **Spec Kit is the method; Mizan is the profile.** We keep Spec Kit's commands, constitution and `spec.md` / `plan.md` / `tasks.md`, and add registers, requirement-to-proof tracing, the ladder and the rules below. We do not replace it.
2. **Two languages.** Natural language for specifications; TypeScript 7+ (Bun by default, Node 26 as backup) for the ontology, code, tools and tests. Where TypeScript cannot do an integration job and a hand-written parser would not be good enough, we choose the best tool for the job and record it as a typed exception.
3. **One strongly, algebraically typed ontology** in TypeScript on commons' RDF kernel. Turtle, RDF/XML, OWL, SHACL, JSON Schema, SKOS, SQL, SSSOM and an HTML view are generated from it, never edited. Four ontologies are published: `mz` (Mizan), `ifccm`, `ifqs` and `ifr`.
4. **Standards first.** We do not invent terms, schemas or ontologies where a consensus standard exists. Order: law, then US and NIST standards, then ISO standards, then broadly used vocabularies, then state and local standards where they do not conflict. First domains: NIST and FedRAMP, the FDA's QMSR (21 CFR Part 820) and 21 CFR Part 11.
5. **An invention is drift.** A term no standard backs is `unaligned`: it carries a justification and a typed `Decision` within 90 days, is counted, and the count only goes down.
6. **The ladder has 11 rungs.** Rungs 0 to 7 are required (ontology, specifications, governed data, data operations, infrastructure rules, business rules, application, documentation); 8 is the optional lifecycle; 9 is the observer, Evidence; 10 is the environment, the Workspace (`mz:RungKind`: required, optional, observer, environment). A rung relies only on the rungs below it that it names.
7. **Everything traces.** Source files name the requirements they implement, tests name what they prove, ontology terms name their specifications, and a specification names only terms the ontology defines.
8. **Warn first, never hide.** New rules start as warnings with a baseline that only shrinks. What only a person can judge is declared as reviewed, with the reason.
9. **AI-first, AI-native.** An agent reads `AGENTS.md`, the specification and the typed ontology; the deterministic checks, not the agent, judge whether the work is true to them.

Five products are specified in Mizan's form; four are built (Ergonex as a library of commons of its own) and the fifth, how works are versioned, is specified and has its ontology:

- **IFCCM**, Intellectual Frontiers Capabilities Configuration Management (`0020-ifccm`): the capability is the unit of change, and every commit names its issue on a line of its own (`Refs #N` or `Closes #N`). It starts as a warning and becomes a gate when a harness declares production. Run it with `bun commons/ts/tools/changes.ts`.
- **IFQS**, the Intellectual Frontiers Quality System (`0021-ifqs`, `0022-trust`), based on Operational Truth: one canonical OpenTelemetry record per test run, kept in an append-only, signed `quality` branch, with evidence grades E0 to E5, proof freshness, nonconformance and CAPA, and quality objectives. Tiers 0 and 1 are built; Tier 2 (assessor pack, Trust page, attestation) is in progress.
- **Ergonex**, the workspaces management of Intellectual Frontiers (`commons/ergonex/`, a library of commons with its own specifications, `0001-ergonex` to `0004-onboarding`): the one command, `ergonex`, that sets up and operates a team's repositories, tools and shell, on Windows, macOS and Linux, with Bun by default and Node 26 as the backup. It manages one workspace root (`$ERGONEX_HOME`) with the repositories laid out like their remotes, on GitHub, GitLab or plain Git behind one interface, and a plan that is shown before anything changes; it is the first real program on Headless (every command says what it may change; `--dry-run` previews, `--yes` confirms a destruction, and `ergonex explain <code>` says what a problem means), and `ergonex setup --dry-run` shows its plan before it changes the host. It is written for a person who has never set up a repository: `ergonex` on its own says what to do next in plain words, and `commons/ergonex/install/` holds the one-command installers for Windows (PowerShell, which installs Bun, Git and GitHub CLI with `winget`) and for macOS and Linux (`sh`, which asks Bun's own installer for the pinned Bun), and then run `ergonex init`. Ergonex keeps its files where the system keeps such things and in no folder of its own below your home: what it remembers (the state record, the evidence of every run) in `$XDG_STATE_HOME/ergonex`, what it installs (pinned tools) in `$XDG_DATA_HOME/ergonex` with their shims in `~/.local/bin` (on Windows `%LOCALAPPDATA%\ergonex`), macOS as Linux as `git` and `gh` do, and `ergonex paths` says where each is; only what you edit and other tools read (the manifest, the generated Git configuration, the hooks) is in `.ergonex/` beside your repositories, as `.vscode/` is. It is packed as one file that needs nothing installed beside it and is published to npm and to the GitHub package registry by a workflow on the tag `ergonex-v<version>`; it is MIT-licensed; the first publish and the npm scope are the owner's. It credits [chezmoi](https://www.chezmoi.io/) for ideas only; see [`commons/ergonex/CREDITS.md`](commons/ergonex/CREDITS.md).

  ```sh
  bunx @intellectual-frontiers/ergonex init      # the root, the starter manifest, and `ergonex` on your path for every terminal
  ergonex shell print bash                        # what a shell needs: the root, the tools, completions, `wcd`, and ERGONEX_GITHUB_TOKEN from `gh auth token`
  ergonex repos add github.com/owner/repo         # put a repository on the list, then `ergonex apply` clones it (`repos remove`, `repos delete`, `repos adopt` and `status` keep the list)
  ergonex doctor                                  # what is wrong, and what to do about it (`--fetch` also asks GitHub whether your token may read packages)
  ```

- **IFR**, Intellectual Frontiers Releases (`0026-works-versioning`): one scheme of version for each kind of work (Semantic Versioning for software, libraries, ontologies and schemas, the commit-date edition for published prose, a snapshot date for data, an integer revision with an approval for a controlled document, none for a specification), a release that is a signed annotated Git tag, and a ledger and release notes derived from the tags and from the capabilities closed. The ontology `ifr:` is built; the tool is next.

### Try Ergonex (acceptance test)

This assumes `@intellectual-frontiers/ergonex` is on npm. Do the steps in order on Windows first, then macOS, then Linux, and report for each step what you saw against what is written here. Nothing here changes anything outside your home folder and the folders `ergonex paths` names.

**1. What you need.** Git, the GitHub CLI signed in (`gh auth login`), and [Bun](https://bun.sh). On Windows: `winget install Git.Git GitHub.cli Oven-sh.Bun`. On macOS: `brew install git gh oven-sh/bun/bun`. On Linux: your package manager and `curl -fsSL https://bun.sh/install | bash`. Open a new terminal and check `git --version`, `gh auth status` and `bun --version`. Node 26 works in place of Bun (`npx` for `bunx`).

**2. Make the workspace.**

```sh
bunx @intellectual-frontiers/ergonex init
```

Expect: it names the folder it made (`workspaces` in your home folder, or `$ERGONEX_HOME`) with a `.ergonex/workspace.ts` inside, installs `ergonex` globally so every terminal finds it (open a new terminal if `ergonex` is not found: Bun's `bin` folder must be on your PATH, which Bun's installer does), and ends with "next: ergonex repos add github.com/owner/repo". Running it again changes nothing. `ergonex` on its own says in plain words what to do next.

**3. See where things go.** `ergonex paths` lists the workspace, `.ergonex/` (the manifest, the generated Git configuration and hooks: what you edit and other tools read), and three places that follow the system's conventions, with no `~/.ergonex`: state (what it remembers), data (the tools it installs, with shims in `~/.local/bin`) and cache. They are `$XDG_STATE_HOME/ergonex`, `$XDG_DATA_HOME/ergonex` and `$XDG_CACHE_HOME/ergonex`, defaulting to `~/.local/state`, `~/.local/share` and `~/.cache` on macOS and Linux (as `git` and `gh` do) and to `%LOCALAPPDATA%\ergonex` on Windows. Set one `XDG_*` variable and run `ergonex paths` again: the place moves, on Windows too.

**4. Set up your terminal.** `ergonex shell print bash` (or `zsh`, `fish`, `pwsh`, `nu`) prints the snippet: `ERGONEX_HOME`, the tools on the PATH, completions, `wcd`, and `ERGONEX_GITHUB_TOKEN` from `gh auth token` (never written to a file; `GITHUB_TOKEN` is never touched). `ergonex shell install bash` puts it in your shell's startup file (`--dry-run` shows the diff first; it never creates the file: if it is missing it prints the command that makes it; run that and `shell install` again), open a new terminal, and check the token begins `gho_` or `ghp_` (PowerShell: `$env:ERGONEX_GITHUB_TOKEN.Substring(0,4)`). The zsh, fish, PowerShell and Nushell snippets have been read, not run: that is what you are testing.

**5. Ask the doctor.** `ergonex doctor` lists what is right, and its closing lines say what is not and what to do about each (every problem has a code: `ergonex explain <code>`). Right after `init` it is normal to see "is not written yet; run `ergonex render`" for the generated files. Run `ergonex render`, then `ergonex doctor` again: the warnings go. `ergonex doctor --fetch` also asks GitHub whether your token may read the organization's packages.

**6. Add repositories.** `ergonex repos add github.com/octocat/Hello-World` records it in `.ergonex/repositories.ts` (no `https://` needed; `octocat/Hello-World`, `gitlab:group/sub/repo`, `git@github.com:o/r.git`, an https address or the address of a branch's page all work), and `ergonex apply` then clones it to `github.com/octocat/Hello-World` below your workspace. `ergonex plan` shows what would change and changes nothing, `ergonex apply` brings the workspace to it, and `ergonex status` lists each repository with its state. `ergonex repos remove octocat/Hello-World` takes it out of the list and leaves its folder; `ergonex repos delete` deletes the folder too (`--dry-run` shows it, `--yes` confirms), but only a clean, fully pushed one. Clone a repository by hand into the right path (or leave one from an older setup), run `ergonex adopt` to see it, and `ergonex adopt --apply` to add it. A private repository is the same command: it signs in with your Git credentials, `gh` or `ERGONEX_GITHUB_TOKEN`. `ergonex help` lists the rest.

**What to send me:** the step number, your operating system and shell, what you typed, and what you saw if it was not what is written here. The one-command installers in `commons/ergonex/install/` are an alternative for a machine with nothing installed.

**Status:** the specifications are `0003-mizan` and `0016` to `0026` in [`commons/spec-kit/`](commons/spec-kit/); all are Draft. Built and tested: M0 to M7 (the checks, importers and exporters, the four ontologies, IFCCM, the IFQS evidence record and Tier 1, and Ergonex, the workspaces manager, with its Git hosts, command, tools, setup, installers and published package, in which `repos add`, `repos remove`, `repos delete` and `repos adopt` keep the list of repositories; it replaced the earlier IFWS, which is removed); M9 (IFQS Tier 2) is in progress; M10 is these credits and the Decisions. Not yet verified: some tests on Windows, private repositories on GitHub and GitLab, and the zsh, fish, PowerShell and Nushell snippets (read, not run). Nothing here claims compliance with any regulation; it records evidence. The plan and its progress are in [issue #10](https://github.com/intellectual-frontiers/.github/issues/10), and the first audit is in [`commons/spec-kit/audits/`](commons/spec-kit/audits/2026-11-standards-audit.md). [`MIZAN.html`](https://htmlpreview.github.io/?https://github.com/intellectual-frontiers/.github/blob/main/MIZAN.html) is the full strategy and implementation document (a rendered preview of `main`).
