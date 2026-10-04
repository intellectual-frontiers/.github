<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design-systems/frontiers-brand/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="design-systems/frontiers-brand/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

This is the public root of Intellectual Frontiers' Eidolon: the company's own
account of what it is and how it works, specified rather than merely
described. The organization's public landing page is
[`profile/README.md`](profile/README.md).

This file has two parts: [a plain-English account](#what-an-eidolon-is) of the
idea behind the repository, and [a guide for editors and
maintainers](#for-editors-and-maintainers).

---

## What an Eidolon is

An **Eidolon** is a working digital reflection of a person, company, customer,
product, or system. It is not a replica. It is enough grounded evidence for an
AI to reason about the real thing accurately and flexibly. The concept is the
founder's own authored research; the system in this repository is the
company's first working instance of it.

### The problem

Organizations describe themselves in prose: a website, a deck, a one-pager, a
founder's memory of what was decided and why. Prose drifts. A page says the
company does five things; by the time a reader, or an AI, encounters it, the
company does three of them, differently, for different reasons. A person can
sense that something is stale. An AI usually cannot, and will reason
confidently from the stale version.

An Eidolon inverts the usual order. Instead of writing a description and
hoping it stays true, it asserts **facts** — discrete, dated, sourced, each
carrying its own visibility — and lets descriptions be generated from, or
checked against, those facts.

### Specs + ontology + work

We think the best shape for any AI-native deliverable has three parts, always
made in this order:

1. **Specs say what must be true.** A spec is a short, numbered, testable
   statement of intent: "the public root MUST contain only Public-tier
   facts." Because each requirement is testable, a person or an AI can check a
   deliverable against it instead of guessing what the author meant. Specs
   live in [`spec-kit/specs/`](spec-kit/specs/).
2. **The ontology says what things are.** The ontology is the shared,
   typed vocabulary: what a Unit, a Work, a Decision, a Right, an Audience, a
   Reference is, and how they relate. It reuses established standards (W3C
   PROV, schema.org, SKOS, Dublin Core) rather than inventing terms, so an AI
   does not have to infer what "asset" or "decision" means in this company. It
   lives in [`ontology/`](ontology/).
3. **Work is what gets made.** Books, websites, research records, skills,
   spoken works, ventures: the deliverables. Each is produced against the
   specs and typed against the ontology, so it can be audited — why does this
   exist, what rule shaped it, what does it claim, who may see it.

The order is not a preference; it is a rule (spec
[0001](spec-kit/specs/0001-eidolon-architecture/spec.md), FR-037). A new
capability is established in a spec before it is represented in the ontology,
and in the ontology before it is implemented anywhere else. Each layer is
only as good as the one before it: an ontology with no spec is vocabulary
without intent, and work with no ontology is prose again, ready to drift.

Why this suits AI in particular:

- **AI needs grounding, not eloquence.** A model briefed from typed facts with
  declared sources reasons about the company the way a well-briefed person
  would. A model briefed from a brochure repeats the brochure.
- **AI needs a stopping rule.** Specs say where the work is done and where
  human judgment resumes (for example, where AI's role stops in Research &
  IP, spec [0006](spec-kit/specs/0006-research-and-ip/spec.md)).
- **AI needs to know what it may say.** Every fact declares its audience, so
  an AI producing a public document cannot silently pull in something
  confidential.
- **People need to audit the result.** The test of an Eidolon is not how
  elegant the ontology looks, but whether an AI reasoning from it reaches the
  conclusion a well-briefed person would, and whether a person auditing it
  can find out why.

### What makes it hold together

- **A vocabulary before any content.** Terms are agreed before facts go in.
- **A confidentiality model that isn't a ladder.** Audiences overlap
  (public, anyone affiliated, a specific agreement, a specific role) and a
  fact may belong to several; clearance for one does not imply another.
- **A hard line between what we assert and what we merely watch.** A patent's
  status belongs to the patent office, not to our own saying-so. We hold a
  *reference* with a verification date and cadence, not a copy of the value.

The longer essay is
[`content/journal/eidolons.html`](content/journal/eidolons.html).

---

## For editors and maintainers

### Start working

This repository's tools install themselves. A computer needs only `python3`
(3.11 or later) and [`uv`](https://docs.astral.sh/uv/); there is no
`make install` and no environment to prepare (0024, 0025).

1. Install `python3` and `uv`.
2. Clone this repository and run `./agora doctor`, then `./agora check`.
   `agora` fetches the Python packages its commands need from hashed locks,
   and every other program (a typesetter, a browser) into a per-user cache,
   verified by checksum, the first time a command needs it. Nothing found on
   your computer is used unless you opt in by name.
3. Optionally, work in VS Code with the IF Console extension (0043): a tree
   of the commands, findings in the Problems panel, a diff before any write.
   The command line is the core; the extension only runs it.

A prepared workspace (`workspaces-host`, on Debian or Ubuntu, including under
WSL) is another way to set up a machine and clone the sibling repositories. It
is a convenience: nothing here requires it (0026).

### Three repositories, one Eidolon

| Repository | Role | May contain |
| --- | --- | --- |
| `.github` (this one) | The public Eidolon | Public-tier facts, specs, ontology only |
| `eidolon` | The private Eidolon, and the monorepo where works are made | Every non-public spec and ontology individual, and every work's package; imports this ontology and never redefines it |
| `www.intellectualfrontiers.com` | One presentation channel | Presents works through an authenticated proxy; holds no work of its own |

A **work** is the deliverable itself; a book, a web page, an episode, a
keynote, a course, or a skill is a **presentation** of it (0021). Public
presentations lead with what works found, made, or proved, never with how
the company is organized.

A legal entity that holds third-party capital (a fund) gets its own separate
Eidolon (0001 FR-004). Persistence is plain Git on GitHub.

### Layout

```
profile/
  README.md         the public organization landing page
spec-kit/
  specs/            one testable spec per NNNN-slug, numbered independently
                    in each repository
  enforcement.tsv   what enforces each requirement, or none (0020-spec-format)
  controls.tsv      which compliance control each requirement addresses
                    (0028-compliance-controls)
agora               the orchestrator: one launcher (needs only uv and Python 3)
                    that runs every check, build and record in this repository
                    (0041-command-line, 0042-agora); CI calls only it
tools/
  agora/            agora's code: core, lib, groups/<group>/ (each with its
                    agora.toml, and an agora.lock where it pins packages, until
                    each moves to code and uv.lock, 0042 OQ-3), and tests/
  if-console/       the IF Console VS Code extension's source (0043-if-console);
                    built by agora, no runtime dependencies
.claude/
  skills/agora/     SKILL.md, the agent skill agora generates from its registry
                    (0042-agora FR-028)
tools/reference-environment, .devcontainer/
                    files for an optional workspace that nothing requires and
                    that are removed (0025 FR-025, 0026 OQ-1, 0042 OQ-3)
ontology/
  ifcore.ttl        core company ontology (the ifcore: namespace), including
                    agora's command set
  ifweb.ttl         web content shapes (the ifweb: namespace)
content/
  journal/          public content documents (the only content root)
.agora/
  logs/             agora's untracked action logs (gitignored, 0041 FR-042)
  proposals/        changes proposed for a person to decide (tracked)
design-systems/
  README.md         what a design system is, its kinds, and how to use any one
  <identity>-<kind>/ one self-contained design system per directory, of one
                    kind (web, print, written-voice, ...), registered in
                    ifcore.ttl; its spec.md states its house rules
                    (0014-design-systems)
```

### The working order

Spec, then ontology, then everything else (0001 FR-037). Do not build ahead
of it. If you want to add something, ask which layer it is missing from.

1. **Spec.** Add or amend a spec first.
2. **Ontology.** Represent the new concept in `ontology/`.
3. **Implementation.** Only then write content, code, or process.

### Writing a spec

- Create `spec-kit/specs/NNNN-slug/spec.md`; take the next unused number.
- Follow [`0020-spec-format`](spec-kit/specs/0020-spec-format/spec.md): title,
  `Spec ID`, `Status`, `Input`, then requirements as `FR-NNN` (`MUST` / `MAY`
  / `MUST NOT`), then `Out of scope` (optional), `Edge cases`, `Assumptions`,
  `Open questions`, `Key entities`, `Success criteria`, and the review
  checklist. Each edge case cites the requirement that resolves it; one that
  nothing resolves is an open question.
- Never renumber or reuse a requirement number; a new one takes the next
  unused number in its spec.
- Status is `Draft` (in force, open to amendment), `Adopted` (amended only by
  the decision authority or with its approval), or `Superseded by
  NNNN-slug`. Only the decision authority moves a spec between them, in a
  commit that says so.
- Add a row to [`spec-kit/enforcement.tsv`](spec-kit/enforcement.tsv) for
  every new `FR-NNN`: `check`, `gate`, `review`, or `none`, and what does it.
  Record `none` honestly; the check lists every one on every run.
- Run `./agora check --suite spec` before you push; CI runs it too.
- Cite other specs by ID and FR (for example, "0001 FR-016"). Do not restate
  their rules.
- When a spec changes the meaning of an earlier one, amend the earlier spec in
  the same commit.
- Decisions that need a record follow the pattern in
  [`0008-decision-records`](spec-kit/specs/0008-decision-records/spec.md).

| Spec | Subject |
| --- | --- |
| [0001](spec-kit/specs/0001-eidolon-architecture/spec.md) | The Eidolon: topology, namespaces, confidentiality, facts and references |
| [0002](spec-kit/specs/0002-content-format/spec.md) | Content format: one strictly parsed HTML5 file, typed against the ontology |
| [0003](spec-kit/specs/0003-intellectual-frontiers/spec.md) | The company: units, Native Alpha, the Find–Prove–Decide–Compound method |
| [0004](spec-kit/specs/0004-addressing/spec.md) | Addressing: file path to URL, resolved across public root and vault |
| [0005](spec-kit/specs/0005-authentication/spec.md) | Authentication and authorization; audience grants |
| [0006](spec-kit/specs/0006-research-and-ip/spec.md) | Research & IP: research-to-rights chain, and where AI's role stops |
| [0007](spec-kit/specs/0007-work-and-assets/spec.md) | Work and assets, on W3C PROV |
| [0008](spec-kit/specs/0008-decision-records/spec.md) | Decision records |
| [0009](spec-kit/specs/0009-press/spec.md) | Press: claim labeling, voice, evidence |
| [0010](spec-kit/specs/0010-capital/spec.md) | Capital: allocation and underwriting |
| [0011](spec-kit/specs/0011-studios/spec.md) | Studios: venture lifecycle and evidence |
| [0012](spec-kit/specs/0012-network/spec.md) | Network: search practice and candidate evidence |
| [0013](spec-kit/specs/0013-web-content-kinds/spec.md) | Web content kinds beyond `Page` |
| [0014](spec-kit/specs/0014-design-systems/spec.md) | Design systems |
| [0015](spec-kit/specs/0015-work-packages/spec.md) | Work packages: how a Substantial Work is held |
| [0016](spec-kit/specs/0016-press-production/spec.md) | Press production: books and series as work packages |
| [0017](spec-kit/specs/0017-spoken-and-research-works/spec.md) | Spoken works and research records |
| [0019](spec-kit/specs/0019-controlled-vocabulary/spec.md) | Controlled vocabulary: reuse an established term before inventing one |
| [0020](spec-kit/specs/0020-spec-format/spec.md) | Spec format, status, and the enforcement register |
| [0021](spec-kit/specs/0021-works-and-presentations/spec.md) | Works and presentations: the deliverable apart from its forms; not shipping the organization |
| [0022](spec-kit/specs/0022-domain-names/spec.md) | Domain names: assets apart from what they serve; registry facts by reference; DNS as code |
| [0023](spec-kit/specs/0023-domain-security/spec.md) | Domain security: a baseline every domain carries, checked automatically, departed from only by decision |
| [0024](spec-kit/specs/0024-persistent-addresses/spec.md) | Persistent addresses: published and printed URLs, the ontology's namespaces, and identifiers that outlive them |
| [0025](spec-kit/specs/0025-tooling-environment/spec.md) | Tooling environment: tools install themselves; a host needs only python3 and uv; hashed Python locks and a toolchain lock fetched into a verified per-user cache; no workspace required |
| [0026](spec-kit/specs/0026-workspaces/spec.md) | Workspaces: an optional convenience; one flavor, Debian-family bare metal with VS Code; sibling repositories, fast-forward-only updates, and trust |
| [0027](spec-kit/specs/0027-course-works/spec.md) | Course works: a subject taught at length as a work, its bible, its source in frontiers-course's form, and where it runs as a Decision |
| [0028](spec-kit/specs/0028-compliance-controls/spec.md) | Compliance controls: frameworks as control catalogs, a boundary per legal entity, requirements mapped to controls, departures by decision, evidence, and assessors |
| [0029](spec-kit/specs/0029-government-registrations/spec.md) | Government registrations: federal award, cybersecurity affirmation, tax and state filings held by reference, with expiry reported |
| [0030](spec-kit/specs/0030-policies/spec.md) | Policies: thin specs that cite the rules carrying them out, approved by adoption, reviewed yearly, acknowledged without personal detail |
| [0031](spec-kit/specs/0031-access-control-policy/spec.md) | Access control: one account per person, second factors, least privilege, ninety-day access reviews |
| [0032](spec-kit/specs/0032-endpoint-and-media-policy/spec.md) | Endpoints and media: managed devices, malicious code protection, media sanitization, physical access |
| [0033](spec-kit/specs/0033-systems-and-data-policy/spec.md) | Systems and data: the system inventory, data classes and their handling, separation from the internet, logs |
| [0034](spec-kit/specs/0034-secure-development-policy/spec.md) | Secure development: version-controlled changes, vulnerability fix times, software bills of materials |
| [0035](spec-kit/specs/0035-incident-response-policy/spec.md) | Incident response: reporting, records, notification deadlines, containment, and review |
| [0036](spec-kit/specs/0036-risk-management-policy/spec.md) | Risk management: the risk register, yearly and triggered assessments, lapsing acceptances |
| [0037](spec-kit/specs/0037-vendor-management-policy/spec.md) | Vendor management: the vendor register, vendor assurance by reference, terms, reviews, and exit |
| [0038](spec-kit/specs/0038-personnel-security-policy/spec.md) | Personnel security: conduct, conflicts of interest, screening, training, joining and leaving |
| [0039](spec-kit/specs/0039-business-continuity-policy/spec.md) | Business continuity: recovery objectives, separated backups, restore tests, copies of the Eidolon |
| [0040](spec-kit/specs/0040-security-program-policy/spec.md) | Security program: the policies as one program, yearly oversight, communication, independent assessment |
| [0041](spec-kit/specs/0041-command-line/spec.md) | A repository's orchestrator: launcher and uv's files, a registry in code, typed commands, resources in three renderings, surfaces (the command line, IF Console, MCP) by category, a toolchain lock, Git as the only record |
| [0042](spec-kit/specs/0042-agora/spec.md) | agora: the public root's orchestrator, its command set, checks, generators, toolchain, and CI |
| [0043](spec-kit/specs/0043-if-console/spec.md) | Intellectual Frontiers Console (IF Console): the VS Code extension that is every orchestrator's secondary interface |

Each design system's house rules are a spec too, kept in its own directory
and named by its slug rather than a number: for example
[`frontiers-console-web`](design-systems/frontiers-console-web/spec.md)
(0020 FR-018).

The format is derived from [GitHub Spec Kit](https://github.com/github/spec-kit)'s
spec template, not a full use of Spec Kit. Specs here are standing rules
rather than per-feature documents, so there is no `plan.md`, `tasks.md`, or
feature branch; the ontology plays the data model's part, open questions
(`OQ-N`) replace inline clarification markers, and the enforcement register
replaces Spec Kit's consistency analysis. 0020 states each difference.

### The orchestrator

`agora` (the public square) is this repository's one orchestrator: every
check, build and record runs through it, and CI calls nothing else. The name
says what it is for, an orchestrator for what is public; it differs from any
other orchestrator's name at a glance and by any one typo, and it reads well in
a prompt (0042-agora FR-002). It reads nothing outside this repository.

- Run `./agora check` for every check, `./agora check --suite spec` for the
  spec, register and ontology checks, `./agora check --suite browser`, `python` or
  `images` for the design systems' harnesses, each brand's imagery and its Open edX
  package (they need programs from the host: Node and Chromium, TeX Live and
  poppler, ImageMagick; a harness whose program is missing is skipped, never
  passed, and the run exits 3), `./agora check --changed` for only the sections whose
  watched paths changed, `./agora fresh` to prove generated files are current,
  `./agora doctor` for what is missing, `./agora test` for its own tests, `./agora lock
  [GROUP]` to write the lock, and `./agora context RESOURCE` (such as
  `context spec:0020`) for what an agent needs to work on one resource. Every command
  takes `--json` and, if it writes, `--dry-run`.
- A command is `agora <noun> <verb> [ID] [--options]`. `agora command list` and
  `agora command show COMMAND` list every command with its category, arguments and
  surfaces, and `.claude/skills/agora/SKILL.md` says the same to an AI agent; both
  come from the registry. By noun (a `decision` command is for a person):

  | Noun | Commands |
  | --- | --- |
  | `spec` | `list`, `show`, `new`, `set --status` (decision) |
  | `requirement` | `list`, `show`, `set`, `add --control` |
  | `term` | `list`, `show` |
  | `design-system` | `list`, `show`, `new --kind` |
  | `brand` | `list`, `show`, `generate` |
  | `imagery` | `list`, `show`, `build`, `add` |
  | `decoration` | `show`, `generate` |
  | `ink` | `list`, `show`, `record` (decision) |
  | `openedx` | `generate`, `build` |
  | `layout` | `list`, `show`, `build` |
  | `figure`, `deck`, `email`, `media`, `sign` | `build`; `figure` also `generate` |
  | `course` | `show`, `build` |
  | `environment` | `show`, `set` |
  | `proposal` | `list`, `show`, `new`, `advance` (decision) |
  | `skill` | `generate` |
  | `command` | `list`, `show` |
  | `mcp` | `serve` |

- The design systems' own scripts stay in their directories and `agora` calls them:
  `agora deck build`, `email build`, `course build`, `media build`, `sign build` and
  `figure build` build what they build, `agora layout list|show|build` reads the print
  layouts, and `agora check figures|voice|slides|email|course|media|signage|merchandise
  --scope PATH` checks a piece of work with a design system's own rules (with no
  `--scope`, each checks that design system's passing fixtures).
- The launcher needs only `uv` and Python 3. Python packages come from
  committed locks (`tools/agora/groups/<group>/agora.lock`, moving to uv's `uv.lock`), and
  `AGORA_OFFLINE=1` (or `--offline`) makes it download nothing; programs outside
  Python (TeX, Chromium, ImageMagick, potrace, rsvg-convert, Node) come from the
  host, and `doctor` says which are missing (0025 FR-013, 0041).
- Git is the only record: `agora` never commits or pushes. What changes or runs
  something and is not worth a commit (a check, a build, a dry run, an MCP call)
  goes to untracked logs in `.agora/logs/`; reads are not logged. An agent that wants
  a decision made drafts it with `agora proposal new`, a tracked file in
  `.agora/proposals/` that a person accepts with `agora proposal advance`.
- The graphical interface is the VS Code extension `workspaces-host` ships: it shows
  the resources agora returns, and runs their actions by calling agora, with a modal
  confirmation a person must click for any decision (0041 FR-050, FR-051). agora runs
  no server. `./agora mcp serve` serves its commands and the repository's resources to an AI agent
  over standard input and output, a write a dry run unless it says otherwise, and never
  a decision, which only a person makes.
- To add a command: spec first (0042), then its individual in the ontology, then
  its code in a group under `tools/agora/groups/`.

### Editing the ontology

- Prefixes: `ifcore:` (core), `ifweb:` (web content shapes), `ifpriv:`
  (private vault). Never a bare `if:`. In prose, branding, and documentation
  the acronym is always **IF** (0001 FR-006, FR-007).
- Every fact declares its audience(s). An undeclared audience defaults to the
  most restrictive (FR-011, FR-012). In this repository, everything must be
  `ifcore:Public`.
- Reuse established vocabulary (PROV, schema.org, SKOS, Dublin Core) before
  inventing a term, and cite the spec and FR that justifies each addition in
  its `rdfs:comment`.
- Never redefine in the vault what this ontology declares.

### Facts and references

- A fact has exactly one authoritative source. Everywhere else holds a
  reference, never a duplicate value (FR-019).
- Authoritative source outside our control (a registry, a counterparty's
  record): use an `ExternalRecordReference` with its primary-source location,
  and if a cached value is held, its last-verified date, cadence, and method
  (FR-022, FR-024). Overdue references default to the founder (FR-025).
- Sensitive fact: use a `RestrictedDataReference`. It has no field that can
  hold the value, and never holds a credential (FR-021, FR-023).

### The sensitivity test

Before committing any fact, apply FR-016. A fact is sensitive, and so may not
appear as a literal here or in the vault, if it is (a) a third party's
confidential information we are bound to protect, (b) personally identifying
information about a real individual, (c) something whose wider internal
visibility creates legal or security risk, or (d) a personal financial term of
an individual inside the company. If unclear, treat it as sensitive (FR-018).
This repository is public: nothing of any other classification may be
asserted here, however it is labeled (FR-002).

### Content documents

Pages under `content/` are single, strictly parsed HTML5 files carrying a
JSON-LD block typed against the ontology, with an `ifcore:hasAudience`
declaration (0002, 0013). `content/` is the only content root (0004).

### Brand assets and design systems

[`design-systems/frontiers-brand/`](design-systems/frontiers-brand/) holds the
palette, unit colors, typefaces, logo (light and dark), icon, app icons, unit marks,
the imagery pool, the share card and the decoration kit; it themes every other design
system. The others, one directory each and listed with their kinds in
[`design-systems/README.md`](design-systems/README.md): the web
(`frontiers-nature-web`, `frontiers-console-web`), print (`frontiers-print`,
`frontiers-signage-print`), figures (`frontiers-figures`), slides (`frontiers-slides`),
media (`frontiers-media`), email (`frontiers-email`), courses (`frontiers-course`), merchandise
(`frontiers-merchandise`) and the house voice (`frontiers-written-voice`,
`frontiers-spoken-voice`). Every public house rule about how Intellectual Frontiers
looks, reads or sounds belongs in a design system of its kind here too (0014). Every design system
carries an `assurance/` harness that runs on its own; `agora check design-systems`
runs them all, and CI runs `agora check --suite browser`, `--suite python` and `--suite images`
on every push that touches `design-systems/`.

- Logos: `design-systems/frontiers-brand/logos/` (PNG; WebP in `logos/web/`).
  Use the `-dark-` variants on dark backgrounds.
- Pictures: the brand's imagery pool, `design-systems/frontiers-brand/imagery/`; app icons and the share card in
  `design-systems/frontiers-brand/images/`; figures are drawn with `design-systems/frontiers-figures/` (the
  profile's are written by `agora figure generate`, the `profile-figure` generator).
- Consumers **vendor a pinned copy** and never edit it downstream; change a
  design system only by amending its own source (0014).
- Reference assets from here by path rather than copying them, so there is one
  source of truth. In `profile/README.md` the images use absolute
  `raw.githubusercontent.com` URLs on `main`, because GitHub does not resolve
  relative paths on the organization profile page.

### Before you commit

- [ ] A spec exists for the change, and any spec it affects is amended.
- [ ] `./agora check --suite spec` passes, and every new requirement has a
      row in `spec-kit/enforcement.tsv`.
- [ ] Any command you add is declared in `agora`'s registry and in the
      ontology, and `./agora check commands` passes; it declares its
      prerequisites and installs nothing; it runs from a fresh clone in
      workspaces-host (0025, 0041, 0042).
- [ ] The ontology represents it, with an audience on every fact.
- [ ] No sensitive fact appears as a literal; nothing non-public is asserted.
- [ ] No duplicated facts; references point at the single source.
- [ ] Prefixes and "IF" naming follow FR-006 and FR-007.
- [ ] Logos and images are referenced, not copied; the design system is
      unedited downstream.
- [ ] Prose is in neutral company voice, outside the signed essays in
      `content/journal/`.
