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
3. **One strongly, algebraically typed ontology** in TypeScript on commons' RDF kernel. Turtle, RDF/XML, OWL, SHACL, JSON Schema, SKOS, SQL, SSSOM and an HTML view are generated from it, never edited. Four ontologies are published: `mz` (Mizan), `ifccm`, `ifqs` and `ifws`.
4. **Standards first.** We do not invent terms, schemas or ontologies where a consensus standard exists. Order: law, then US and NIST standards, then ISO standards, then broadly used vocabularies, then state and local standards where they do not conflict. First domains: NIST and FedRAMP, the FDA's QMSR (21 CFR Part 820) and 21 CFR Part 11.
5. **An invention is drift.** A term no standard backs is `unaligned`: it carries a justification and a typed `Decision` within 90 days, is counted, and the count only goes down.
6. **The ladder has 11 rungs.** Rungs 0 to 7 are required (ontology, specifications, governed data, data operations, infrastructure rules, business rules, application, documentation); 8 is the optional lifecycle; 9 is the observer, Evidence; 10 is the environment, the Workspace (`mz:RungKind`: required, optional, observer, environment). A rung relies only on the rungs below it that it names.
7. **Everything traces.** Source files name the requirements they implement, tests name what they prove, ontology terms name their specifications, and a specification names only terms the ontology defines.
8. **Warn first, never hide.** New rules start as warnings with a baseline that only shrinks. What only a person can judge is declared as reviewed, with the reason.
9. **AI-first, AI-native.** An agent reads `AGENTS.md`, the specification and the typed ontology; the deterministic checks, not the agent, judge whether the work is true to them.

Five products are specified in Mizan's form; four are built (Ergonex as a library of commons of its own) and the fifth, how works are versioned, is specified and has its ontology:

- **IFCCM**, Intellectual Frontiers Capabilities Configuration Management (`0020-ifccm`): the capability is the unit of change, and every commit names its issue on a line of its own (`Refs #N` or `Closes #N`). It starts as a warning and becomes a gate when a harness declares production. Run it with `bun commons/ts/tools/changes.ts`.
- **IFQS**, the Intellectual Frontiers Quality System (`0021-ifqs`, `0022-trust`), based on Operational Truth: one canonical OpenTelemetry record per test run, kept in an append-only, signed `quality` branch, with evidence grades E0 to E5, proof freshness, nonconformance and CAPA, and quality objectives. Tiers 0 and 1 are built; Tier 2 (assessor pack, Trust page, attestation) is in progress.
- **Ergonex**, the workspaces management of Intellectual Frontiers (`commons/ergonex/`, a library of commons with its own specifications, `0001-ergonex` to `0004-onboarding`): the one command, `ergonex`, that sets up and operates a team's repositories, tools and shell, on Windows, macOS and Linux, with Bun by default and Node 26 as the backup. It manages one workspace root (`$ERGONEX_HOME`) with the repositories laid out like their remotes, on GitHub, GitLab or plain Git behind one interface, and a plan that is shown before anything changes; `ergonex setup` is a dry run unless given `--apply`. It is written for a person who has never set up a repository, and is published to npm and to the GitHub package registry (the first publish is the owner's; see the package's notes). It credits [chezmoi](https://www.chezmoi.io/) for ideas only; see [`commons/ergonex/CREDITS.md`](commons/ergonex/CREDITS.md).

  ```sh
  bunx @intellectual-frontiers/ergonex init      # the root, the starter manifest, and `ergonex` on the path (init's path step is next)
  ergonex shell bash                              # what a shell needs: the root, the tools, completions, `wcd`, and ERGONEX_GITHUB_TOKEN from `gh auth token`
  ergonex doctor                                  # what is wrong, and what to do about it
  ```

- **IFWS**, Intellectual Frontiers Workspaces (the original, which Ergonex replaces and which is removed once Ergonex is tested) (`0023-if-workspaces`, `0024-ifws-host`, `0025-ifws`): the `ifws` command manages one workspace root, `$IFC_WORKSPACES_HOME`, with the repositories laid out like their remotes, on GitHub, GitLab or plain Git behind one interface, and a plan that is shown before anything changes. `ifws setup` is a dry run unless given `--apply`. It credits [chezmoi](https://www.chezmoi.io/) for ideas only; see [`commons/ts/workspaces/CREDITS.md`](commons/ts/workspaces/CREDITS.md).
- **IFR**, Intellectual Frontiers Releases (`0026-works-versioning`): one scheme of version for each kind of work (Semantic Versioning for software, libraries, ontologies and schemas, the commit-date edition for published prose, a snapshot date for data, an integer revision with an approval for a controlled document, none for a specification), a release that is a signed annotated Git tag, and a ledger and release notes derived from the tags and from the capabilities closed. The ontology `ifr:` is built; the tool is next.

**Status:** the specifications are `0003-mizan` and `0016` to `0026` in [`commons/spec-kit/`](commons/spec-kit/); all are Draft. Built and tested: M0 to M7 (the checks, importers and exporters, the four ontologies, IFCCM, the IFQS evidence record and Tier 1, and IFWS with its Git hosts, command, tools and setup, now ported to the library Ergonex, whose `init` path step, plain-words guidance, installers and clean-machine tests are next); M9 (IFQS Tier 2) is in progress; M10 is these credits and the Decisions. Not yet verified: some tests on Windows, private repositories on GitHub and GitLab, and the zsh, fish, PowerShell and Nushell snippets (read, not run). Nothing here claims compliance with any regulation; it records evidence. The plan and its progress are in [issue #10](https://github.com/intellectual-frontiers/.github/issues/10), and the first audit is in [`commons/spec-kit/audits/`](commons/spec-kit/audits/2026-11-standards-audit.md). [`MIZAN.html`](https://htmlpreview.github.io/?https://github.com/intellectual-frontiers/.github/blob/main/MIZAN.html) is the full strategy and implementation document (a rendered preview of `main`).
