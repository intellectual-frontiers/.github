# Feature Specification: Systems and data policy

**Spec ID:** 0033-systems-and-data-policy
**Status:** Draft

**Input:** How the company keeps track of the systems inside each
compliance boundary and the data each one holds. This spec covers:

- the system inventory;
- the data classification every system declares;
- how each class of data is handled, kept, and deleted;
- how systems are separated from the internet;
- what systems log.

It is a policy under 0030-policies, owned by the decision authority in
effect. A system's place in a boundary is the boundary's
`dcterms:hasPart` (0028-compliance-controls FR-009).

## The inventory

- **FR-001**: Every system that stores or processes the company's data,
  or a customer's, within a boundary MUST be in the system inventory and
  named by that boundary. Each entry MUST state:
  - the system's owner role;
  - the highest data class it holds (FR-002);
  - the provider that hosts or supplies it, as a vendor
    (0037-vendor-management-policy FR-001);
  - its connections to outside systems (0031-access-control-policy
    FR-007);
  - its recovery objectives (0039-business-continuity-policy FR-001).

  An account, an address, or a configuration value that would be
  sensitive under 0001-eidolon-architecture FR-016 MUST be held only by
  reference.
- **FR-002**: Every system MUST declare its highest data class from the
  ontology's data classification scheme:
  - **Public**: may be published;
  - **Internal**: the company's own, not for publication;
  - **Confidential**: the company's or a customer's, whose disclosure would
    harm them;
  - **Restricted**: sensitive under 0001-eidolon-architecture FR-016;
  - **Federal contract information**;
  - **Health information**: information a business associate agreement or
    health privacy law protects.

  Controlled Unclassified Information is not a class any system holds
  without a recorded `Decision` under 0028-compliance-controls FR-021.
- **FR-003**: The inventory MUST be reconciled at least once a year
  against the company's hosting and software accounts and against the
  vendor register. A system found in an account but missing from the
  inventory MUST be added to the inventory or shut down.

## Handling each class

- **FR-004**: Data classed Confidential or above MUST be encrypted
  whenever it is sent over a network and wherever it is stored. Each
  connection MUST use TLS 1.2 or later, or an equivalent.
- **FR-005**: Restricted data, federal contract information, and health
  information MUST be held only in systems whose inventory entry declares
  that class.
- **FR-006**: Each class beyond Public MUST have a retention period,
  stated in the data classification scheme or by a contract that
  overrides it. Data past its retention period MUST be deleted, unless a
  legal hold recorded as a `Decision` keeps it.

## Separation from the internet

- **FR-007**: A system holding Confidential data or above MUST NOT be
  reachable from the internet except through an interface that requires
  sign-in under 0031-access-control-policy. Traffic at the system's
  boundary MUST be monitored and filtered.
- **FR-008**: A system component that the public can reach, such as a
  website, MUST be separated from internal components, physically or
  logically, so that compromising it does not reach the internal network.

## Logs

- **FR-009**: Every system holding Confidential data or above MUST log
  sign-ins, failed sign-ins, and administrative actions. It MUST keep
  those logs for at least one year, and MUST alert its owner role to
  activity the system's provider flags as anomalous. A log is subject to
  the same audience and sensitivity rules as what it records
  (0005-authentication FR-011).

## Carried out by

- The Eidolon itself: facts declare audiences, and sensitive facts are
  never literals: 0001-eidolon-architecture FR-011, FR-016, and FR-021.
- Access to Eidolon content beyond Public is logged:
  0005-authentication FR-010.
- Domains, their DNS, and their certificates: 0022-domain-names FR-018
  and 0023-domain-security FR-013.
- Government information never enters an Eidolon repository:
  0028-compliance-controls FR-019.

## Out of scope

- How each system meets FR-004 and FR-007. That is each system's own
  configuration.
- Personal information that privacy law, rather than security, governs.
  OQ-2 records it.

## Edge cases

- A software service someone signed up for, holding customer data, that
  is missing from the inventory: reconciliation finds it, and it is added
  or shut down, per FR-003.
- A spreadsheet of customer contacts kept in a general file share: the
  share's inventory entry declares Confidential, and the share is
  encrypted, per FR-002 and FR-004.
- Federal contract information found in a system not declared for it: it
  is moved and the finding is handled as an incident, per FR-005 and
  0035-incident-response-policy FR-001.
- A customer contract requiring deletion within thirty days of the
  contract ending: the contract overrides the class's retention period,
  per FR-006.
- A public website on the same host as an internal database: the two are
  separated, per FR-008.

## Assumptions

- Every hosting provider the company uses can show which systems run in
  its accounts.
- Hosting providers' own logging can meet FR-009.

## Open questions

- **OQ-1**: The retention period for each data class is not yet stated.
- **OQ-2**: Whether a separate privacy policy should govern personal
  information is not decided. Such a policy would answer privacy law and
  the SOC 2 privacy criteria.
- **OQ-3**: Which systems each boundary includes is still
  0028-compliance-controls OQ-3.

## Key entities

- **A system**: something that stores or processes data within a
  boundary, with an owner role, a data class, a provider, and recovery
  objectives.
- **A data class**: one level of the data classification scheme, with its
  handling rules and retention period.
- **The system inventory**: every system in every boundary, reconciled
  yearly.

## Success criteria

- **SC-001**: Every system that holds the company's or a customer's data
  is in the inventory with a data class.
- **SC-002**: No Restricted data, federal contract information, or health
  information sits in a system not declared for it.
- **SC-003**: No system holding Confidential data or above is reachable
  from the internet without sign-in.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
