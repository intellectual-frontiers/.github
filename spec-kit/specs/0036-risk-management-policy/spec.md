# Feature Specification: Risk management policy

**Spec ID:** 0036-risk-management-policy
**Status:** Draft

**Input:** How the company finds, weighs, and treats the risks to what each
compliance boundary commits to, and how it keeps that judgment current.
It is a policy under 0030-policies, owned by the decision authority in
effect.

## The risk register

- **FR-001**: Each risk to a boundary's commitments MUST be recorded in
  the risk register. Each entry states:
  - what could happen, and which boundary it affects;
  - its likelihood and its impact, each from the ontology's risk rating
    scheme;
  - its owner role;
  - its treatment: mitigate, accept, transfer, or avoid;
  - for a risk being mitigated, the requirements or controls that do it.

  A detail that would itself be sensitive under
  0001-eidolon-architecture FR-016, such as how a weakness could be
  exploited, MUST be held only by reference.
- **FR-002**: A risk the company accepts MUST be accepted by the decision
  authority in effect, in a `Decision` that names the risk and lapses by
  `dcterms:valid` no more than one year after it is decided. When it
  lapses, the risk is assessed again.

## Assessing

- **FR-003**: Each boundary's risks MUST be assessed at least once a
  year. They MUST also be assessed when something significant changes:
  a new entity, a new kind of system or data, a new framework or
  contract obligation, an acquisition, a new critical vendor, or a
  serious incident. Each assessment MUST be recorded as evidence
  (0028-compliance-controls FR-018).
- **FR-004**: Each assessment MUST consider fraud: how someone inside or
  outside the company could misuse a system, falsify a record, or
  override a control.
- **FR-005**: Each assessment MUST consider the risks a vendor carries
  (0037-vendor-management-policy) and the risk of business disruption
  (0039-business-continuity-policy).

## Carried out by

- Every departure from a control is a decided, lapsing record:
  0028-compliance-controls FR-012.
- Gaps and lapsing dispositions are reported every week:
  0028-compliance-controls FR-025.
- Capital decisions carry their own underwriting:
  0010-capital FR-001.

## Out of scope

- Investment and venture risk, which 0010-capital and 0011-studios
  govern.

## Edge cases

- A risk the company decides to live with for now: it is accepted by a
  `Decision` that lapses within a year, per FR-002.
- A newly signed contract that adds a notification deadline: the
  boundary's risks are assessed again, per FR-003.
- One person able both to approve and to pay an invoice: the assessment
  considers it as a fraud risk, per FR-004.
- A cloud provider on which every boundary depends: the assessment
  considers it as vendor and disruption risk, per FR-005.

## Assumptions

- The company's commitments to customers are known well enough to assess
  risks against them.

## Open questions

- **OQ-1**: The scales of the risk rating scheme, and the rating above
  which a risk may not be accepted, are not yet stated.

## Key entities

- **A risk**: something that could stop a boundary meeting its
  commitments, rated and treated.
- **A risk acceptance**: a lapsing `Decision` to live with a risk.
- **A risk assessment**: the yearly, or triggered, review of a
  boundary's risks.

## Success criteria

- **SC-001**: Every boundary's risks are assessed at least once a year.
- **SC-002**: No accepted risk goes more than a year without being
  decided again.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
