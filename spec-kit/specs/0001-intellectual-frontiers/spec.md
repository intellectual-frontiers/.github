# Feature Specification: Intellectual Frontiers LLC

**Spec ID:** 0001-intellectual-frontiers
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
> for every spec that follows — starting with
> [`0002-if-ip`](../0002-if-ip/spec.md),
> [`0003-if-press`](../0003-if-press/spec.md), and
> [`0004-if-capital`](../0004-if-capital/spec.md), with two units still to
> come.

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
whose case for existing rests on AI itself. Full rationale for each:
[`spec-kit/memory/constitution.md`](../../memory/constitution.md#11-what-we-will-not-become).

## Open questions

OQ-1 through OQ-3 were resolved in the 2026-09-13 clarification session
above (FR-007, FR-014, FR-018). One remains open:

- **OQ-4**: `context/company.md` carries unverified placeholders (formation
  date, Maryland Department ID, standing). An online lookup against
  Maryland's SDAT business entity search was attempted and blocked by this
  environment's network policy. Resolving this needs either a manual check
  of the [SDAT entity search](https://egov.maryland.gov/BusinessExpress/EntitySearch)
  by someone with network access to it, or Shahid supplying the values
  directly — not a decision this spec can make on its own.
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
| SC-001 – SC-008 | `spec-kit/memory/constitution.md` §9 |
| Out of scope | `spec-kit/memory/constitution.md` §11 |
