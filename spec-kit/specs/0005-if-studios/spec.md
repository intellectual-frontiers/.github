# Feature Specification: Intellectual Frontiers Studios

**Spec ID:** 0005-if-studios
**Status:** Draft — first pass
**Created:** 2026-09-13
**Decision authority:** Shahid N. Shah, for the company-wide reason
tracked as OQ-5 on `0001-intellectual-frontiers` — no unit, Studios
included, has a named individual lead distinct from the founder yet.
**Input:** Specify IF Studios in spec-kit's spec shape, deepening
`context/units/studios.md` into testable requirements, the way the prior
three unit specs deepened their own charters. No new policy invented
here.

## Why this document exists

`context/units/studios.md` is the richest unit charter in this
repository: a lifecycle, a step-by-step method, a design-partner test, an
evidence table, an independence test, and a shared-services model. This
spec restates its checkable parts as requirements. Where 0001 already
states a rule that covers Studios (FR-002, FR-013, FR-014), this spec
cites it rather than restating it.

This is not an implementation plan. It does not say which specific
ventures Studios is running, what tools Demand or Revenue Engineering use,
or how a venture is staffed.

## Clarifications

None yet.

## Primary scenario

A real asymmetry is observed and framed as a Native Alpha thesis. The
thesis is validated against a real buyer and workflow, tested with the
smallest credible experiment, and proven — or not — with a costly, paid
signal. Studios repeats what works until the economics and delivery hold
up, then makes the venture independent once it earns that status. Every
stage ends in an explicit decision, never in momentum. Along the way,
Studios runs shared services (Demand Engineering, Revenue Engineering,
reproducible science support) so no venture rebuilds what the firm already
knows how to do, and no venture is allowed to drift into becoming a
custom consulting engagement.

### Acceptance scenarios

1. **Given** a candidate venture, **when** Studios takes it up, **then**
   the source, owner, confidentiality, mandate, and possible conflicts are
   named before further work proceeds.
2. **Given** a venture reaches a lifecycle stage gate (Observe, Frame,
   Validate, Experiment, Paid proof, Repeat, Independence), **when** the
   gate is reached, **then** an explicit decision is recorded — continue,
   pivot, stop, finance, license, sell, or spin out — not silence or
   default continuation.
3. **Given** a contact is proposed as a design partner, **when** that's
   checked, **then** workflow access, an executive sponsor who can
   authorize change, a real scarce contribution, a non-demo data or
   implementation environment, and a credible path to a commercial
   decision must all be present — a friendly contact missing any of these
   is not yet a design partner.
4. **Given** a piece of evidence exists (workflow access, an executive
   sponsor, a data commitment, paid proof, or reference behavior), **when**
   it's cited, **then** it is treated only as proof of what its row in the
   evidence table says, never stretched to cover what it doesn't establish
   (for example, paid proof is not treated as repeatable revenue).
5. **Given** a venture is proposed as independent, **when** that's tested,
   **then** the single binary independence test governs — could a
   qualified replacement continue the venture tomorrow on
   company-controlled records, rights, systems, and relationships — and
   it is not decomposed into a scored checklist. (0001 FR-013, FR-014.)
6. **Given** a repeated, undifferentiated capability is needed across the
   portfolio, **when** Studios addresses it, **then** it runs as a named
   shared service (Demand Engineering, Revenue Engineering) rather than
   being rebuilt separately inside each company.
7. **Given** a shared service still relies on humans for most of its
   production work, **when** Studios names it, **then** it is called AI
   First or AI Augmented — the name "AI Workforce" is reserved for a
   service that genuinely doesn't need that.
8. **Given** a venture starts, **when** choosing its first real test,
   **then** it is the smallest thing that is genuinely hard to do — not
   an easy demo — and Studios finishes, measures, and learns from it
   before taking on anything larger.

### Edge cases

- A venture never secures a genuine design partner, only friendly
  interest: Studios treats this as unvalidated, not as a soft pass.
- A Demand Engineering claim does not survive contact with the named
  audience: this is a valid, recordable result — the cheaper place to
  learn it — not a hidden failure to be quietly retried.
- A venture graduates to independence but keeps using a Studios shared
  service afterward: no rule states whether or how that continues.
  `[NEEDS CLARIFICATION: no stated rule for a graduated company's ongoing
  access to, or exit from, Studios' shared services]`

## Requirements

**Venture Architecture and the lifecycle**

- **FR-001**: Studios MUST name the source, owner, confidentiality,
  mandate, and possible conflicts of an opportunity before committing
  further work to it.
- **FR-002**: Studios MUST state an opportunity's Native Alpha thesis in
  plain language before validating it.
- **FR-003**: Every lifecycle stage (Observe, Frame, Validate, Experiment,
  Paid proof, Repeat, Independence) MUST end in an explicit decision:
  continue, pivot, stop, finance, license, sell, or spin out.
- **FR-004**: Studios MUST write an experiment's continue and stop
  conditions before seeing its result.
- **FR-005**: Studios MUST start with the smallest thing that is
  genuinely hard to do, finish it, and measure it, before taking on
  something larger or harder. (Build rule.)
- **FR-006**: Studios MUST NOT operate a venture as a custom consulting
  shop; it MUST observe the real workflow and find the narrow repeated
  problem before deciding what can become a product or a scalable
  service.

**Evidence discipline**

- **FR-007**: Studios MUST NOT treat a contact as a design partner unless
  workflow access, an executive sponsor able to authorize change, a real
  contribution of something scarce, a non-demo data or implementation
  environment, and a credible path to a commercial decision are all
  present.
- **FR-008**: Studios MUST NOT treat a piece of evidence as proof of
  anything beyond what its evidence-table row establishes — workflow
  access is not a right to reuse confidential data, an executive sponsor
  is not a buyer, a data commitment is not permission to train unrelated
  models, paid proof is not repeatable revenue or product-market fit, and
  reference behavior is not renewal, margin, or scalable delivery.
- **FR-009**: Studios MUST apply the independence test as a single binary
  judgment — could a qualified founder, board, investor, or replacement
  provider continue the venture tomorrow on company-controlled records,
  rights, systems, and relationships — before calling a venture
  independent, and MUST NOT decompose it into a scored checklist.
  (Restates 0001 FR-013 and FR-014.)

**Shared services**

- **FR-010**: A repeated, undifferentiated capability needed across the
  portfolio MUST run as a named shared service rather than be rebuilt
  separately inside each company.
- **FR-011**: The handoff between Demand Engineering and Revenue
  Engineering MUST be a defined gate, with specs, signals, scorecards,
  and evidence carried over rather than rebuilt at the handoff.
- **FR-012**: A shared service MUST NOT be named "AI Workforce" unless it
  genuinely runs without humans doing most of the production work and
  without developers remaining in the daily production loop; otherwise it
  MUST be named AI First or AI Augmented.
- **FR-013**: A failed claim inside a shared service (for example, a
  Demand Engineering claim that does not survive contact) MUST be
  recorded as a completed result, not hidden or silently retried without
  a record.

**Boundary**

- **FR-014**: Studios activity MUST NOT be cited, by Studios or by
  anyone else, as justification for a Capital investment decision by
  itself. (Restates 0001 FR-002.)

**Portfolio categories**

- **FR-015**: A company in the portfolio classified as a venture MUST have
  its own entity, its own operator, a licensed rights position, and a
  written closure condition before its first hire.
- **FR-016**: A piece of software in the portfolio MUST record its license
  and current status rather than imply one; it MUST NOT be required to
  have an entity or an operator the way a venture must.
- **FR-017**: When internally built software turns out to be worth more
  outside the firm, it MUST be spun out rather than kept as an internal
  tool indefinitely.
- **FR-018**: A shared service still at the ideation stage (not yet
  running) MUST be described as being at that stage wherever it's
  mentioned, not presented as an operating service.
- **FR-019**: A tool or piece of content Studios builds to make its work
  directly usable (per IPLG) MUST be evaluated against the Native Alpha
  test the same as anything else; the AI underneath it MUST NOT be
  presented as the advantage by itself.

**Studios as a last-mile capability**

- **FR-020**: Studios MUST NOT be treated as the default response to a
  promising thesis. It is invoked only once a search for an existing
  founder or company (run through IF Capital and IF Network) has failed
  to find one credibly pursuing the same thesis, and the evidence still
  justifies self-building.
- **FR-021**: A venture MUST NOT be chartered as its own entity before at
  least one experiment (a prototype, a small piece of software, a
  manually delivered service, a design partnership, an open source
  project, or a paid proof of concept) has produced evidence for the
  thesis. Entity formation follows evidence; it does not substitute for
  it.
- **FR-022**: When a better-positioned operator is found during or after
  a Studios experiment, Studios MUST hand off — invest, partner, license,
  merge, or spin out — rather than retain ownership of the implementation
  to preserve its own authorship of the work.
- **FR-023**: The ease of building something (including AI-accelerated
  building) MUST NOT be treated as evidence that building it was worth
  the time spent.

## Key entities

- **Venture Architecture** — the work of deciding what should exist and
  what proof earns more time or money.
- **Venture Architect** — the person who inventories Native Alpha, frames
  the thesis, designs tests, and drives the decision.
- **The Venture Development Lifecycle** — Observe → Frame → Validate →
  Experiment → Paid proof → Repeat → Independence.
- **A design partner** — defined by the five-requirement table in
  `context/units/studios.md`, not by friendliness or interest alone.
- **The independence test** — a single binary judgment, not a score.
- **Demand Engineering / Revenue Engineering** — the two shared services,
  connected by a defined handoff gate.
- **AI First / AI Augmented / AI Workforce** — naming tiers tied to how
  much human production work a service still requires.
- **A venture** vs. **software** vs. **a shared service** — the three
  portfolio categories, each with its own obligations, per "Two kinds of
  company" in `context/units/studios.md`.
- **Companion Executable Source Code Repositories** — the reproducible
  science shared service; ideation-stage, not yet running.
- **IPLG (Intellectual Product-Led Growth)** — the framework for making
  Studios' work directly usable, shared with IF IP and summarized in
  `context/units/studios.md`.
- **An experiment** — a prototype, small piece of software, manually
  delivered service, design partnership, open source project, or paid
  proof of concept; what Studios builds before it builds a company.

## Success criteria

- **SC-001**: Every venture that reaches a lifecycle gate has a recorded
  decision — none show silent or default continuation.
- **SC-002**: No venture is described as having a design partner without
  all five design-partner requirements satisfied.
- **SC-003**: No evidence type is cited as proving something outside its
  stated row in the evidence table.
- **SC-004**: A venture called independent passes the single binary
  independence test; none are called independent on a partial or averaged
  basis.
- **SC-005**: No shared service is named "AI Workforce" while humans still
  perform most of its production work.
- **SC-006**: A failed Demand Engineering test is recorded as a completed,
  valid result, with a date and an outcome — not silently retried.
- **SC-007**: Every portfolio entry is classified as a venture, software,
  or a shared service, with the obligations that category requires
  satisfied — no entry sits unclassified.
- **SC-008**: No ideation-stage shared service is described as though it
  were already running.
- **SC-009**: No venture is chartered as its own entity without a
  preceding experiment's evidence on record.
- **SC-010**: When a better-positioned operator is identified during or
  after an experiment, the resulting decision is a hand-off (invest,
  partner, license, merge, or spin out), not continued ownership
  defended on the grounds that Studios built it first.

## Out of scope

- The specific tools or vendors Demand Engineering and Revenue Engineering
  use are operational detail, not spec-level.
- Compensation, cap table, or equity terms for a venture belong to Capital
  and to legal formation work, not to this spec.
- IPLG's own tooling and website mechanics are implementation detail, kept
  summarized here rather than fully reproduced, the same as in
  `0002-if-ip`.
- The historical roster of past ventures (Physia, simplifyMD, Citus
  Health, and others) is provenance, already stated in
  `context/units/studios.md`; this spec governs current practice, not the
  history.

## Open questions

- **OQ-1**: No individual IF Studios lead is named, distinct from Shahid
  N. Shah. Tracked company-wide as OQ-5 on `0001-intellectual-frontiers`
  rather than repeated here.
- **OQ-2**: No rule states whether, or how, a company continues to use a
  Studios shared service after it has been called independent, or how
  that would be governed or billed once it does.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation detail — tooling, staffing, and vendor choices are
      out of scope
- [x] Every requirement traces to `context/units/studios.md` or
      `0001-intellectual-frontiers/spec.md`
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact

## Traceability

| Requirement | Source |
| --- | --- |
| FR-001 – FR-002 | `context/units/studios.md` (Steps a Venture Architect works through) |
| FR-003 | `context/units/studios.md` (Lifecycle) |
| FR-004 – FR-005 | `context/units/studios.md` (Steps; Build rule) |
| FR-006 | `context/units/studios.md` ("Where the practice comes from") |
| FR-007 | `context/units/studios.md` (What counts as a design partner) |
| FR-008 | `context/units/studios.md` (What counts as evidence) |
| FR-009 | `0001-intellectual-frontiers/spec.md` FR-013, FR-014 |
| FR-010 – FR-013 | `context/units/studios.md` (Shared services) |
| FR-014 | `0001-intellectual-frontiers/spec.md` FR-002 |
| FR-015 – FR-017 | `context/units/studios.md` ("Two kinds of company") |
| FR-018 | `context/units/studios.md` (Shared services; Companion Executable Source Code Repositories) |
| FR-019 | `context/units/studios.md` (Shared services; IPLG) |
| FR-020 – FR-023 | `context/units/studios.md` ("Studios is a last-mile capability"); `spec-kit/memory/constitution.md` §6 |
| SC-001 – SC-010 | Derived directly from FR-001 – FR-023 above |
