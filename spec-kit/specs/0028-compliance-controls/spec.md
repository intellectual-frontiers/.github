# Feature Specification: Compliance controls

**Spec ID:** 0028-compliance-controls
**Status:** Draft

**Input:** How the company keeps its compliance obligations as specs and
has them audited as specs. Covered obligations include attestation
frameworks such as SOC 2, and contract safeguarding regimes such as CMMC
and NIST SP 800-171. This spec covers:

- each framework as a catalog of controls;
- one boundary for each legal entity that follows a framework;
- the link from each spec requirement to the controls it addresses;
- departing from a control, which takes a recorded decision;
- evidence kept long enough to be audited;
- keeping controlled government information out of every Eidolon
  repository;
- how an assessor is given access.

It reuses the model of NIST's Open Security Controls Assessment Language
(OSCAL): catalogs, profiles, system security plans, assessment results,
and plans of action and milestones. It reuses that model rather than
inventing one, per 0019-controlled-vocabulary FR-001. Which entities
have boundaries, and which frameworks they follow, is ontology data in
the vault, not stated here.

## Control catalogs

- **FR-001**: Each framework the company follows MUST be represented as a
  `ControlCatalog`. A `ControlCatalog` is a SKOS concept scheme that
  corresponds to an OSCAL catalog. It holds one concept for each control,
  that is, each criterion, requirement, or practice the framework defines.
  Each concept's `skos:notation` MUST be the framework's own identifier
  for the control. The catalog's own `skos:notation` MUST be a short code
  that is unique among catalogs. With these two codes, a requirement, a
  departure, an assessment, and a report can each name a control exactly.
- **FR-002**: A control concept MUST NOT carry text that its publisher
  holds copyright in. It carries the control's identifier, and its catalog
  MUST name the authoritative publication by `dcterms:source`. AICPA's
  Trust Services Criteria MUST be referenced by identifier only. A control
  that a US Government work defines is in the public domain, so it MAY
  carry a short definition of its own.
- **FR-003**: Which revision of a framework is current is decided by its
  publisher. Each `ControlCatalog` MUST therefore have exactly one
  `ExternalRecordReference` to the publisher's record of the current
  revision, re-verified at least once a year. A new revision MUST be
  reported to the decision authority in effect. Adopting a new revision is
  an amendment to the catalog, made in spec, ontology, then implementation
  order (0001-eidolon-architecture FR-037). It never happens on its own.
- **FR-004**: Some framework levels or categories select only part of a
  catalog, for example a SOC 2 trust services category. Such a level or
  category MUST be a `skos:Collection` of the controls it selects. This
  collection corresponds to an OSCAL profile. A level that selects a whole
  catalog is that catalog, and needs no separate collection.

## Requirements address controls

- **FR-005**: A spec requirement that addresses a control MUST be linked to
  it in its repository's control map, at `spec-kit/controls.tsv`. The map
  holds one row for each pair of requirement and control. It names the
  requirement the same way the enforcement register does
  (0020-spec-format FR-011), and names the control as
  `<catalog notation>:<control notation>`. The specs are the
  implementation, and the control map is the crosswalk. A requirement that
  addresses controls in several frameworks is therefore stated once and
  mapped once to each control. It is never restated for each framework.
- **FR-006**: Every row in a control map MUST name a requirement that
  exists in that repository and a control that exists in a catalog. A row
  MUST NOT link a requirement that only mentions a control's subject
  without stating a testable rule about it. This is the honesty that
  0020-spec-format FR-013 asks of the enforcement register.
- **FR-007**: A control in a boundary's baseline (FR-009) that no
  requirement addresses, and that no unexpired disposition covers
  (FR-012), MUST be reported as a gap.
- **FR-008**: Some controls are addressed only by requirements whose
  enforcement register row is `none` (0020-spec-format FR-014). Such a
  control MUST be reported as untested, not as addressed.

## Boundaries

- **FR-009**: Each legal entity that follows a framework MUST have its own
  `ComplianceBoundary`, which corresponds to the system an OSCAL system
  security plan describes. The boundary MUST name:
  - the entity, by `schema:provider`;
  - the catalogs or collections it must meet, by `dcterms:conformsTo`;
    together these are its baseline;
  - the systems inside it, by `dcterms:hasPart`.

  One boundary MUST NOT cover two legal entities, even when they are under
  common ownership. A system that serves more than one entity MAY be part
  of more than one boundary.
- **FR-010**: A boundary's system security plan MUST be generated from what
  the Eidolon already holds. That means:
  - the boundary's baseline;
  - the control maps;
  - each mapped requirement's enforcement;
  - the boundary's dispositions;
  - its evidence.

  The plan MUST NOT be kept as a separate document that restates any of
  these (0001-eidolon-architecture FR-019). An assessor may need a
  narrative that nothing else states, such as a system description. That
  narrative MAY be written once, in the vault, and the plan cites it.
- **FR-011**: Creating a boundary, retiring one, and changing its baseline
  MUST each be recorded as a `Decision` (0008-decision-records), because
  each one changes what the company commits to.

## Departing from a control

- **FR-012**: A boundary MAY depart from a control in its baseline only
  under a recorded `Decision`. The `Decision` MUST name the boundary and
  the control by `schema:about`. It MUST carry exactly one disposition
  from the ontology's control disposition scheme, by `dcterms:type`:
  - **not applicable**: the control cannot apply within the boundary, and
    the `Decision` says why;
  - **accepted risk**: the control applies and is not met, and the
    decision authority accepts the risk;
  - **planned remediation**: the control applies and is not yet met.
    This corresponds to an OSCAL plan of action and milestones item.

  The `Decision` MUST state by `dcterms:valid` the date it lapses, no more
  than one year after it is decided. A planned remediation lapses on the
  date by which it is to be met. A disposition past its lapse date counts
  as a gap (FR-007).
- **FR-013**: Some frameworks forbid an open plan of action for their
  controls; CMMC Level 1 is one. Such a framework's catalog or collection
  MUST say so, by `dcterms:type`, with the ontology's concept for it. A
  boundary MUST NOT carry an accepted-risk or planned-remediation
  disposition for a control that such a framework selects.

## Evidence

- **FR-014**: A run of a check, or a review, that shows a control operated
  MUST be recorded in an evidence ledger. Examples are a run of the
  vault's checks, the domain security check, a reconciliation, and an
  access review. Each run gets one entry, which MUST state:
  - what ran;
  - the commit or source state it ran against;
  - when it ran;
  - its outcome;
  - a SHA-256 digest of its full output.
- **FR-015**: The ledger MUST be append-only and tamper-evident. Each entry
  MUST carry the digest of the entry before it, so that removing or
  altering an entry breaks the chain. An entry MUST NOT be edited or
  removed.
- **FR-016**: An entry, and the output it digests, MUST be kept for at
  least three years after the entry is recorded. They MUST be kept longer
  wherever a framework, contract, or law in scope requires it. Neither MAY
  depend on a store whose own retention is shorter, such as a continuous
  integration service's artifact or log retention.
- **FR-017**: Evidence MUST declare the same audiences as what it
  describes. Evidence MUST NOT carry any of the following:
  - a sensitive literal (0001-eidolon-architecture FR-016);
  - a credential;
  - controlled government information (FR-019).
- **FR-018**: A review that a requirement defines (0020-spec-format
  FR-012) and that is evidence of a control MUST be recorded in the ledger
  when it is done. The entry names who performed the review by role, never
  by personal detail, and states the review's outcome. This lets the
  review be shown to have happened on its cadence.

## Controlled government information

- **FR-019**: Federal contract information, Controlled Unclassified
  Information, and any other information that a contract requires the
  company to safeguard MUST NOT be stored in any Eidolon repository in any
  form. The forbidden forms include a fact, a file, a commit message, an
  issue, a check's output, and an evidence entry. Such information is
  sensitive under 0001-eidolon-architecture FR-016(a) and (c). The system
  that holds it MUST be represented only by a `RestrictedDataReference`,
  and that system MUST be part of the boundary of the entity that the
  contract binds.
- **FR-020**: A marking or dissemination control on government information
  MUST NOT be modelled as an audience. No audience or `Grant` MAY be read
  as authorizing access to information that FR-019 covers; the contract
  and the system that holds the information govern who may see it.
- **FR-021**: A system MUST NOT hold Controlled Unclassified Information
  for any entity until a recorded `Decision` names that system and the
  boundary it sits in. That boundary's baseline MUST include a catalog
  that safeguards such information.

## Assessors

- **FR-022**: An assessor's or auditor's access MUST be granted only
  through an `Agreement` audience for the engagement, which names the
  boundary by `schema:about`, and a `Grant` to that audience. The `Grant`
  MUST state `validUntil`, no more than one year after its `validFrom`.
  The access MUST be served through the mediated interface, never by
  repository access (0001-eidolon-architecture FR-009).
- **FR-023**: An assessment that a party outside the company makes or
  holds about a boundary MUST be held as an `ExternalRecordReference` that
  describes the boundary. Examples are an attestation report and a
  certification. The reference MUST carry its kind, by `dcterms:type`,
  from the ontology's assessment kind scheme. It MUST state by
  `dcterms:valid` the date the assessment stops being current. The report
  itself MUST NOT be committed to any Eidolon repository. An assessment
  that a government system records is a registration, governed by
  0029-government-registrations.

## Kept in place without remembering

- **FR-024**: The shape of the catalogs, control maps, boundaries,
  dispositions, assessor grants, and assessments (FR-001, FR-005, FR-006,
  FR-009, FR-012, FR-013, FR-022, FR-023) MUST be checked offline on every
  change to either repository's ontology or control map.
- **FR-025**: A compliance status report MUST be produced at least weekly
  and reported to the decision authority in effect
  (0001-eidolon-architecture FR-025). Each run MUST keep one current
  report rather than add another. For each boundary, it lists:
  - its gaps (FR-007);
  - its untested controls (FR-008);
  - each disposition lapsing within thirty days, or already lapsed;
  - each assessment no longer current, or ceasing to be current within
    ninety days;
  - each reference it depends on that is overdue for re-verification
    (0001-eidolon-architecture FR-024).

  The report MUST only report. It MUST NOT add, change, or remove anything
  it reports on.

## Out of scope

- Which entities have boundaries, which frameworks each follows, and which
  systems each includes. These are ontology data in the vault.
- Policies, and the records a framework expects about people, vendors,
  risks, systems, and incidents. Each is a later spec built on this one.
- Which product keeps the evidence ledger. OQ-1 records what this spec
  still needs to know about it.
- Government registrations, and assessments recorded in a government
  system. These belong to 0029-government-registrations.

## Edge cases

- A requirement that addresses both a SOC 2 criterion and a CMMC practice:
  it is stated once and has one control map row for each control, per
  FR-005.
- A control that only a requirement enforced by `none` addresses: it is
  reported as untested, per FR-008.
- A system that serves two sister companies: it is part of both
  boundaries, while each boundary still covers one entity, per FR-009.
- A system description an assessor asks for: it is written once in the
  vault and cited by the generated plan, per FR-010.
- A physical access control at a company with no premises: it is
  recorded as not applicable, with the reason, and is re-decided within a
  year, per FR-012.
- A CMMC Level 1 practice that is not yet met: no plan of action may cover
  it, so it stays a gap until it is met, per FR-013.
- A planned remediation whose date passes before the control is met: it
  counts as a gap and is reported, per FR-007, FR-012, and FR-025.
- A check whose report has been deleted from the CI service after its
  retention period: the ledger still holds the entry and the digested
  output, per FR-016.
- An evidence entry for a check whose output names a family office
  domain: it declares the narrow audience that domain has, per FR-017.
- A contract document that carries a federal contract information
  marking: it is not committed anywhere in the Eidolon, and the system
  that holds it is named only by reference, per FR-019.
- An auditor who asks to clone the vault: access is given only through a
  time-limited grant on the mediated interface, per FR-022.
- A SOC 2 report the company receives: it is held by reference, never
  committed, per FR-023.

## Assumptions

- Each framework the company follows publishes stable identifiers for its
  controls.
- One requirement's rule can address a control in full or in part, and an
  assessor judges the sufficiency of the whole. The control map records
  that a requirement addresses a control, not that the control is
  satisfied.
- The vault's checks can read both repositories' ontologies and control
  maps.

## Open questions

- **OQ-1**: Where the evidence ledger is kept is not yet stated. It could
  be a vault directory or a dedicated evidence store. Also unstated is how
  a continuous integration run writes to the ledger without holding any
  wider write credential.
- **OQ-2**: Several things are not yet decided for each SOC 2 boundary:
  - which trust services categories beyond Security it includes;
  - whether its first examination is Type 1 or Type 2;
  - the period a Type 2 examination covers;
  - how long after a report's period it is treated as current under
    FR-023.
- **OQ-3**: Which systems each boundary includes, and how a system is
  described, are not yet stated. A system inventory with data
  classification is a later spec.
- **OQ-4**: No rule states how a requirement of the public root applies
  inside the boundary of an entity other than Intellectual Frontiers LLC.
  The question arises for a sister company running its own systems:
  whether it adopts these specs by `Decision`, or keeps its own.
- **OQ-5**: How a contract's own retention period is recorded is not
  stated. This matters wherever the period is longer than FR-016's three
  years.
- **OQ-6**: Whether the CMMC Level 1 catalog's practices should also be
  linked to their NIST SP 800-171 identifiers is not decided. They could be
  linked before any boundary needs Level 2, or only once one does.

## Key entities

- **A control catalog**: one framework's controls, each named by the
  framework's own identifier. Corresponds to an OSCAL catalog.
- **A control collection**: the controls a framework level or category
  selects. Corresponds to an OSCAL profile.
- **The control map**: each repository's register linking its spec
  requirements to the controls they address. This is the crosswalk across
  frameworks.
- **A compliance boundary**: one legal entity's systems and baseline.
  Corresponds to the system an OSCAL system security plan describes.
- **A disposition**: a recorded `Decision` letting one boundary depart from
  one control until a stated date: not applicable, accepted risk, or
  planned remediation.
- **The evidence ledger**: a dated, digested, append-only record of each
  run that shows a control operated.
- **An assessment**: an external party's report on a boundary, held by
  reference.

## Success criteria

- **SC-001**: For every control in every boundary's baseline, the report
  can say which requirements address it, how each is enforced, and which
  evidence shows it operated. Where none of these exist, a disposition
  covers the control.
- **SC-002**: No control text that its publisher holds copyright in
  appears in any Eidolon repository.
- **SC-003**: No disposition lasts longer than a year without being
  decided again.
- **SC-004**: No evidence entry can be removed or altered without the
  ledger showing it.
- **SC-005**: No federal contract information or Controlled Unclassified
  Information is in any Eidolon repository.
- **SC-006**: No assessor holds access without an end date.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
