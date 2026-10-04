# Feature Specification: Endpoint and media policy

**Spec ID:** 0032-endpoint-and-media-policy
**Status:** Draft

**Input:** How the devices people use to reach systems in a compliance
boundary are kept safe, how storage media are disposed of, and how
physical access is controlled where the company has premises. It is a
policy under 0030-policies, owned by the decision authority in effect.

## Devices

- **FR-001**: A device MUST be enrolled in the company's device management
  before it reaches any system in a boundary that holds anything beyond
  Public data (0033-systems-and-data-policy FR-002). This covers laptops,
  desktops, and phones, whoever owns them. Device management records are
  held outside every Eidolon repository, and are represented only by a
  `RestrictedDataReference` (0001-eidolon-architecture FR-023).
- **FR-002**: An enrolled device MUST meet all of the following:
  - its storage is encrypted;
  - it locks after no more than fifteen minutes idle;
  - it runs an operating system its maker still supports;
  - it installs security updates within fourteen days of their release.
- **FR-003**: An enrolled device MUST run malicious code protection that
  updates itself whenever its maker releases new protection. It MUST scan
  files from outside sources as they are downloaded, opened, or run, and
  scan the whole device periodically.
- **FR-004**: A device that is lost or stolen, or that may have been
  compromised, MUST be reported as an incident
  (0035-incident-response-policy FR-002). Where device management allows
  it, the device MUST be wiped remotely.

## Media

- **FR-005**: Storage media that have held Confidential data or above
  (0033-systems-and-data-policy FR-002) MUST be sanitized or destroyed
  before they are disposed of or reused, by a method NIST SP 800-88
  recognizes. Each disposal MUST be recorded as evidence
  (0028-compliance-controls FR-018). Media includes a device's own
  storage, removable drives, and paper.

## Physical access

- **FR-006**: Premises that the company controls and that house a system
  in a boundary MUST do all of the following:
  - limit physical access to authorized people;
  - escort and monitor visitors;
  - keep a log of physical access;
  - control and account for keys, badges, and other access devices.
- **FR-007**: Where a boundary includes no premises the company controls,
  the physical access controls MUST each be recorded as not applicable
  (0028-compliance-controls FR-012). The record names the hosting
  providers whose own assurance covers the boundary's hosted systems
  (0037-vendor-management-policy FR-003). Devices are still kept under
  the person's control, and are never left unlocked and unattended.

## Carried out by

- An exposed secret is rotated, and removed from history:
  0001-eidolon-architecture FR-036.
- A lost or compromised device is an incident:
  0035-incident-response-policy FR-001.

## Out of scope

- Who may sign in, and with what. That belongs to
  0031-access-control-policy.
- The physical security of a hosting provider's data center. It is that
  provider's, held by reference under 0037-vendor-management-policy.

## Edge cases

- A personal phone used for company email: it is enrolled before it
  reaches the mail system, per FR-001.
- A laptop whose maker has stopped issuing updates: it fails FR-002 and
  is replaced, or departs only under a lapsing `Decision`, per
  0030-policies FR-012.
- A laptop left in a taxi: it is reported as an incident and wiped
  remotely, per FR-004.
- An old drive from a laptop that held customer data: it is sanitized or
  destroyed, and the disposal is recorded, per FR-005.
- A boundary whose systems are all hosted by cloud providers, with no
  office: its physical access controls are recorded as not applicable,
  citing the providers' assurance, per FR-007.

## Assumptions

- The company uses a device management service able to enforce FR-002 and
  FR-003, and to wipe a device remotely.
- People work from places the company does not control, with no office of
  the company's own.

## Open questions

- **OQ-1**: Which device management service the company uses, and whether
  sister companies share it, is not stated.
- **OQ-2**: Whether a device a person owns may reach Restricted data or
  federal contract information at all, rather than only once enrolled, is
  not decided.

## Key entities

- **An enrolled device**: a device under the company's device management,
  meeting FR-002 and FR-003.
- **A disposal record**: evidence that one piece of media was sanitized or
  destroyed.

## Success criteria

- **SC-001**: No unenrolled device reaches a system holding anything
  beyond Public data.
- **SC-002**: No storage media that held Confidential data or above leaves
  the company's control unsanitized.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
