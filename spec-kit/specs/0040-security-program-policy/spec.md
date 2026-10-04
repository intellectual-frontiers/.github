# Feature Specification: Security program policy

**Spec ID:** 0040-security-program-policy
**Status:** Draft

**Input:** The company's information security program as a whole: what it
is, who oversees it, how it is reviewed and communicated, and how it is
assessed independently. It joins the other policies under 0030-policies
and the requirements they cite into one program covering every
compliance boundary. It is itself a policy under 0030-policies, owned by
the decision authority in effect.

## The program

- **FR-001**: The company's information security program MUST consist of
  the policies held under 0030-policies, the requirements they cite, and
  each repository's control map (0028-compliance-controls FR-005). The
  program applies in every boundary whose entity has adopted it. A
  security rule held anywhere else is not part of the program until a
  policy cites it.
- **FR-002**: Every security responsibility in the program MUST be held by
  a role. The decision authority in effect holds each one not delegated
  (0001-eidolon-architecture FR-029).

## Oversight

- **FR-003**: The decision authority in effect MUST review the program as
  a whole at least once a year. The review covers the latest compliance
  status report, the risk assessments, the incidents and their reviews,
  every assessment of a boundary, and every disposition in force. Each
  review MUST be recorded as a `Decision` that names the program's policy
  by `schema:about`, and lapses by `dcterms:valid` within a year
  (0030-policies FR-006).
- **FR-004**: A decision about the program MUST be made from what the
  Eidolon generates, such as the status report and the system security
  plan (0028-compliance-controls FR-010, FR-025), and never from a copy
  kept apart from it.

## Communication

- **FR-005**: The program's policies MUST be available to everyone they
  bind (0030-policies FR-009), and the people they bind MUST be told when
  one changes.
- **FR-006**: Each boundary MUST state its security commitments to its
  customers. Customers and others outside the company MUST be given a
  published way to report a security concern or a complaint about it.

## Independent assessment

- **FR-007**: Each boundary MUST be assessed independently, against each
  framework in its baseline, as often as that framework requires. The
  assessor MUST be independent of the people who run the controls it
  assesses. Each assessment is held by reference
  (0028-compliance-controls FR-023).

## Carried out by

- A named decision authority, delegated explicitly:
  0001-eidolon-architecture FR-029.
- Every requirement names what tests it, and the specs are checked on
  every push: 0020-spec-format FR-011 and FR-015.
- Every framework is a control catalog, and every boundary a baseline:
  0028-compliance-controls FR-001 and FR-009.
- Gaps and lapsing dispositions are reported every week:
  0028-compliance-controls FR-025.
- A published contact for security reports: 0023-domain-security FR-022.

## Out of scope

- Each topic's own rules. The other policies hold them.

## Edge cases

- A rule in a team's own document that no policy cites: it is not part of
  the program until a policy cites it, per FR-001.
- A responsibility nobody has been given: the decision authority holds
  it, per FR-002.
- A yearly review in a year with no incidents: it still records a
  `Decision`, per FR-003.
- A spreadsheet of controls someone keeps by hand: it is not used for
  decisions, and the generated report is used instead, per FR-004.
- A customer who wants to report a weakness: they use the published
  contact, per FR-006.

## Assumptions

- The company is small enough that one decision authority can oversee
  the whole program.

## Open questions

- **OQ-1**: A single-member company has no board independent of
  management. Whether an independent advisor should take part in the
  yearly review is not decided.
- **OQ-2**: Where each boundary's security commitments to customers are
  published is not yet stated.

## Key entities

- **The security program**: every policy, the requirements they cite, and
  the control maps.
- **A program review**: the decision authority's yearly review of the
  whole program, recorded as a `Decision`.

## Success criteria

- **SC-001**: The program is reviewed as a whole at least once a year.
- **SC-002**: Every security responsibility has an owner role.
- **SC-003**: Every boundary is assessed independently as often as its
  frameworks require.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
