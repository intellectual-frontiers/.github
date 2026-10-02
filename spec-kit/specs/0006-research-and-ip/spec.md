# Feature Specification: Intellectual Frontiers Research & IP

**Spec ID:** 0006-research-and-ip
**Status:** Draft

**Input:** The behavioral rules this unit's research-to-rights chain follows:
how a finding gets protected or not, how a right earns a commercial
decision, and where AI's role stops. What a research area, a pillar, a
right, or a work group actually is — the vocabulary of the chain itself —
is ontology data, not restated here.

## Research chain

- **FR-001**: A research finding MUST be grouped under a research area and a
  research pillar before it is treated as protectable, rather than being
  filed directly as a patent idea.
- **FR-002**: A research pillar MUST have a stated question and a current
  record of what it has established. A pillar lacking either is not yet a
  pillar, just an area of interest.
- **FR-003**: A note or paper MUST be typed as a design pattern or an
  operating theory before it is published, so a reader knows what kind of
  claim it makes.
- **FR-004**: A peer-reviewed paper MUST carry a DOI and MUST be presented
  as a record in its own right, not as marketing.

## Disposition

- **FR-005**: This unit MUST give every protectable finding an explicit
  disposition — patent, defensive disclosure, trade secret, or no action —
  no later than whichever comes first: a related paper or note publishing,
  or a related patent application's priority-date deadline.
- **FR-006**: A defensive disclosure MUST be a deliberate choice made on its
  own terms, never a fallback taken because a patent filing deadline was
  missed.
- **FR-007**: This unit MUST NOT imply a registration or ownership position
  that the underlying record does not support.

## Registers

- **FR-008**: Each patent family's status and filing data MUST be
  represented as its own `ExternalRecordReference`, per
  0001-eidolon-architecture FR-022 and 0007-work-and-assets FR-008 — never
  hand-typed as a literal, and never aggregated into one reference for the
  register as a whole.
- **FR-009**: A specific count from any register, when it appears outside
  the live register itself, MUST carry the date it was resolved as of, per
  0001-eidolon-architecture FR-026.

## Commercialization gate

- **FR-010**: This unit MUST NOT treat a granted patent, by itself, as
  sufficient reason to build, fund, license, or sell anything — the
  unit-boundary rule in 0003-intellectual-frontiers FR-003 applies here by
  name.
- **FR-011**: Before a commercialization path is chosen for a right, this
  unit MUST answer what problem it solves now, who has authority and budget
  to care, what is owned or still needs verifying, and whether the right
  can be made more valuable first.

## Turning research into usable work

- **FR-012**: A tool or piece of content built to make research usable MUST
  be evaluated against 0003-intellectual-frontiers' Native Alpha rule
  (FR-005, FR-006) the same as any other claimed advantage. AI capability
  alone MUST NOT be presented as satisfying it.
- **FR-013**: Executable content (a prompt, worksheet, assessment, or
  scorecard) MUST let a reader complete one useful action before any
  commercial ask is made. That first action MUST NOT be gated behind a
  purchase or a contact request.

## Outside disclosures

- **FR-014**: This unit MUST respond to an outside invention disclosure
  within ten business days of receiving a non-confidential summary of it.
- **FR-015**: This unit MUST delete unsolicited confidential material
  unread rather than review it.

## Where AI stops

- **FR-016**: AI MUST NOT be treated as having decided inventorship,
  ownership, patentability, claim meaning, enforceability, freedom to
  operate, enablement, or licensing terms. These remain decisions a person
  makes.
- **FR-017**: A patent MUST NOT be filed unless the underlying constraint is
  real, the claim follows the value it protects, and the resulting right
  would change a commercial choice.

## What this unit produces

- **FR-018**: This unit's primary output MUST be treated as a sharpened
  question, thesis, or insight — not "intellectual property" itself. A
  patent, defensive disclosure, or trademark is a byproduct that sometimes
  follows, not the goal research was aimed at.
- **FR-019**: A patent grant MUST be treated as one signal among others,
  never as proof that a customer, licensee, or market cares.

## Out of scope

- The commercialization decision itself (build, license, or sell) belongs
  to Studios and Capital, per their own future specs — this unit only
  answers the commercial questions in FR-011, it does not make that call.
- Patent prosecution mechanics (claims drafting, office action response,
  outside counsel) are operational detail.
- Whatever process keeps an `ExternalRecordReference`'s cached register
  value current is implementation detail, governed already by
  0001-eidolon-architecture FR-024 and FR-025.
- Web page shapes for a research area, pillar, note, or right (`ifweb:`
  content kinds) are deferred to a future spec, per 0002-content-format
  FR-007 — this spec establishes the business concepts; it does not yet
  establish how they're rendered as pages.

## Open questions

- **OQ-1**: No rule resolves which research pillar owns the disposition
  decision when two pillars produce overlapping findings.

## Key entities

- **A research area** — groups related work; the top of the chain.
- **A research pillar** — a standing line of inquiry under a research area,
  carrying its own question.
- **A note or paper** — where a finding is recorded; typed as a design
  pattern or an operating theory. A peer-reviewed paper additionally
  carries a DOI.
- **A disposition** — the explicit outcome a protectable finding receives:
  patent, defensive disclosure, trade secret, or no action.
- **A right** — a patent, a trademark, a trade secret, or a defensive
  disclosure; a license is what a counterparty can take on one.

## Success criteria

- **SC-001**: Every research pillar states its question and current
  findings — none sit as a bare label.
- **SC-002**: Every protectable finding has a recorded disposition by its
  trigger point; none sit undecided past it.
- **SC-003**: No commercialization decision cites a patent grant alone
  without the FR-011 questions also answered.
- **SC-004**: Every outside invention disclosure gets a response within ten
  business days; no unsolicited confidential material is reviewed rather
  than deleted.
- **SC-005**: No AI-amplified tool or content is presented as Native Alpha
  on the strength of the AI capability alone.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (what a research area, pillar, or right actually is;
      the current work-group taxonomy) is asserted here — all of it is
      ontology data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
