# Intellectual Frontiers — `.github`

This repository is three things at once:

1. **The GitHub org profile.** [`profile/README.md`](profile/README.md) is
   the card GitHub renders on
   [github.com/intellectual-frontiers](https://github.com/intellectual-frontiers).
2. **The public knowledge base about the company.** [`context/`](context/)
   holds the company's own account of what it is, what it does, and how its
   five units relate — legal facts, the brand and voice rules, and register
   definitions.
3. **The home of the shared SpecKit constitution.** [`spec-kit/`](spec-kit/)
   holds the governing doctrine that any Intellectual Frontiers repository's
   own spec-kit setup (`specify init`, `/specify`, `/plan`, `/tasks`) should
   inherit from, plus [`spec-kit/specs/0001-intellectual-frontiers/spec.md`](spec-kit/specs/0001-intellectual-frontiers/spec.md)
   — the company itself, written as a spec-kit spec: testable requirements
   and measurable success criteria, not another statement of principles.

## Canonical source, going forward

This repository — not `intellectualfrontiers.com` or the Lovable-managed
repo that publishes it — is the canonical source for the material under
`spec-kit/` and `context/`. The website should sync its copy of the doctrine,
brand book, and company facts from here.

The one exception is anything generated from a primary external record: patent
and trademark counts, USPTO filing data, and similar live registers stay
owned by the website's own sync pipeline against USPTO and other
authorities, because that pipeline — not this repository — is closest to the
primary source. [`context/registers.md`](context/registers.md) explains
exactly where that line sits and links out rather than duplicating numbers.

Most of this repository was originally distilled from the Lovable repo's
typed content (`src/content/doctrine.ts`, `corporate.ts`, `brand.ts`) as it
stood on 2026-09-13. Each such file says so in its own header, along with
the source commit. That note is about where the text came from, not about
who is authoritative now — this repo is. `context/writing-guide.md` is the
exception: it was authored directly here, with no earlier copy anywhere
else.

## Layout

```
profile/
  README.md          the org homepage card
context/
  company.md          legal facts, provenance, verification links, claims standard
  brand.md             the Identity and Brand Book: colors, naming, voice, do-nots
  writing-guide.md      the full writing guide: point of view, banned words, ASD-STE100
  registers.md          what each public register is, and the rule for citing one
  units/
    ip.md               Intellectual Frontiers IP
    press.md            Intellectual Frontiers Press
    capital.md          Intellectual Frontiers Capital
    studios.md          Intellectual Frontiers Studios
    network.md          Intellectual Frontiers Network
spec-kit/
  memory/
    constitution.md    the Founder's Doctrine, as governing text
  specs/
    0001-intellectual-frontiers/
      spec.md            the company itself, specified: testable requirements,
                          success criteria, and open questions — not a plan
assets/
  logos/               corporate + 5 unit lockups + the core graphic alone, all transparent — see context/brand.md
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
- Amendments to `spec-kit/memory/constitution.md` follow the amendment
  process at the bottom of that file.
