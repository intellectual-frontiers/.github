# Feature Specification: Policies

**Spec ID:** 0030-policies
**Status:** Draft

**Input:** How the company holds the policies a compliance framework expects:
access control, incident response, vendor management, and the rest. Each
policy is a thin spec. It states the commitment, makes the rules no other
spec makes yet, and cites the requirements that already carry it out, so
that a policy never restates a rule held elsewhere. This spec also covers:

- how a policy is approved;
- how a policy is reviewed every year;
- how the people a policy binds acknowledge it, without any personal detail
  entering an Eidolon repository.

It applies 0020-spec-format to policies and 0028-compliance-controls to
their controls.

## What a policy is

- **FR-001**: A policy MUST be a spec whose slug ends in `-policy`. It
  follows 0020-spec-format like any other spec.
- **FR-002**: A policy MUST NOT restate a rule another spec already makes.
  It MUST cite that rule by spec and requirement instead, in a section
  headed `Carried out by`, placed before its closing sections. Its own
  requirements state only what no other spec states yet.
- **FR-003**: Each policy MUST be represented in the ontology as a
  `dcterms:Policy`. Its `dcterms:identifier` is the policy's Spec ID.
- **FR-004**: The controls a policy addresses MUST be recorded in the
  control map, against the policy's own requirements and the requirements
  it cites (0028-compliance-controls FR-005), and never only in the
  policy's prose.

## Approval and review

- **FR-005**: A policy is approved when the decision authority in effect
  moves it to `Adopted` (0020-spec-format FR-010). A policy still in
  `Draft` MUST be reported as not yet approved by the compliance status
  report (0028-compliance-controls FR-025).
- **FR-006**: Each `Adopted` policy MUST be reviewed by the decision
  authority in effect when it is adopted and at least once a year after
  that. Each review MUST be recorded as a `Decision` that names the
  policy by `schema:about` and states by `dcterms:valid` when the next
  review is due, no more than one year after the review. A review is not
  the adoption itself, which stays a commit (0020-spec-format FR-010). An
  `Adopted` policy with no current review MUST be reported.
- **FR-007**: A review that changes a policy MUST change it as a spec
  amendment, in spec, ontology, then implementation order
  (0001-eidolon-architecture FR-037). A review that changes nothing still
  records its `Decision`.
- **FR-008**: Each policy MUST name, in its `Input`, the role that owns it.
  The owner is the decision authority in effect unless a recorded
  delegation names another role (0001-eidolon-architecture FR-029).

## Who a policy binds

- **FR-009**: A policy binds every person who works on a system within a
  compliance boundary whose entity has adopted the policy. This includes
  people working for a sister company, and contractors.
- **FR-010**: Each person a policy binds MUST acknowledge it before they
  first have access to a system in the boundary, and again after each
  review that changes it.
- **FR-011**: An acknowledgment, and anything else that names a person or
  says what they did, MUST be held outside every Eidolon repository. It
  MUST be represented only by a `RestrictedDataReference`
  (0001-eidolon-architecture FR-016(b), FR-023). The Eidolon MAY state
  how many people have acknowledged a policy, and how many have not yet,
  as a count with the date the count was taken.

## Departing from a policy

- **FR-012**: A departure from a policy's rule MUST be recorded the way a
  departure from a control is: as a `Decision` that names the boundary
  and the policy by `schema:about`, states why, and lapses by
  `dcterms:valid` no more than one year after it is decided
  (0028-compliance-controls FR-012).

## Out of scope

- How a sister company adopts a policy. That is 0028-compliance-controls
  OQ-4.
- Where acknowledgments are kept. FR-011 says only that they are kept
  outside the Eidolon.

## Edge cases

- A policy whose only rules are already made by other specs: it cites
  them in `Carried out by` and has few requirements of its own, per
  FR-002.
- A policy adopted without a review `Decision`: the status report shows it
  as unreviewed until one is recorded, per FR-006.
- A yearly review that finds nothing to change: it records a `Decision`
  and no amendment, per FR-007.
- A contractor at a sister company working on a system in a boundary: the
  policy binds them, and they acknowledge it before their first access,
  per FR-009 and FR-010.
- A request to list who has not acknowledged a policy: the Eidolon states
  only a count, and the names stay in the system that holds the
  acknowledgments, per FR-011.
- A team that cannot meet a policy's rule for a quarter: the departure is
  a lapsing `Decision`, per FR-012.

## Assumptions

- The company keeps a system, outside the Eidolon, in which people
  acknowledge policies and that can report who has done so.
- An assessor accepts a policy that cites the rules it relies on, instead
  of restating them.

## Open questions

- **OQ-1**: Which system holds acknowledgments, and who reads it, is not
  yet stated.
- **OQ-2**: Whether a policy is published to customers and assessors as
  its spec, or as a rendered document generated from it, is not decided.

## Key entities

- **A policy**: a spec ending in `-policy`, represented as a
  `dcterms:Policy`, that states a commitment and cites the rules carrying
  it out.
- **A policy review**: a `Decision`, at adoption and at least yearly,
  that names the policy and when the next review is due.
- **An acknowledgment**: a person's confirmation that they have read a
  policy, held outside the Eidolon and counted inside it.

## Success criteria

- **SC-001**: No `Adopted` policy goes more than a year without a
  recorded review.
- **SC-002**: No rule appears in two specs; each policy cites the rule
  instead.
- **SC-003**: No person's name or acknowledgment appears in any Eidolon
  repository.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
