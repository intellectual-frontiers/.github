# Feature Specification: Vendor management policy

**Spec ID:** 0037-vendor-management-policy
**Status:** Draft

**Input:** How the company chooses, relies on, reviews, and leaves the
vendors and subprocessors whose services hold its data, or its customers'
data, or that systems in a compliance boundary depend on. A vendor's own
assurance, such as an attestation report, a certification, or a
government authorization, belongs to someone else, so the company holds
it by reference, the way it holds a registration
(0029-government-registrations). It is a policy under 0030-policies,
owned by the decision authority in effect.

## The vendor register

- **FR-001**: Each vendor MUST be recorded in the vendor register if it
  holds or can reach data classed Internal or above
  (0033-systems-and-data-policy FR-002), or if a system in a boundary
  depends on it. Each entry states:
  - the service the vendor provides;
  - the data classes it holds;
  - the boundaries and systems that use it;
  - its owner role;
  - its criticality from the ontology's vendor criticality scheme;
  - the `Agreement` its terms are in.

  An account at a vendor MUST be held only as a
  `RestrictedDataReference` (0001-eidolon-architecture FR-023).
- **FR-002**: A vendor that would be critical, or would hold Restricted
  data, federal contract information, or health information, MUST be
  assessed before it is used. Onboarding it MUST be recorded as a
  `Decision` (0008-decision-records).

## Assurance

- **FR-003**: A critical vendor's assurance MUST be held as an
  `ExternalRecordReference` describing the vendor. It carries its kind
  (for example a SOC 2 Type 2 report, an ISO/IEC 27001 certificate, or a
  FedRAMP authorization), states by `dcterms:valid` when it stops being
  current, and is re-verified at least once a year. The report or
  certificate itself MUST NOT be committed to any Eidolon repository.
- **FR-004**: Each control a vendor's assurance expects its customers to
  operate themselves (a complementary user entity control) MUST be
  addressed by a requirement in the control map, or covered by a
  disposition (0028-compliance-controls FR-012).

## Terms

- **FR-005**: A vendor's `Agreement` MUST oblige it to keep the company's
  data confidential, to protect it, and to notify the company of a
  breach within a stated time, which becomes a notification obligation
  under 0035-incident-response-policy FR-005. A vendor that holds health
  information MUST have signed a business associate agreement. A vendor
  that holds federal contract information MUST be bound by the
  safeguarding requirements of FAR 52.204-21, flowed down to it.

## Reviewing and leaving

- **FR-006**: Each critical vendor MUST be reviewed at least once a year,
  against its assurance, its incidents, and whether the company still
  needs it. Each review MUST be recorded as evidence
  (0028-compliance-controls FR-018).
- **FR-007**: When the company stops using a vendor, the vendor's access
  MUST be revoked, and the company MUST obtain confirmation that its
  data was returned or deleted, before the register entry is closed.

## Carried out by

- Registrar and DNS provider accounts are held only by reference:
  0022-domain-names FR-014.
- Assessments of the company itself are held by reference:
  0028-compliance-controls FR-023.

## Out of scope

- Buying decisions on price or features, which are the owner role's.
- Vendors that hold only Public data and on which no boundary depends.

## Edge cases

- A cloud provider hosting every boundary: it is critical, its SOC 2 Type
  2 report is held by reference and re-verified yearly, and its
  complementary user entity controls are mapped, per FR-001, FR-003, and
  FR-004.
- A vendor whose attestation report has expired: the status report shows
  it as no longer current until a new one is verified, per FR-003.
- A transcription service asked to process recordings that contain health
  information: it needs a business associate agreement first, per FR-005.
- A subcontractor working on a Department of Defense contract: the
  safeguarding requirements are flowed down to it, per FR-005.
- A vendor the company leaves: its access is revoked, and deletion is
  confirmed before its entry closes, per FR-007.

## Assumptions

- Critical vendors provide current assurance on request, under
  confidentiality.

## Open questions

- **OQ-1**: The levels of the vendor criticality scheme are not yet
  stated.
- **OQ-2**: Whether customers are told of the company's subprocessors, and
  how, is not decided.

## Key entities

- **A vendor**: an outside party whose service holds the company's data,
  or on which a boundary depends.
- **A vendor's assurance**: its own attestation, certification, or
  authorization, held by reference.
- **A complementary user entity control**: a control a vendor relies on
  its customers to operate.

## Success criteria

- **SC-001**: Every vendor holding data classed Internal or above is in
  the register.
- **SC-002**: No critical vendor's assurance goes more than a year
  without re-verification.
- **SC-003**: No vendor keeps access after the company has stopped using
  it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
