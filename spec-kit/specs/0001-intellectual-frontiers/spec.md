# Feature Specification: Intellectual Frontiers LLC

**Spec ID:** 0001-intellectual-frontiers
**Constitution version:** 1.2.0
**Status:** Draft — clarified 2026-09-13
**Created:** 2026-09-13
**Decision authority:** Shahid N. Shah, per the delegation rule in
[`spec-kit/memory/constitution.md`](../../memory/constitution.md#7-a-small-core-a-flexible-bench)
**Input:** Specify Intellectual Frontiers LLC itself, in spec-kit's spec
shape — what the company is and does, as testable requirements and
measurable success criteria — sourced entirely from the constitution and
`context/` already in this repository. No new policy invented here.

> This spec was written first, before any template existed. Its shape was
> then extracted into [`spec-kit/templates/spec-template.md`](../../templates/spec-template.md)
> for every spec that follows:
> [`0002-if-ip`](../0002-if-ip/spec.md),
> [`0003-if-press`](../0003-if-press/spec.md),
> [`0004-if-capital`](../0004-if-capital/spec.md),
> [`0005-if-studios`](../0005-if-studios/spec.md), and
> [`0006-if-network`](../0006-if-network/spec.md) — all five units now
> specified.

## Why this document exists

`spec-kit/memory/constitution.md` states the principles: what Intellectual
Frontiers believes, and the gates a plan has to pass. It does not state
testable requirements — sentences a specific decision can be checked
against. This spec does that job. Any future plan — a Studios venture, a
Capital allocation, an IP disposition, a Network search, a Press piece —
should trace back to a requirement here, and this spec should trace back to
the constitution. Nothing below is a new rule; every requirement restates
something already committed elsewhere in this repository, in a form that
can be checked rather than just agreed with.

This is not an implementation plan. It says what must be true, not how any
unit's day-to-day work gets done, what tools it uses, or how it is staffed.

## Clarifications

### Session 2026-09-13

- **Q: A protectable research finding had no deadline for its disposition
  (patent / defensive disclosure / trade secret / no action). Should one
  exist?** → **A: Yes — tied to a trigger event**, not a calendar. The
  decision is now due no later than whichever comes first: a paper or note
  describing the finding going out, or a related patent application's
  priority-date deadline. See FR-007.
- **Q: Should the Studios independence test become a scored checklist
  instead of a single yes/no judgment call?** → **A: No — it stays
  binary.** One holistic test, deliberately not decomposed into a
  scorecard. See FR-014.
- **Q: Should "steady" and "strategically important" work, in the hiring
  rule, get numeric thresholds?** → **A: No — they stay qualitative.**
  The 18-month runway figure remains the only hard number; the rest stays
  a judgment call for whoever holds delegated authority over that
  decision. See FR-018.
- **Q: How should the three unverified Maryland registry facts in
  `context/company.md` (formation date, Department ID, standing) get
  resolved?** → **A: Attempted an online lookup against Maryland's SDAT
  business entity search; this environment's network policy blocks it**
  (same policy that blocked a direct fetch of `intellectualfrontiers.com`
  earlier in this repository's history). Still open — see OQ-4.

### Session 2026-09-14

- **Q: Should legal, finance, compliance, and general operations become a
  single shared-services layer used by all five units the same way, or
  stay a per-unit decision?** → **A: One shared layer, not five.** Every
  unit routes these functions to independent, specialized providers the
  same way Capital already does; a function moves in-house only when the
  hiring rule is met for that function specifically. Resolves OQ-6. See
  FR-028 and `spec-kit/memory/constitution.md` §7.
- **Q: How should the three unverified Maryland registry facts (OQ-4) get
  resolved, given this environment's network policy blocks the SDAT
  lookup?** → **A: Shahid ran the SDAT search himself and supplied the
  record directly.** `context/company.md` now states the formation date
  (September 5, 2023), Maryland Department ID (W24347692), and standing
  (active, in good standing) as of a 2026-09-14 check. The record also
  named a resident agent and a principal office address; neither is
  published here, per FR-023's non-disclosure rule — OQ-4 is resolved
  only for the three facts it actually asked about. Resolves OQ-4.

### Session 2026-09-17

- **Q: Shahid's published research at
  intellectualfrontiers.com/research/eidolons names this repository
  directly as "Intellectual Frontiers' own Eidolon." Should that framing
  be reflected here?** → **A: Yes.** `spec-kit/AGENTS.md` and the root
  `README.md` now state plainly that this repository is the company's
  Eidolon: a working digital reflection of the company, read reference
  rather than a live agent, public tier only of that research's
  public/internal/confidential/highly-restricted model, and link to the
  research page for the full argument rather than restating it, per this
  repository's own citation practice. No new requirement was needed;
  this is a framing addition, not a change to what the company does.

## Primary scenario

As a signal — a patent, a workflow observation, a research finding, a
person Network finds, a market change, a manuscript, a customer complaint —
enters Intellectual Frontiers through any unit, it must be evaluated
against Native Alpha, carried through proof if it survives that
evaluation, and resolved to an explicit decision, with rights, authority,
and evidence named at every handoff.

### Acceptance scenarios

1. **Given** a signal enters through IP as a research finding, **when** no
   design partner or counterparty has committed money, time, access, data,
   reputation, or changed behavior to it, **then** the finding remains a
   hypothesis and no unit may treat it as proven Native Alpha.
2. **Given** a Studios venture reaches a decision gate, **when** the
   evidence does not justify another dollar or month, **then** the venture
   stops rather than continuing on momentum.
3. **Given** Capital evaluates a company that already holds a patent, a
   publication, or Studios activity, **when** none of it is accompanied by
   committed capital, workflow access, or paid proof, **then** Capital does
   not fund on that basis alone.
4. **Given** Press publishes a claim, **when** the claim cannot be
   independently verified, **then** it must be labeled as an opinion, a
   framework, or an illustration rather than presented as an observable
   fact.
5. **Given** Network delivers an evidence packet on a person, **when** part
   of the packet is inferred rather than confirmed, **then** the packet
   states the inference separately from the known fact, and an
   introduction is never presented as a reference.
6. **Given** a signal touches more than one unit, **when** work on it
   becomes costly, **then** the legal party, beneficial owner,
   decision-maker, rights, economics, and conflicts are named before that
   cost is incurred.

### Edge cases

- A signal that fits no unit's mandate cleanly: the handoff rule (every
  handoff names the decision-maker and rights before work proceeds) applies
  before any unit invests further, not after.
- Two units reach conflicting conclusions about the same opportunity: the
  parent's reserved decisions (strategy, unit mandates, continue/stop calls)
  resolve it, not whichever unit acted first.
- Evidence that satisfies one unit's bar but not another's: each unit's
  bar stands on its own — satisfying Studios' evidence table does not
  satisfy Capital's underwriting standard, and vice versa.

## System diagrams

Three diagrams, provided directly by Shahid N. Shah on 2026-09-14, show
this spec's primary scenario visually rather than in prose. They live in
[`assets/diagrams/`](../../../assets/diagrams):

| Diagram | What it shows |
| --- | --- |
| [`native-alpha-to-market-reality.png`](../../../assets/diagrams/native-alpha-to-market-reality.png) | The five units arranged around Native Alpha, each producing evidence the others amplify — plus the founder's own "Gaps to Make Explicit" (customer proof, stage gates, shared services, metrics and kill criteria), one of which (shared services) is carried into Open Questions below rather than resolved here. |
| [`explained-simply.png`](../../../assets/diagrams/explained-simply.png) | The plain-English version of the same five-unit loop, for a reader who wants the shape of the thing before the detail. |
| [`how-thought-moves-through-the-system.png`](../../../assets/diagrams/how-thought-moves-through-the-system.png) | The fuller version: what each unit outputs, which other units support that output, and the two capital sources (the firm's own balance sheet, and LPs and investors brought in through IF Network). |

## Requirements

Each requirement below is testable against a specific decision or
document, not aspirational. Where the source doctrine does not yet give a
checkable answer, that gap is marked `[NEEDS CLARIFICATION]` rather than
resolved here.

**Native Alpha and the opportunity flow**

- **FR-001**: The company MUST evaluate every signal against the Native
  Alpha definition — an unusual, disproportionate advantage that already
  exists and is strong enough to change a real decision — before treating
  it as more than a hypothesis.
- **FR-002**: No unit MAY treat another unit's activity as proof of its
  own claim: a patent does not prove a venture; a publication does not
  prove demand; Studios activity does not justify investment; investment
  does not prove product-market fit.
- **FR-003**: Every opportunity MUST resolve to an explicit decision at
  each stage — continue, pivot, stop, publish, license, invest, or build —
  and MUST NOT proceed on momentum alone.
- **FR-004**: Before any experiment, the company MUST record the belief,
  the smallest test, the budget, the decision date, the evidence required
  to continue, and the evidence that would cause it to stop — all recorded
  before the result is known.
- **FR-005**: The company MUST stop a line of work when any constitution
  stop condition holds (the claimed advantage is common or purchasable;
  the pain is not urgent, funded, or reachable; no design partner will
  commit a scarce resource; rights are unavailable or encumbered; the
  company depends on a non-portable relationship; delivery or revenue
  stays harder than the thesis allows; the opportunity conflicts with a
  mandate; or the next dollar or month buys activity, not evidence).

**IF IP**

- **FR-006**: IF IP MUST NOT imply a registration or ownership position
  that the underlying record does not support.
- **FR-007**: IF IP MUST give every protectable research finding an
  explicit disposition — patent, defensive disclosure, trade secret, or no
  action — no later than whichever comes first: a paper or note describing
  the finding being published, or the priority-date deadline of any
  related patent application. It MUST NOT leave a finding undecided past
  either trigger.
- **FR-008**: The patent register MUST be generated from the USPTO record
  rather than entered by hand, so published counts follow the filings.

**IF Press**

- **FR-009**: IF Press MUST NOT publish a claim without identifying it as
  an observable fact, an opinion, a framework, or an illustration, per the
  claims standard in `context/company.md`.
- **FR-010**: IF Press MUST NOT use narrative to cover weak evidence, and
  MUST NOT manufacture reader approval.

**IF Capital**

- **FR-011**: IF Capital MUST NOT allocate capital on the basis of a
  Studios venture, an IP asset, a publication, or a relationship alone,
  without underwriting judgment applied to demand, distribution,
  governance, reserves, and return.
- **FR-012**: IF Capital MUST route fund administration, legal, tax,
  audit, and valuation to independent parties rather than performing them
  itself.

**IF Studios**

- **FR-013**: IF Studios MUST NOT call a portfolio venture independent
  while it still depends on a founder, provider, channel, or relationship
  that cannot become portable.
- **FR-014**: IF Studios MUST verify the independence test — that a
  qualified founder, board, investor, or replacement provider could
  continue the venture tomorrow on company-controlled records, rights,
  systems, and relationships — before calling a venture independent. This
  MUST remain a single holistic judgment call; it MUST NOT be decomposed
  into a scored checklist that could pass on average while failing on one
  disqualifying component.

**IF Network**

- **FR-015**: IF Network MUST state, in every evidence packet, what is
  known, what is inferred, and what is missing, as separate categories.
- **FR-016**: IF Network MUST NOT present an introduction as a reference,
  or a reference as evidence.

**Governance and structure**

- **FR-017**: Capital-allocation decisions MUST route through Shahid N.
  Shah as final authority. Every other recurring responsibility MUST have
  a named owner, written authority, a measurable output, and a defined
  escalation point.
- **FR-018**: The company MUST NOT hire full-time for work that is not
  steady, strategically important, financially sound, and supported by at
  least 18 months of runway. "Steady" and "strategically important" are
  deliberately not numerically defined beyond the 18-month runway figure;
  that judgment stays with whoever holds delegated authority over the
  decision.
- **FR-019**: Every cross-unit handoff MUST name the legal party,
  beneficial owner, decision-maker, rights, economics, evidence, and
  conflict process before work proceeds, regardless of common ownership or
  trust between the parties.
- **FR-020**: The company MAY use AI to compress research, analysis,
  engineering, documentation, and reporting, but MUST NOT treat access to
  AI itself as a source of Native Alpha — an advantage available to any
  capable competitor with the same tools is not Native Alpha.

**This repository**

- **FR-021**: This repository MUST NOT restate a number sourced from an
  external registry (USPTO, Maryland SDAT) as settled fact; it MUST link to
  the primary source instead.
- **FR-022**: Prose written for Intellectual Frontiers, including
  AI-drafted prose, MUST follow `context/writing-guide.md` and pass its
  audit step before publication.
- **FR-023**: The company MUST NOT publish its resident agent, a street
  address, a telephone number, headcount, revenue, financing details, or
  ownership percentages.

**Search before build, and how the system moves**

- **FR-024**: The company MUST NOT ask what company or product should be
  built from a signal before first asking whether the signal is Native
  Alpha. "What should we build" is a later question, not the first one.
- **FR-025**: Before IF Studios builds toward a thesis, the company MUST
  check whether an existing founder or company — surfaced through IF
  Network or the broader market — is already pursuing that thesis
  credibly. IF Studios MUST NOT be the default response to a promising
  thesis.
- **FR-026**: When backing an external party and building internally are
  both viable responses to the same thesis, the company MUST evaluate
  backing the external party first. A thesis originating inside the
  company MUST NOT, by itself, be treated as a reason to build it
  internally rather than back a better-positioned outside founder.
- **FR-027**: A discovery made by any unit MUST be able to revise another
  unit's prior assumption. No unit's output MAY be treated as a one-way
  handoff that a later unit cannot send evidence back against.

**Shared services**

- **FR-028**: Legal, finance and accounting, compliance, and general
  operations MUST be routed to independent, specialized providers the
  same way for every unit — one shared layer, not a separate arrangement
  per unit. A unit MUST NOT build its own internal team for one of these
  functions while another unit rents the same function elsewhere.
- **FR-029**: A shared function MUST NOT move in-house for one unit's
  convenience alone; it moves in-house only when the hiring rule (steady,
  strategically important, financially sound, 18+ months of runway) is
  met for that function specifically, company-wide.

## Key entities

- **Intellectual Frontiers LLC** — the parent: brand owner, unit
  organizer, and contracting party unless another entity is named.
- **The five units** — IP (runs research, protects and commercializes what
  it produces), Press (understands markets, explains the truth clearly),
  Capital (puts money behind evidence with discipline), Studios (builds the
  companies that should exist), Network (finds and proves the people who
  can carry the work). Full charters: [`context/units/`](../../../context/units).
- **Native Alpha** — the shared test every unit applies: an unusual,
  disproportionate advantage that already exists and is strong enough to
  change a real decision.
- **The evidence chain** — Observation → Possible Native Alpha → Who cares
  → Cheapest credible test → Evidence.
- **An opportunity** — the thing that moves through Signal → Thesis →
  Proof → Decision → Compound, potentially through more than one unit.
- **Related entities named in the doctrine, each with a stated boundary**
  — Funds/GPs/SPVs (hold mandates and investor capital, no commingling
  with the parent), portfolio companies (own their own operations and
  data; the parent acts through contracts and board rights, not daily
  control), Netspective Communications (a preferred affiliated provider on
  market terms, not a captive vendor), Netspective Foundation (independent
  nonprofit, never subsidized commercial R&D), Sinbad Capital (an
  independent fund and operating partner, with no implied investment
  authority over it).
- **The evidence taxonomy** — what each unit's activity produces: a patent
  produces IP evidence, a publication produces audience evidence, a
  customer experiment produces demand evidence, a product produces
  behavioral evidence, a sale produces economic evidence, an LP
  conversation produces capital-market evidence, a founder search produces
  human-capital evidence, a partnership produces distribution evidence.
  All of it feeds back into the same Native Alpha thesis.
- **The decision checkpoint** — continue, change the thesis, back someone
  else, build it ourselves, or stop, with "back someone else" checked
  before "build it ourselves."
- **Capital sources** — the firm's own balance sheet, and LPs and
  investors brought in through IF Network.
- **Shared services** — legal, finance and accounting, compliance, and
  general operations, routed to independent providers the same way for
  every unit, per `context/company.md`.

## Success criteria

Restated from the constitution's "How we judge progress," as pass/fail
criteria rather than a column of contrasts:

- **SC-001**: A decision record names its assumptions, contrary evidence,
  authority, and next decision — a longer memo alone does not satisfy this.
- **SC-002**: At least one bounded, difficult test completes and is capable
  of changing a real decision, before a larger or more expensive attempt is
  funded.
- **SC-003**: Weak work stops before backlog size or sunk cost becomes the
  reason to continue it.
- **SC-004**: Rights carry clean title, useful scope, and financeable
  terms — a growing filing count alone does not satisfy this.
- **SC-005**: Customers commit money, workflow change, data,
  implementation, renewal, or reputation — a friendly pilot or a generic
  letter of intent does not satisfy this.
- **SC-006**: A relationship search produces measurably better access,
  trust, reference behavior, or sourcing on the next search — a higher
  contact count does not satisfy this.
- **SC-007**: A venture graduated from Studios runs on its own records,
  rights, systems, and governance, without its original operator.
- **SC-008**: The company's capability (units, records, rights,
  relationships) grows faster than its fixed overhead (headcount, entities,
  providers) does.

## Out of scope

What Intellectual Frontiers will not become, per the constitution: a patent
holding company; a promotional house organ; a claim of institutional
tenure it has not earned; a conventional venture studio that collects
permanent service relationships; a clean-sheet philosophy that discards
earned trust and history; a consulting conglomerate; a rolodex; a company
whose case for existing rests on AI itself; a capital deployment machine
measured by dollars placed rather than judgment about evidence. Full
rationale for each:
[`spec-kit/memory/constitution.md`](../../memory/constitution.md#11-what-we-will-not-become).

## Open questions

OQ-1 through OQ-3 were resolved in the 2026-09-13 clarification session
above (FR-007, FR-014, FR-018). OQ-4 and OQ-6 were resolved in the
2026-09-14 session above (FR-028, FR-029 for OQ-6). One remains open:

- ~~**OQ-4**: unverified Maryland registry facts.~~ **Resolved 2026-09-14**
  — Shahid supplied the SDAT record directly; see the Clarifications
  session above and `context/company.md`'s Corporate facts table.
- **OQ-5**: No unit — IP, Press, Capital, Studios, or Network — has a named
  individual lead distinct from Shahid N. Shah himself, anywhere in the
  doctrine. FR-017 requires that "every other recurring responsibility
  MUST have a named owner, written authority, a measurable output, and a
  defined escalation point"; as written, no unit currently satisfies that
  requirement. Every spec in `spec-kit/specs/` defaults its decision
  authority to Shahid N. Shah for exactly this reason — first surfaced
  while writing `0002-if-ip`'s own OQ-1, and general enough to belong here
  rather than be re-discovered once per unit. This is a gap against an
  existing MUST, not a missing rule — FR-017 does not need to change; the
  company needs to either name owners or decide the gap is acceptable for
  now.

  **Intended resolution path, noted 2026-09-14, not yet run:** Shahid's
  stated intent is to close this by running an actual IF Network hunt for
  each unit lead — a written thesis on what would have to be true of the
  person, evidence-based candidates, human judgment on who to contact —
  the same discipline `0006-if-network`'s spec already requires of any
  other search, rather than simply appointing someone. This is a decision
  to make later, not a resolution; OQ-5 stays open until a hunt actually
  runs.
- ~~**OQ-6**: shared services.~~ **Resolved 2026-09-14** — see the
  Clarifications session above, `spec-kit/memory/constitution.md` §7 ("One
  shared-services layer, not five"), and `context/company.md` ("Shared
  services").

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation detail — no tooling, staffing, or org-chart
      decisions; those belong in a future plan
- [x] Every requirement traces to an existing constitution or context
      file; no new policy introduced
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact

## Traceability

| Requirement | Source |
| --- | --- |
| FR-001 – FR-005 | `spec-kit/memory/constitution.md` §§3, 6, 10 |
| FR-006, FR-008 | `context/units/ip.md`; `context/registers.md` |
| FR-007 | `context/units/ip.md` (chain: research → filing/disclosure) |
| FR-009, FR-010 | `context/company.md` (claims standard); `context/units/press.md` |
| FR-011, FR-012 | `context/units/capital.md` |
| FR-013, FR-014 | `context/units/studios.md` (independence test) |
| FR-015, FR-016 | `context/units/network.md` |
| FR-017 | `spec-kit/memory/constitution.md` §7 (delegation) |
| FR-018 | `spec-kit/memory/constitution.md` §7 (hiring rule) |
| FR-019 | `spec-kit/memory/constitution.md` §6 (handoff rule) |
| FR-020 | `spec-kit/memory/constitution.md` §8 |
| FR-021 | `context/registers.md`; `README.md` |
| FR-022 | `context/writing-guide.md` |
| FR-023 | `context/company.md` ("What this company deliberately does not publish") |
| FR-024 – FR-027 | `spec-kit/memory/constitution.md` §6 (search before build; the system circulates) |
| FR-028, FR-029 | `spec-kit/memory/constitution.md` §7 (one shared-services layer); `context/company.md` ("Shared services") |
| SC-001 – SC-008 | `spec-kit/memory/constitution.md` §9 |
| Out of scope | `spec-kit/memory/constitution.md` §11 |
