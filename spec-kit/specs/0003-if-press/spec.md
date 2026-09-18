# Feature Specification: Intellectual Frontiers Press

**Spec ID:** 0003-if-press
**Constitution version:** 1.2.0
**Status:** Draft — first pass
**Created:** 2026-09-13
**Decision authority:** Shahid N. Shah, for the company-wide reason
tracked as OQ-5 on `0001-intellectual-frontiers` — no unit, Press
included, has a named individual lead distinct from the founder yet.
**Input:** Specify IF Press in spec-kit's spec shape, deepening
`context/units/press.md` into testable requirements, the way
`0002-if-ip` deepened `context/units/ip.md`. No new policy invented here.

## Why this document exists

`context/units/press.md` states Press's charter in prose: why it exists,
the five levels it works at, and the rule that it must never invent an
advantage or cover weak evidence with narrative. This spec restates the
checkable parts of that charter as requirements. Where 0001 already states
a rule that covers Press (FR-009, FR-010, FR-022), this spec cites it
rather than restating it.

This is not an implementation plan. It does not say what Press produces
this quarter, who writes it, or which channel a given piece runs on.

## Clarifications

None yet.

## Primary scenario

A piece of Press output — a book, essay, field guide, case study,
documentation, podcast, briefing, or newsletter — makes some part of the
firm's, a unit's, a Studios company's, an IF Capital company's, or IF
Network's work legible to a reader who needs to make a decision. The piece
states its evidence, marks its claims by kind, and never manufactures an
advantage or reader approval the underlying record doesn't support.
Where Press is helping a company outside the parent build its own voice,
the work is aimed at that company eventually not needing Press at all.

### Acceptance scenarios

1. **Given** a claim in a piece cannot be independently verified, **when**
   it publishes, **then** it is labeled as an opinion, a framework, or an
   illustration rather than presented as an observable fact.
2. **Given** IF Studios asks Press to help a portfolio company build its
   market voice, **when** that work happens, **then** the company is
   learning to own its voice, source material, channels, and archive —
   not becoming permanently dependent on Press to speak for it.
3. **Given** an IF Capital portfolio company works with Press, **when**
   that relationship exists, **then** it is collaborative and optional,
   and the investment does not grant Press editorial control or promise
   favorable coverage.
4. **Given** the evidence behind a claimed advantage is weak, **when**
   Press writes about it, **then** the piece says so plainly rather than
   using narrative to make the evidence look stronger than it is.
5. **Given** a piece is written at one of Press's five levels (the firm,
   a business unit, a Studios company, an IF Capital company, IF Network),
   **when** it publishes, **then** it covers what that level's row
   specifies, not a generic account that blurs levels together.
6. **Given** outside coverage (a journalist, analyst, PR firm, trade
   publication, or conference) explains the firm, **when** it differs from
   Press's own account, **then** Press's own account is still the one the
   firm stands behind — outside coverage adds reach or scrutiny, it does
   not replace the firm's voice.

### Edge cases

- A Studios company's voice, once independent, diverges from how the
  parent would frame the same Native Alpha thesis: expected, not a
  violation — capability transfer means the company now makes its own
  editorial calls.
- A portfolio company declines Press's help entirely: permitted: the
  relationship is optional, and declining carries no penalty.
- A company's own material, published after Press capability-transfer is
  complete, stops meeting the claims standard: this spec does not say
  whether Press retains any oversight at that point.
  `[NEEDS CLARIFICATION: no stated process for claims-standard compliance
  after capability transfer]`

## Requirements

**Claims and evidence**

- **FR-001**: Press MUST NOT publish a claim without identifying it as an
  observable fact, an opinion, a framework, or an illustration, per the
  claims standard in `context/company.md`. (Restates 0001 FR-009.)
- **FR-002**: Press MUST NOT use narrative to cover weak evidence, and
  MUST NOT manufacture reader approval. (Restates 0001 FR-010.)
- **FR-003**: Press MUST make Native Alpha — the advantage already
  present — legible, credible, useful, and durable. Press MUST NOT invent
  an advantage that does not already exist.

**Voice**

- **FR-004**: Every piece Press produces MUST hold to the four voice
  principles in `context/brand.md`: evidence-led, practical, skeptical,
  and plain.
- **FR-005**: Prose Press publishes, including AI-drafted prose, MUST
  follow `context/writing-guide.md` and pass its audit step before
  publication. (Restates 0001 FR-022, Press-specific.)

**Working with companies outside the parent**

- **FR-006**: When Press helps a Studios company build its voice, the
  goal MUST be capability transfer — the company learns to own its voice,
  source material, channels, and archive — not permanent dependence on
  Press.
- **FR-007**: When Press helps an IF Capital portfolio company, that help
  MUST be collaborative and optional. An investment MUST NOT be treated as
  granting Press editorial control or a promise of favorable coverage.

**Scope and levels**

- **FR-008**: A piece written at one of Press's five levels (the firm, a
  business unit, a Studios company, an IF Capital company, IF Network)
  MUST address what that level covers, per `context/units/press.md`'s
  levels table, rather than a generic account that blurs levels.
- **FR-009**: Press MUST NOT wait for outside coverage to explain the firm
  correctly. Outside coverage may add reach, scrutiny, or independent
  validation, but MUST NOT replace the firm's own account.
- **FR-010**: Press's work MUST be evaluated by whether it improves
  understanding and helps somebody make a better decision — not by
  whether it fills a content calendar.

**Corrections and sourcing**

- **FR-011**: When a published claim or number turns out to be wrong,
  Press MUST run the correction with the same prominence as the original
  claim, in place, and MUST credit whoever caught the error unless they
  ask otherwise.
- **FR-012**: A published piece MUST carry the evidence for its claims —
  named systems, dated numbers, and the constraint that made the problem
  hard — and MUST be organized by the market it addresses.
- **FR-013**: A recurring editorial argument (for example, framing AI by
  which new work becomes possible rather than hours saved) MUST still
  satisfy FR-002 and FR-003 — using a thread deliberately to make a case
  does not exempt it from being evidence-based and honest about the
  advantage's limits.
- **FR-014**: Press MUST format a piece to match how its intended audience
  actually consumes material (for example, a patent summary written so a
  licensee or procurement officer can judge a family's coverage without
  hiring counsel first) rather than defaulting to one format for every
  audience.

**Publishing as experimentation**

- **FR-015**: Press MUST treat publication as an experiment, not only as
  output: the reception a piece gets (silence, argument, adoption of its
  terminology, willingness to pay to use the idea) MUST be read as
  evidence about the underlying thesis, in ascending order of strength.
- **FR-016**: Press MUST NOT treat the absence of criticism or argument as
  confirmation of a claim; unopposed does not mean validated.

**Shared services**

- **FR-017**: Press MUST route its legal, finance, compliance, and general
  operations needs through the company-wide shared-services layer rather
  than building its own internal team for one of these functions.
  (Restates 0001 FR-028.)

**Books as working AI**

- **FR-018**: A Fieldbook that teaches an actionable method MUST make
  that method available to a reader's own AI, as a skill, an MCP tool,
  or both, not only as prose. Production mechanics for this (where a
  skill's source lives, how it's built, how it's reviewed) are
  operational detail for Press's own production repo, not this spec.
- **FR-019**: A skill or MCP tool Press ships MUST execute the method a
  Fieldbook teaches faithfully. It MUST NOT make the judgment,
  decision, or interpretation the book teaches a reader to make for
  themselves, the same discipline FR-003 already requires Press itself
  to hold: legible and useful, never a substitute for the reader's own
  judgment.
- **FR-020**: "AI Workforce" and "Labor as Code" MUST be used as
  defined, consistent terms across every piece Press produces that
  uses them, the same way "Native Alpha" already is. The working
  definitions live in Press's own production repo (`voice/glossary.md`
  in `if-press-prime`); this spec requires the consistency, not the
  wording itself, the same boundary FR-005 already draws for prose
  generally.

## Key entities

- **A piece** — a book, essay, field guide, case study, documentation,
  diagram, podcast, briefing, newsletter, or direct channel; any unit of
  Press output.
- **The five levels** — the firm, business units, Studios companies, IF
  Capital companies, and IF Network, each with its own scope, per
  `context/units/press.md`.
- **Capability transfer** — the explicit goal of Press's help to a Studios
  company: the company ends up owning its own voice, not renting Press's.
- **The claims standard** — fact / opinion / framework / illustration,
  defined in `context/company.md`.
- **The voice principles** — evidence-led, practical, skeptical, plain,
  defined in `context/brand.md`.
- **A Fieldbook** — one of the four named books carrying the Intellectual
  Frontiers Press imprint, each with its own thesis and named frameworks.
- **Founder writing** — Shahid Shah's own writing, published externally
  and curated into the portfolio by type (Contrarian Brief, Design
  Pattern, Working Theory, Practitioner Journalist) and optional series.
- **An owned channel** — one of Press's six directly owned publications,
  chosen over depending solely on an outside platform.
- **The publishing evidence ladder** — silence, argument, adoption of
  terminology, and willingness to pay, in ascending order of how strongly
  each confirms the underlying thesis.
- **An AI Workforce** — a SpecKit, a harness, agents, skills, and MCPs,
  assembled toward one outcome and a defined set of deliverables; the
  pattern every Fieldbook teaches a reader to build, per "Books as
  working AI, not just pages" in `context/units/press.md`.
- **Labor as Code** — a skill that encapsulates a person's knowledge,
  judgment, taste, and skill in durable, inspectable, versioned form;
  what a reader's own Native Alpha, applied inward rather than at a
  market, finds ready to become.

## Success criteria

- **SC-001**: Every published claim is labeled by kind (fact, opinion,
  framework, or illustration) — none appear unlabeled.
- **SC-002**: A Studios company Press has worked with can produce its own
  material without Press's involvement at some point — actual evidence of
  capability transfer, not just a stated intent to transfer it.
- **SC-003**: No IF Capital portfolio company's coverage is contingent on
  its investment relationship; coverage and funding decisions are made
  separately and by different people.
- **SC-004**: A reader of a given piece can state a decision they're able
  to make differently having read it. Volume or publishing cadence is not
  a measure of Press's work.
- **SC-005**: A correction to a published claim carries the same
  prominence as the original claim and appears in place, not buried or
  omitted.
- **SC-006**: Every published piece names its evidence (systems, dated
  numbers, the constraint that made the problem hard) and states which
  market it addresses.
- **SC-007**: A piece's reception (argument, adoption, willingness to pay)
  is recorded somewhere and read back against the thesis it was meant to
  test — not published and then never revisited.
- **SC-008**: Press has no internal legal, finance, or compliance team of
  its own — those functions are rented, shared with the other four units.
- **SC-009**: A Fieldbook that teaches an actionable method has a
  companion skill or MCP tool realizing it, not only prose describing
  it.
- **SC-010**: No skill or MCP tool Press ships makes a judgment call its
  own Fieldbook teaches the reader to make.
- **SC-011**: "AI Workforce" and "Labor as Code" carry the same meaning
  everywhere they appear across Press's output; no piece redefines them
  locally.

## Out of scope

- Production mechanics for any given medium (how a book gets edited, how
  a podcast gets recorded, how a companion skill or MCP tool is built,
  stored, and reviewed) are operational detail, not spec-level.
- The commercial terms of a Press engagement with an IF Capital company
  are a Capital-side decision, not Press's to set.
- Outside-coverage strategy (which journalists, which outlets) is
  operational detail; this spec only requires that Press's own account
  never depend on it.
- The substantive content of any Fieldbook or founder-writing piece is
  Press's editorial work, not this spec's to govern — this spec only
  requires that the finished piece satisfy the claims standard and voice
  principles.

## Open questions

- **OQ-1**: No individual IF Press lead is named, distinct from Shahid N.
  Shah. Tracked company-wide as OQ-5 on `0001-intellectual-frontiers`
  rather than repeated here — it applies identically to every unit.
- **OQ-2**: No process is stated for whether Press retains any oversight
  of a company's claims-standard compliance after capability transfer is
  complete and the company owns its own voice.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation detail — production mechanics, staffing, and
      outside-coverage tactics are out of scope
- [x] Every requirement traces to `context/units/press.md`,
      `context/company.md`, `context/brand.md`, `context/writing-guide.md`,
      or `0001-intellectual-frontiers/spec.md`
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact

## Traceability

| Requirement | Source |
| --- | --- |
| FR-001 | `0001-intellectual-frontiers/spec.md` FR-009; `context/company.md` (claims standard) |
| FR-002 | `0001-intellectual-frontiers/spec.md` FR-010 |
| FR-003 | `context/units/press.md` ("The rule") |
| FR-004 | `context/brand.md` (Voice) |
| FR-005 | `0001-intellectual-frontiers/spec.md` FR-022; `context/writing-guide.md` |
| FR-006 | `context/units/press.md` ("Why Press exists") |
| FR-007 | `context/units/press.md` ("Why Press exists") |
| FR-008 | `context/units/press.md` (Levels table) |
| FR-009 | `context/units/press.md` ("Why Press exists") |
| FR-010 | `context/units/press.md` ("Why Press exists") |
| FR-011, FR-012 | `context/units/press.md` ("Owned channels") |
| FR-013 | `context/units/press.md` ("Founder writing") |
| FR-014 | `context/units/press.md` ("What Press has published") |
| FR-015, FR-016 | `context/units/press.md` ("Publishing as experimentation") |
| FR-017 | `0001-intellectual-frontiers/spec.md` FR-028 |
| FR-018 – FR-020 | `context/units/press.md`, "Books as working AI, not just pages"; operational half in `if-press-prime`'s `spec-kit/spec.md` FR-027 – FR-031 |
| SC-001 – SC-008 | Derived directly from FR-001 – FR-017 above |
| SC-009 – SC-011 | Derived directly from FR-018 – FR-020 above |
