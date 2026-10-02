# Feature Specification: Intellectual Frontiers Capital

**Spec ID:** 0010-capital
**Status:** Draft

**Input:** The behavioral rules Capital's allocation decisions follow: one
underwriting standard regardless of source, the search-before-build check
applied to funding rather than building, what gets routed to independent
parties, and the fund-specific discipline a care-delivery vehicle runs on.
What the funds actually are, their names, theses, and current size is
ontology and register data, not restated here.

## Underwriting standard

- **FR-001**: Capital MUST apply the same written underwriting standard to
  internally sourced and externally sourced opportunities alike.
- **FR-002**: Capital MUST NOT allocate capital on the basis of a Studio's
  activity, a patent, a publication, a relationship, or a prototype alone
  — the unit-boundary rule in 0003-intellectual-frontiers FR-003 applies
  here by name.
- **FR-003**: Capital MUST make demand, distribution, governance, reserves,
  and return assumptions explicit for every opportunity, and MUST apply
  the Native Alpha test (0003-intellectual-frontiers FR-005) as a check
  separate from, not a substitute for, that analysis.
- **FR-004**: Capital MUST fund the smallest hard proof capable of
  changing the investment decision, not the easiest visible activity.

## Search before funding

- **FR-005**: Before funding an internally originated venture, Capital
  MUST apply 0003-intellectual-frontiers FR-011's search-before-build
  rule: check whether an existing founder or company already pursues the
  same thesis credibly, and prefer backing them when their evidence is as
  strong as or stronger than the firm's own.
- **FR-006**: Capital MUST NOT measure itself, or be measured, by the
  amount of capital deployed.

## Recording a decision

- **FR-007**: A capital-allocation decision MUST be recorded as a
  `Decision`, per 0008-decision-records, naming the assumptions behind it
  as `consideredEvidence` or a stated rationale.
- **FR-008**: Where more than one person's input shaped an allocation
  decision, any disagreement with the final choice MUST be recorded
  alongside it, not only the outcome.

## Independent relationships

- **FR-009**: A related-party or cross-vehicle decision involving Capital
  MUST have a control that makes it independently reviewable, regardless
  of common ownership or trust between the parties.
- **FR-010**: Capital MUST NOT imply investment, allocation, conflict, or
  LP authority over an independent partner that it does not actually
  hold.

## Identity

- **FR-011**: Capital MUST NOT present itself as having institutional
  fund-manager tenure it does not have. Its public description MUST state
  that it is a new formal platform built on a long operating record, not
  an institution with unearned tenure.

## Capital sources

- **FR-012**: Every dollar Capital deploys MUST be traceable to a named
  source. A source MUST NOT go unnamed.

## Fund-specific rules

- **FR-013**: A company MUST meet a fund's stated qualifying condition to
  be funded under it. A qualifying condition is binary, not a factor
  weighed against others.
- **FR-014**: Before a company is incorporated under a fund's "build"
  mode, its operating model, target buyer, contract chassis, and unit
  economics MUST be settled. If they cannot be settled, the build MUST
  NOT start.
- **FR-015**: A fund's job MUST stay scoped to what it was built to prove.
  A fund proving one thing MUST NOT be treated as also responsible for
  what a different fund was built to prove.
- **FR-016**: A fund MUST NOT force a common holding period, financing
  structure, or exit schedule onto every company it holds, where its own
  terms state otherwise.

## Out of scope

- Fund structure, LP terms, carry, and fee mechanics are fund-formation
  decisions, not spec-level.
- The underwriting model's specific formulas and thresholds are
  operational detail.
- An independent partner's own governance is outside Capital's authority
  entirely, and outside this spec.
- A fund's current size and portfolio roster are point-in-time business
  facts, not operating doctrine, the same reasoning `context/registers.md`
  already applies to patent counts.

## Open questions

- **OQ-1**: No individual Capital lead is named, distinct from the
  founder — tracked company-wide per 0003-intellectual-frontiers OQ-1,
  not repeated here.
- **OQ-2**: No process is stated for resolving a disagreement between a
  specialist's licensed diligence opinion and Capital's own underwriting
  judgment.

## Key entities

- **Underwriting judgment** — demand, distribution, governance, reserves,
  and return assumptions, made explicit for a given opportunity.
- **A fund** — a distinct vehicle with its own thesis and qualifying
  condition; an `Organization`, not an asset itself.
- **A capital source** — where a deployed dollar traces back to.
- **An independent partner** — a related entity Capital has no allocation
  or LP authority over, regardless of common ownership.

## Success criteria

- **SC-001**: An external opportunity and an internal Studios opportunity,
  given equivalent evidence, receive the same underwriting treatment.
- **SC-002**: No funding decision cites a patent, publication, Studio
  activity, or relationship as sufficient justification by itself.
- **SC-003**: Every allocation decision is a recorded `Decision` with its
  assumptions stated, not just its outcome.
- **SC-004**: No care-delivery fund company is missing a settled operating
  model, target buyer, contract chassis, and unit economics at the point
  it is incorporated under "build" mode.
- **SC-005**: No fund forces a uniform holding period, financing
  structure, or exit schedule across its portfolio where its own terms
  say otherwise.
- **SC-006**: Every dollar Capital deploys traces to a named source.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (a fund's name, thesis, or current size; an
      independent partner's identity) is asserted here — all of it is
      ontology or register data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
