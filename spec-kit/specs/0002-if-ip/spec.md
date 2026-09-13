# Feature Specification: Intellectual Frontiers IP

**Spec ID:** 0002-if-ip
**Status:** Draft — first pass
**Created:** 2026-09-13
**Decision authority:** Shahid N. Shah. No individual IF IP unit lead is
named anywhere in the doctrine yet, distinct from the founder himself —
see OQ-1.
**Input:** Specify IF IP in spec-kit's spec shape, deepening
`context/units/ip.md` and `context/registers.md` into testable
requirements, the way `0001-intellectual-frontiers` deepened the
constitution. No new policy invented here.

## Why this document exists

`context/units/ip.md` states IF IP's charter in prose: the research chain,
the groups of work, the rule that a patent still has to earn its
commitment. This spec restates the checkable parts of that charter as
requirements, and adds nothing IF IP's own documents don't already say.
Where 0001 already states a rule that covers IP (FR-002, FR-006, FR-007,
FR-008), this spec cites it rather than restating it, per
`spec-kit/templates/spec-template.md`'s own instruction.

This is not an implementation plan. It does not say who staffs research,
what tools the sync pipeline uses, or how patent prosecution gets managed
day to day.

## Clarifications

None yet.

## Primary scenario

A research finding enters IF IP's chain as a question chosen on purpose,
in a market the firm can see the real workflow in — not as a patent idea
looking for a justification. It moves through a research pillar, gets
recorded in a paper or dated note, and at a defined trigger point receives
an explicit disposition: patent, defensive disclosure, trade secret, or no
action. Whatever the disposition, IF IP never represents a stronger rights
position than the record supports, and a granted right still has to clear
the commercial questions before anyone treats it as more than a
possibility.

### Acceptance scenarios

1. **Given** a workflow observation with no assigned research pillar,
   **when** IF IP takes it up, **then** it is grouped under a research area
   and given a research pillar with a stated question, not filed directly
   as a patent idea.
2. **Given** a research pillar has produced a finding capable of being
   protected, **when** a related paper or note is about to publish, or a
   related patent's priority-date deadline is approaching — whichever
   comes first — **then** IF IP has already given the finding an explicit
   disposition (patent, defensive disclosure, trade secret, or no action),
   per 0001's FR-007.
3. **Given** a dated note records a finding, **when** it is published,
   **then** it is typed as either a design pattern or an operating theory,
   so a reader knows what kind of claim it makes.
4. **Given** a patent has been granted, **when** anyone inside or outside
   the firm asks whether it justifies building, funding, or licensing
   something, **then** IF IP answers with the commercial questions (what
   problem it solves now, who has authority and budget, what is owned or
   still needs verifying, whether it can be made more valuable, and which
   commercialization path fits) — not with the grant alone.
5. **Given** a peer-reviewed paper is added to the register, **when** it is
   published, **then** it carries a DOI and stands as a record in its own
   right, not as marketing copy.
6. **Given** the public patent register is updated, **when** the update
   happens, **then** it is generated from the USPTO record, not entered by
   hand.

### Edge cases

- A finding could plausibly support either a patent or a defensive
  disclosure: the choice is deliberate — publish to keep the method
  usable, or file to exclude others — never a default that happens because
  a filing deadline was missed. A missed deadline is a failure to decide,
  not a disposition.
- A granted patent whose commercial case never gets made: it stays in the
  register as a right, without implying it justifies a venture or
  investment (0001 FR-002).
- Two research pillars produce overlapping findings: this spec does not
  resolve which pillar owns the disposition decision.
  `[NEEDS CLARIFICATION: no stated rule for resolving overlapping research
  pillars]`

## Requirements

**Research chain**

- **FR-001**: IF IP MUST group every research finding under a research
  area and a research pillar before treating it as protectable, rather
  than starting from a patent idea directly.
- **FR-002**: A research pillar MUST have a stated question and a record
  of what it has established so far; a pillar without either is not yet
  a pillar, just an area of interest.
- **FR-003**: Every dated note MUST be typed as either a design pattern or
  an operating theory at publication, so a reader knows what kind of claim
  it makes.
- **FR-004**: Every peer-reviewed paper in the register MUST carry a DOI
  and MUST be presented as a record in its own right, not as marketing.

**Disposition**

- **FR-005**: IF IP MUST give every protectable finding an explicit
  disposition — patent, defensive disclosure, trade secret, or no action
  — no later than whichever comes first: a related paper or note
  publishing, or a related patent application's priority-date deadline.
  (Restates 0001 FR-007 for IP's own operating practice.)
- **FR-006**: A defensive disclosure MUST be a deliberate choice to keep a
  method usable, decided on its own terms — never a fallback taken because
  a patent filing deadline was missed.
- **FR-007**: IF IP MUST NOT imply a registration or ownership position
  that the underlying record does not support. (Restates 0001 FR-006.)

**Registers**

- **FR-008**: The public patent register MUST be generated from the USPTO
  record rather than entered by hand. (Restates 0001 FR-008.)
- **FR-009**: Trademark and other generated registers MUST follow the same
  rule as FR-008: generated from the primary source, not hand-typed.
- **FR-010**: A specific count from any IF IP register, when it appears in
  a document outside the live register itself, MUST be date-stamped and
  named by register, per `context/registers.md`.

**Commercialization gate**

- **FR-011**: IF IP MUST NOT treat a granted patent, by itself, as
  sufficient reason to build, fund, license, or sell anything. Clean
  title, useful scope, freedom to operate, an identified customer, and
  financeable terms are all required before a right earns a commercial
  commitment.
- **FR-012**: Before choosing a commercialization path for a right (build,
  license, sell, partner, publish, maintain, narrow, or abandon), IF IP
  MUST answer the commercial questions: what problem the right solves now,
  who has authority and budget to care, what is owned or still needs
  verifying, and whether the right can be made more valuable first.

## Key entities

- **Research area** — groups related work; the top of the chain.
- **Research pillar** — a standing line of inquiry under a research area,
  with a stated question and current findings.
- **Paper / dated note** — where a finding gets recorded; typed as a
  design pattern or an operating theory. A peer-reviewed paper additionally
  carries a DOI.
- **Patent / application** — a filed, exclusionary right.
- **Defensive disclosure** — a deliberate publication that keeps a method
  usable rather than excluding others from it.
- **Trademark** — a federal or common-law mark, tracked as its own kind of
  right.
- **Trade secret** — a right protected by not disclosing it at all.
- **License** — what a counterparty can take on a right IF IP holds.
- **The patent register** (and the other generated registers) — public,
  USPTO-sourced, defined in `context/registers.md`.

## Success criteria

- **SC-001**: Every research pillar in the register states its question
  and its current findings — none sit as a bare label.
- **SC-002**: Every protectable finding has a recorded disposition by its
  trigger point (FR-005); none sit undecided past it.
- **SC-003**: No count in this repository or in `context/registers.md`
  diverges from its primary-source register without being dated and
  labeled as a point-in-time snapshot.
- **SC-004**: No commercialization decision (build, license, sell, or
  similar) is made citing a patent grant alone, without the commercial
  questions in FR-012 also answered.
- **SC-005**: Every published dated note and peer-reviewed paper is typed
  correctly (design pattern, operating theory, or DOI-bearing peer-reviewed
  record) at the time it is published, not corrected after the fact.

## Out of scope

- The commercialization decision itself (build vs. license vs. sell) is
  IF Studios' and IF Capital's to make, per their own charters — this spec
  only requires that IF IP answer the commercial questions before that
  decision gets made, not that IF IP makes it.
- Patent prosecution mechanics (claims drafting, office action response,
  outside counsel selection) are operational detail, not spec-level.
- The USPTO sync pipeline's implementation lives in the website repository,
  not here; this spec only requires that the register be generated by it,
  not how it works.

## Open questions

- **OQ-1**: No individual is named as IF IP's unit lead anywhere in the
  doctrine, distinct from Shahid N. Shah himself — unlike the general
  delegation rule's expectation that every recurring responsibility have a
  named owner (0001 FR-017). Until this is named, this spec's decision
  authority defaults to Shahid N. Shah.
- **OQ-2**: No rule resolves which research pillar owns the disposition
  decision when two pillars produce overlapping findings.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation detail — staffing, prosecution mechanics, and the
      sync pipeline's build are out of scope
- [x] Every requirement traces to `context/units/ip.md`,
      `context/registers.md`, or `0001-intellectual-frontiers/spec.md`
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact

## Traceability

| Requirement | Source |
| --- | --- |
| FR-001 – FR-004 | `context/units/ip.md` (research chain) |
| FR-005, FR-007 | `0001-intellectual-frontiers/spec.md` FR-007, FR-006 |
| FR-006 | `context/units/ip.md` (defensive disclosure as deliberate outcome) |
| FR-008 | `0001-intellectual-frontiers/spec.md` FR-008 |
| FR-009, FR-010 | `context/registers.md` (rule for citing a register) |
| FR-011, FR-012 | `context/units/ip.md` ("The rule"; commercial questions) |
| SC-001 – SC-005 | Derived directly from FR-001 – FR-012 above |
