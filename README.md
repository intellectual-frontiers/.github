# Intellectual Frontiers — `.github`

This repository specifies a company. Not describes it: specifies it, the
way GitHub's SpecKit specifies a piece of software — a governing
constitution, testable requirements instead of values language, a
version number, and a Constitution Check any new plan has to pass before
it starts.

## Specifying a company

Most companies write their values down once and rarely touch them again.
Intellectual Frontiers treats its own operating doctrine the way it
treats a research thesis: specific enough to check, likely wrong
somewhere, and cheap enough to correct in public git history rather than
in memory.

The idea underneath this repository isn't that AI tools can also manage
company documents. It's that Native Alpha's own discipline — find, prove,
decide, compound — is already spec-driven thinking, just applied to
business judgment instead of code. Spec-kit's actual mechanism is a
constitution that gates every plan, a spec written before any plan
exists, and a Constitution Check a plan has to pass before work starts.
That maps onto Native Alpha's discipline directly, so this repository
borrows spec-kit's format for the company itself:
[`spec-kit/memory/constitution.md`](spec-kit/memory/constitution.md) is
the governing doctrine, [`spec-kit/specs/`](spec-kit/specs/) holds one
testable spec for the company and one for each of its five units, and
[`spec-kit/templates/`](spec-kit/templates/) is what a new venture,
research program, or fund decision builds on top of.

Writing the company as testable requirements found things a values
statement wouldn't have. Turning "every unit has a job" into a MUST
surfaced that no unit actually has a named individual lead — a real gap
against an existing rule, not a missing one. Turning "the company shares
services" into a testable claim forced an actual decision about whether
that was even true yet, rather than letting it stay a good idea.
[`0001-intellectual-frontiers/spec.md`](spec-kit/specs/0001-intellectual-frontiers/spec.md)'s
Open Questions section is the honest record of both, still open.

If this is useful to try on another company: start with one unit, not
the whole thing.
[`spec-kit/templates/spec-template.md`](spec-kit/templates/spec-template.md)
and [`spec-kit/AGENTS.md`](spec-kit/AGENTS.md) are the two files that
port over most directly — the template forces testable requirements
instead of values language, and the Constitution Check in
[`spec-kit/templates/plan-template.md`](spec-kit/templates/plan-template.md)
is what keeps a plan honest about which of the company's own principles
it actually satisfies, rather than which ones it merely cites.

## What this repository is

1. **The GitHub org profile.** [`profile/README.md`](profile/README.md) is
   the card GitHub renders on
   [github.com/intellectual-frontiers](https://github.com/intellectual-frontiers).
2. **The public knowledge base about the company.** [`context/`](context/)
   holds the company's own account of what it is, what it does, and how its
   five units relate — legal facts, the brand book, unit charters, and a
   glossary of the terms all of it uses.
3. **The corporate SpecKit.** [`spec-kit/`](spec-kit/) holds the
   constitution, one spec per unit plus one for the company as a whole,
   and the templates a unit-specific or venture-specific SpecKit builds
   from — see "How it fits together" below.

## How it fits together

- **The constitution** is governing doctrine, not testable requirements —
  principles, with a version number
  ([1.2.0](spec-kit/memory/constitution.md) as of this writing) so a
  downstream spec can note what it was written against and re-check
  itself when the constitution changes.
- **Context** ([`context/`](context/)) is the company's public account of
  itself: legal facts, the brand book, each unit's charter, a glossary of
  defined terms, and the writing rules any prose here follows, including
  prose an AI agent drafts.
- **Specs** ([`spec-kit/specs/`](spec-kit/specs/)) turn the constitution
  and the unit charters into testable MUST / MUST NOT requirements — one
  for the company, one per unit — each citing what it depends on instead
  of restating it.
- **Templates** ([`spec-kit/templates/`](spec-kit/templates/)) are what
  the next spec or plan gets built from. A plan can't proceed until its
  Constitution Check passes.
- [`spec-kit/AGENTS.md`](spec-kit/AGENTS.md) is the entry point for an AI
  agent, or a person, about to write a new spec or plan against this
  constitution — including how a unit-specific or venture-specific
  SpecKit is meant to inherit from this one without redefining it.

## Canonical source, going forward

This repository — not `intellectualfrontiers.com` or the Lovable-managed
repo that publishes it — is the canonical source for the material under
`spec-kit/` and `context/`. The website should sync its copy of the
doctrine, brand book, and company facts from here.

The one exception is anything generated from a primary external record:
patent and trademark counts, USPTO filing data, and similar live
registers stay owned by the website's own sync pipeline against USPTO
and other authorities, because that pipeline is closest to the primary
source. [`context/registers.md`](context/registers.md) explains where
that line sits and links out rather than duplicating numbers — the same
treatment `context/units/capital.md` gives fund sizes and
`context/company.md` gives its non-disclosure policy (no resident agent,
address, phone, headcount, revenue, financing, or ownership percentages).

Most of this repository was originally distilled from the Lovable repo's
typed content as it stood on 2026-09-13, then deepened from fuller
content on the live site (commit `adf0aef`, 2026-09-14) — some of it
deliberately low-visibility on the site itself, summarized here at the
same depth as everything else rather than fully reproduced. Shahid N.
Shah has since amended the constitution directly, twice, and supplied
three system diagrams (in [`assets/diagrams/`](assets/diagrams/)) and the
Maryland registry facts in `context/company.md` directly rather than
through either source. Every file says where its own content came from,
in its own header — that note is about where the text originated, not
about who is authoritative now. This repository is.

## Layout

```
profile/
  README.md          the org homepage card
context/
  company.md          legal facts, provenance, verification links, claims standard
  brand.md             the Identity and Brand Book: colors, naming, voice, do-nots
  writing-guide.md      the full writing guide: point of view, banned words, ASD-STE100
  registers.md          what each public register is, and the rule for citing one
  glossary.md            defined terms used across context/ and spec-kit/
  units/
    ip.md               Intellectual Frontiers IP
    press.md            Intellectual Frontiers Press
    capital.md          Intellectual Frontiers Capital
    studios.md          Intellectual Frontiers Studios
    network.md          Intellectual Frontiers Network
spec-kit/
  AGENTS.md            entry point for writing a new spec or plan here
  memory/
    constitution.md    the Founder's Doctrine, as governing text — versioned
  templates/
    spec-template.md    how to write the next spec
    plan-template.md     how to plan against a spec, with a Constitution Check
  specs/
    0001-intellectual-frontiers/
      spec.md            the company itself, specified: testable requirements,
                          success criteria, and open questions — not a plan
    0002-if-ip/
      spec.md            IF IP, deepened from context/units/ip.md the same way
    0003-if-press/
      spec.md            IF Press, deepened from context/units/press.md the same way
    0004-if-capital/
      spec.md            IF Capital, deepened from context/units/capital.md the same way
    0005-if-studios/
      spec.md            IF Studios, deepened from context/units/studios.md the same way
    0006-if-network/
      spec.md            IF Network, deepened from context/units/network.md the same way
assets/
  logos/               corporate + 5 unit lockups + the core graphic alone, all transparent — see context/brand.md
  diagrams/            3 system diagrams — see spec-kit/specs/0001-intellectual-frontiers/spec.md
```

## Editing this repository

- Treat every file under `context/` and `spec-kit/` as public. Do not add
  anything that isn't meant for a public audience — no unreleased plans,
  internal metrics, or anything from the website repo's `.lovable/plan/`
  history, which is that repo's internal editorial log, not public company
  context.
- Follow the claims standard in [`context/company.md`](context/company.md):
  an observable fact should be verifiable, and a claim doesn't become true
  because this repository states it. Numbers sourced from an external
  registry (USPTO, Maryland SDAT) are linked, not restated.
- Follow [`context/writing-guide.md`](context/writing-guide.md) for any new
  prose, including prose drafted by an AI agent: evidence-led, practical,
  skeptical, plain, in first person for personal pieces or third-person
  active voice for corporate ones, with an audit pass before it ships.
- Use terms the way [`context/glossary.md`](context/glossary.md) defines
  them. Add a term there when you introduce one, rather than letting it
  live only inside a single spec.
- Amendments to `spec-kit/memory/constitution.md` follow the amendment
  process at the bottom of that file, including the version bump.
- A new spec starts from
  [`spec-kit/templates/spec-template.md`](spec-kit/templates/spec-template.md);
  a new plan starts from
  [`spec-kit/templates/plan-template.md`](spec-kit/templates/plan-template.md)
  once a spec exists for it to implement. Both save to
  `spec-kit/specs/NNNN-kebab-case-slug/` at the next unused number. See
  [`spec-kit/AGENTS.md`](spec-kit/AGENTS.md) for the full read order and
  the corporate/unit/venture layering model.
