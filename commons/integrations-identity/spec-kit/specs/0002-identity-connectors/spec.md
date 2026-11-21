# Feature Specification: Identity and device connectors

**Spec ID:** 0002-identity-connectors
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A managed service provider reads the identity and device posture of each customer: who has a second factor, whether a policy requires it, which managed devices are encrypted and compliant. This library has three read-only connectors for that, written against the read port of Integrations (commons integrations), so that none can write and none reaches a network of its own: a Microsoft Entra tenant, Microsoft Intune's managed devices and a Google Workspace domain. They are proved against recorded, made-up answers shaped as the vendors document them, and never yet against a live tenant.

## Requirements

- **FR-001**: Each connector MUST have governance as data that the integrations library accepts: read-only (`writes: never`), one named read-only scope for each resource it reads, a credential reference and a hint that names the read-only permission and no other, a daily cadence, and an HTTPS transport limited to the hosts of the system and of its token service; the governance MUST be a function of the tenant or domain it is for.
- **FR-002**: The Entra connector MUST read the authentication-method registrations, the conditional access policies and the organization, and observe the number of users, of users without multifactor authentication and of administrators without it, whether an enabled conditional access policy requires multifactor authentication, and the number of policies; its posture policies MUST fail where an administrator has no second factor or no enabled policy requires one, and warn where a user has none.
- **FR-003**: The Intune connector MUST read the managed devices and observe their number and the number of devices not encrypted, not compliant and not checked in for 30 days (a device that has never checked in counts), each device as an asset; its policies MUST fail where a device is not encrypted and warn for the other two.
- **FR-004**: The Google Workspace connector MUST read the users and observe the number of users that are not suspended, of those without two-step verification and of administrators (and delegated administrators) without it; its policies MUST fail where an administrator is not enrolled and warn where a user is not.
- **FR-005**: A connector MUST keep counts, and the identity of an administrator only; it MUST NOT keep the name or address of a user who is not an administrator, nor any serial number, phone number, address or email address of a device or user, nor any field the vendor sends that the connector does not read.
- **FR-006**: Where the credential may not read a part, the connector MUST report a gap for it and observe the rest, and MUST NOT report the posture fact that part would give (an unread fact is a gap, never a pass); where the system cannot be reached at all it MUST be an error.
- **FR-007**: Each connector MUST pass the conformance suite of integrations over recorded answers.

## Acceptance scenarios

1. **Given** an Entra tenant where one administrator has no second factor, **When** it is observed and checked, **Then** the policy for administrators fails, per FR-002.
2. **Given** a credential that may not read the conditional access policies, **When** it is observed, **Then** a gap is reported and `mfa-required-by-policy` is absent from the posture, per FR-006.

## Out of scope

- The HTTP transport, the token exchange and paging of each vendor: a physical layer of the program that runs the connector, behind the read port.
- Writing anything to a vendor.
- Guests, groups, applications, sign-in logs and licences.
- The other connectors of the first ten (remote monitoring and management, professional services automation, endpoint detection, security training, backup, a second identity provider): they need documentation and a test tenant for each, and are built when those are at hand.

## Edge cases

- A device that has no check-in date counts as not checked in, per FR-003.
- A suspended Google user is not counted, per FR-004.

## Assumptions

- The recorded answers keep the field names of the vendors' documentation as of the date of the spec; a live run that finds another shape is a defect of the connector, and the first live run is where that is learned.

## Open questions

- None.

## Key entities

- **Connector**, **Posture fact**, **Gap**.

## Success criteria

- **SC-001**: A provider can read, read-only, who has a second factor and which devices are encrypted for a customer on Microsoft 365 or Google Workspace.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
