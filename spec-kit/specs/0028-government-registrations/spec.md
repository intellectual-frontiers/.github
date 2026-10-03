# Feature Specification: Government registrations

**Spec ID:** 0028-government-registrations
**Status:** Draft

**Input:** How the company keeps the registrations and filings it must hold
with governments. This spec covers:

- federal award registration, with the identifiers it assigns;
- assessments and affirmations recorded in a government system;
- tax exemption and annual returns;
- state entity and charitable filings.

They are kept the way domain registrations are kept (0022-domain-names):
the government's record is the authority, the company holds a dated
reference to it, and expiry is reported before it costs anything.
0001-eidolon-architecture FR-022 through FR-025 apply to every
registration, and this spec adds what is particular to registrations.
Which entities hold which registrations is ontology data, not stated
here.

## What a registration is

- **FR-001**: Each registration or recurring filing that an entity in scope
  (FR-002) holds with a government, or with a registry a government
  designates, MUST be represented as one `ExternalRecordReference` for
  that entity and that registration. Its kind MUST come from the
  ontology's registration kind scheme, by `dcterms:type`. One reference
  MUST NOT stand for several registrations, or for several entities.
- **FR-002**: The entities in scope are of two kinds:
  - every entity named as the provider of a compliance boundary
    (0027-compliance-controls FR-009);
  - any other entity that a recorded `Decision` brings into scope.
- **FR-003**: A registration's reference MUST describe, by
  `ifcore:describes`, the `Organization` that holds the registration. The
  exception is a reference that records an assessment of, or an
  affirmation about, a compliance boundary. That reference MUST describe
  the boundary.
- **FR-004**: A registration's status, the identifiers it assigns, and its
  dates belong to the government. They MUST NOT be stated as literals on
  the `Organization` or anywhere else. They sit only on the reference: as
  its cached value, and, for the date the registration lapses, as its
  `dcterms:valid`. Either kind of cached value needs the reference's
  `ifcore:resolvedAt` (0001-eidolon-architecture FR-022).
- **FR-005**: A recurring filing, such as an annual return or a state
  annual report, MUST be represented as a registration whose
  `dcterms:valid` is the date the next filing is due. Once a filing is
  made, re-verifying the reference moves that date on.

## Where the record is, and how often it is read

- **FR-006**: A reference's primary source MUST be the government's own
  record of the registration where a public one exists. Examples are the
  federal award registration's public entity record, the tax authority's
  exempt organization search, and a state's business entity search. A
  government system with no public record of the registration is named
  by its location, and its reference is verified manually.
- **FR-007**: A reference MUST be re-verified at least every ninety days.
  Its verification method MUST be automated only where the government
  offers a read-only interface the company can use without a write
  credential. Otherwise the method is manual.
- **FR-008**: A cached value MUST NOT carry any of the following:
  - a personal detail of a point of contact (0001-eidolon-architecture
    FR-016(b));
  - banking or payment details;
  - a taxpayer identification number.

  An identifier that the government publishes for anyone to look up MAY be
  cached, such as a unique entity identifier or a commercial and
  government entity code. A taxpayer identification number MUST be held
  only as a `RestrictedDataReference`.

## Keeping it current

- **FR-009**: A registration whose `dcterms:valid` falls within ninety days
  MUST be reported to the decision authority in effect
  (0001-eidolon-architecture FR-025). One whose `dcterms:valid` has
  passed MUST be reported as a failure. Neither report is made when a
  recorded `Decision` already lets that registration lapse.
- **FR-010**: Each of the following MUST be recorded as a `Decision`
  (0008-decision-records): obtaining a registration, letting one lapse,
  and withdrawing one. Renewing a registration already held, and making a
  recurring filing, are routine and MUST NOT require one
  (0001-eidolon-architecture FR-031).
- **FR-011**: A representation, certification, or affirmation made to a
  government is the act of the official its regime names. No check, AI,
  or automation MAY make, submit, or renew one. Examples are the
  representations and certifications in a federal award registration and
  an affirmation of cybersecurity compliance. A tool MAY draft and remind;
  the official acts. A reference records who acted only by role, never by
  personal detail.
- **FR-012**: An affirmation that a boundary meets a framework MUST name
  that framework's catalog or collection by `dcterms:conformsTo`. It MUST
  NOT be current while that boundary has a gap, or an accepted-risk or
  planned-remediation disposition, for any control the framework selects
  (0027-compliance-controls FR-007, FR-012, FR-013). Such an affirmation
  MUST be reported as a failure.

## Kept in place without remembering

- **FR-013**: The shape of every registration reference MUST be checked
  offline on every change to the ontology. The check covers its kind, its
  subject, its cadence, its primary source, and the dated parts of its
  cached value (FR-001, FR-003, FR-004, FR-007).
- **FR-014**: Every registration MUST appear in the compliance status
  report (0027-compliance-controls FR-025), which lists:
  - every registration overdue for re-verification;
  - every registration whose `dcterms:valid` falls within ninety days or
    has passed;
  - every affirmation FR-012 makes a failure.

## Out of scope

- What a filing says, and the company's tax and financial affairs.
- Who holds the accounts the company files through. Each such account is a
  `RestrictedDataReference` (0001-eidolon-architecture FR-023), held in
  the vault.
- Which frameworks a boundary follows, and assessments that a party
  outside government holds. These belong to 0027-compliance-controls.

## Edge cases

- A federal award registration due for renewal in sixty days: it is
  reported, per FR-009, and renewing it needs no `Decision`, per FR-010.
- A registration the company has decided not to renew: once the
  `Decision` is recorded, its expiry is not reported, per FR-009 and
  FR-010.
- A cybersecurity self-assessment recorded in a government system: it is a
  registration describing the boundary assessed, per FR-001 and FR-003.
- An affirmation made while a required practice is still unmet: it is
  reported as a failure, per FR-012.
- A government record that publishes a point of contact's name and email:
  neither is cached, per FR-008.
- A tax exemption, which does not expire: its reference carries no
  `dcterms:valid`, while the annual return that keeps it is a filing that
  does carry one, per FR-004 and FR-005.
- A government system that has no public record and no read-only
  interface: its reference names the system's location and is verified
  manually at least every ninety days, per FR-006 and FR-007.
- An AI asked to submit the annual affirmation: it may draft it and remind
  the official, and may not submit it, per FR-011.

## Assumptions

- Each government whose registration the company holds keeps the record
  reachable for re-verification at least as often as FR-007 requires.
- Ninety days is enough notice to renew any registration the company
  holds.
- The official who makes each affirmation is identifiable by role.

## Open questions

- **OQ-1**: Whether the company keeps registrations for an organization
  outside its ownership, such as an independent non-profit, is not
  decided. Such an organization would be brought into scope under FR-002.
- **OQ-2**: Several things about automated verification are not yet
  stated:
  - which government records offer a read-only interface that FR-007
    could automate;
  - where any key such an interface needs is held;
  - who obtains that key.
- **OQ-3**: Who the affirming official is for each entity's cybersecurity
  affirmation is not yet delegated (0001-eidolon-architecture FR-029).
- **OQ-4**: Whether some kinds of registration need more notice than
  FR-009's ninety days is not yet stated.

## Key entities

- **A registration**: an `ExternalRecordReference` to one entity's record
  with one government registry, of one kind, re-verified at least every
  ninety days.
- **A registration kind**: what a registration is, for example a federal
  award registration, a cybersecurity assessment or affirmation, a tax
  exemption, an annual return, a state annual report, or a charitable
  solicitation registration.
- **An affirmation**: a registration recording an official's statement
  that a boundary meets a framework, made only by that official.

## Success criteria

- **SC-001**: No registration lapses without either a report to the
  decision authority at least ninety days before it lapses, or a recorded
  `Decision` to let it go.
- **SC-002**: No registration fact is stated as a literal outside its
  reference, and no reference caches a personal detail, banking details,
  or a taxpayer identification number.
- **SC-003**: No affirmation is current while the boundary it covers falls
  short of the framework it affirms.
- **SC-004**: No representation, certification, or affirmation is made by
  anything other than the official its regime names.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
