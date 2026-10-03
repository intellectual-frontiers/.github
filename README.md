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

Everything this repository's tools need is already in the workspace. There
is nothing to install and no `make install` (0024, 0025). Pick one:

1. **In your browser, nothing installed** (the default on macOS and
   Windows 11): [Open in GitHub Codespaces](https://codespaces.new/intellectual-frontiers/.github).
2. **On your own computer, in a container:** install
   [VS Code](https://code.visualstudio.com/) and
   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on
   Windows, with its WSL 2 backend), then
   [Open in Dev Containers](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/intellectual-frontiers/.github).
3. **On Linux or in a VM, without containers:** install
   [workspaces-host-v3](https://intellectual-frontiers.github.io/workspaces-host-v3/)
   and activate the `press` persona.

Whichever you pick, **log in to GitHub first.** When the workspace opens,
it asks you to (`gh auth login`); in a Codespace you are already logged
in. It then clones `.github`, `eidolon` and `www.intellectualfrontiers.com`
beside each other, from
[`.devcontainer/ws-repos.json`](.devcontainer/ws-repos.json).

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
tools/
  spec_check.py     checks specs and the register; CI runs it on every push
  reference-environment
                    the workspaces-host-v3 commit every tool is guaranteed
                    to run in (0025-tooling-environment)
.devcontainer/      the workspace this repository opens in, and the
                    repositories it clones beside it (0026-workspaces)
ontology/
  ifcore.ttl        core company ontology (the ifcore: namespace)
  ifweb.ttl         web content shapes (the ifweb: namespace)
content/
  journal/          public content documents (the only content root)
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
- Run `python3 tools/spec_check.py` before you push; CI runs it too.
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
| [0025](spec-kit/specs/0025-tooling-environment/spec.md) | Tooling environment: tools run anywhere their prerequisites are met, and always in workspaces-host-v3 |
| [0026](spec-kit/specs/0026-workspaces/spec.md) | Workspaces: one environment in several flavors; each repository's devcontainer, repository list, and GitHub login |

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
carries an `assurance/` harness; `tools/run_assurance.sh` runs them all, and CI
runs it on every push that touches `design-systems/`.

- Logos: `design-systems/frontiers-brand/logos/` (PNG; WebP in `logos/web/`).
  Use the `-dark-` variants on dark backgrounds.
- Pictures: the brand's imagery pool, `design-systems/frontiers-brand/imagery/`; app icons and the share card in
  `design-systems/frontiers-brand/images/`; figures are drawn with `design-systems/frontiers-figures/` (the
  profile's are made by `profile/figures/make.py`).
- Consumers **vendor a pinned copy** and never edit it downstream; change a
  design system only by amending its own source (0014).
- Reference assets from here by path rather than copying them, so there is one
  source of truth. In `profile/README.md` the images use absolute
  `raw.githubusercontent.com` URLs on `main`, because GitHub does not resolve
  relative paths on the organization profile page.

### Before you commit

- [ ] A spec exists for the change, and any spec it affects is amended.
- [ ] `python3 tools/spec_check.py` passes, and every new requirement has a
      row in `spec-kit/enforcement.tsv`.
- [ ] Any tool you add declares its prerequisites and installs nothing; it
      runs from a fresh clone in workspaces-host-v3 (0025).
- [ ] The ontology represents it, with an audience on every fact.
- [ ] No sensitive fact appears as a literal; nothing non-public is asserted.
- [ ] No duplicated facts; references point at the single source.
- [ ] Prefixes and "IF" naming follow FR-006 and FR-007.
- [ ] Logos and images are referenced, not copied; the design system is
      unedited downstream.
- [ ] Prose is in neutral company voice, outside the signed essays in
      `content/journal/`.
