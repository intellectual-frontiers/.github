<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design-systems/frontiers-nature/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="design-systems/frontiers-nature/logos/if-logo-672x189-2026-Sept.png" width="336">
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

### Three repositories, one Eidolon

| Repository | Role | May contain |
| --- | --- | --- |
| `.github` (this one) | Public root | Public-tier facts, specs, ontology only |
| `eidolon` | Private vault | Every non-public spec and ontology individual; imports this ontology and never redefines it |
| `www.intellectualfrontiers.com` | Web property | Consumes both through an authenticated proxy |

A legal entity that holds third-party capital (a fund) gets its own separate
Eidolon (0001 FR-004). Persistence is plain Git on GitHub.

### Layout

```
profile/
  README.md         the public organization landing page
spec-kit/
  specs/            one testable spec per NNNN-slug, numbered independently
                    in each repository
ontology/
  ifcore.ttl        core company ontology (the ifcore: namespace)
  ifweb.ttl         web content shapes (the ifweb: namespace)
content/
  journal/          public content documents (the only content root)
design-systems/
  README.md         what a design system is and how to use any one of them
  <slug>/           one self-contained design system per directory,
                    registered in ifcore.ttl (0014-design-systems)
```

### The working order

Spec, then ontology, then everything else (0001 FR-037). Do not build ahead
of it. If you want to add something, ask which layer it is missing from.

1. **Spec.** Add or amend a spec first.
2. **Ontology.** Represent the new concept in `ontology/`.
3. **Implementation.** Only then write content, code, or process.

### Writing a spec

- Create `spec-kit/specs/NNNN-slug/spec.md`; take the next unused number.
- Follow the shape of the existing specs: title, `Spec ID`, `Status`, `Input`,
  then requirements as `FR-NNN` (`MUST` / `MAY` / `MUST NOT`), each testable.
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
| [0018](spec-kit/specs/0018-frontiers-console/spec.md) | Frontiers Console design system: operator and documentation surfaces |
| [0019](spec-kit/specs/0019-controlled-vocabulary/spec.md) | Controlled vocabulary: reuse an established term before inventing one |

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

[`design-systems/frontiers-nature/`](design-systems/frontiers-nature/) is the
canonical, public design system: tokens, CSS, fonts, logos (light and dark),
the hero and diagram images, favicon, and share card.
[`design-systems/frontiers-console/`](design-systems/frontiers-console/) is the
draft design system for operator (admin) and documentation surfaces. Every
design system carries an `assurance/` harness: open its `index.html` in a browser.

- Logos: `design-systems/frontiers-nature/logos/` (PNG masters; WebP in
  `logos/web/`). Use the `-dark-` variants on dark backgrounds.
- Images: `design-systems/frontiers-nature/images/`.
- Consumers **vendor a pinned copy** and never edit it downstream; change a
  design system only by amending its own source (0014).
- Reference assets from here by path rather than copying them, so there is one
  source of truth. In `profile/README.md` the images use absolute
  `raw.githubusercontent.com` URLs on `main`, because GitHub does not resolve
  relative paths on the organization profile page.

### Before you commit

- [ ] A spec exists for the change, and any spec it affects is amended.
- [ ] The ontology represents it, with an audience on every fact.
- [ ] No sensitive fact appears as a literal; nothing non-public is asserted.
- [ ] No duplicated facts; references point at the single source.
- [ ] Prefixes and "IF" naming follow FR-006 and FR-007.
- [ ] Logos and images are referenced, not copied; the design system is
      unedited downstream.
- [ ] Prose is in neutral company voice, outside the signed essays in
      `content/journal/`.
