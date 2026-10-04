# Feature Specification: Access control policy

**Spec ID:** 0031-access-control-policy
**Status:** Draft

**Input:** Who may reach the systems inside a compliance boundary, how they
prove who they are, how much they may do, and how that access is granted,
reviewed, and taken away. It is a policy under 0030-policies, owned by the
decision authority in effect. The Eidolon's own repositories and proxy
already carry much of it; this policy extends the same rules to every
system in a boundary and cites them rather than restating them.

## Identity

- **FR-001**: Each person MUST reach a system in a boundary through an
  account of their own. An account shared by several people MUST NOT
  exist. An account used by software rather than a person (a service
  account) MUST have an owner role, and its credential MUST be held only
  as a `RestrictedDataReference` (0001-eidolon-architecture FR-023).
- **FR-002**: Every sign-in to a system in a boundary that holds anything
  beyond Public data (0033-systems-and-data-policy FR-002) MUST require a
  second factor. Every administrative account MUST use a
  phishing-resistant second factor, such as a hardware security key or a
  passkey.

## Least privilege

- **FR-003**: A person MUST be given only the access their role needs, on
  only the systems their role uses. Administrative access MUST be held in
  an account separate from the one the person uses every day, wherever
  the system allows it.
- **FR-004**: Access MUST be granted only on a request approved by the
  system's owner role (0033-systems-and-data-policy FR-001), and only once
  the person has acknowledged the policies that bind them
  (0030-policies FR-010).
- **FR-005**: Access MUST be removed within one day of a person leaving,
  or of their role no longer needing it.
- **FR-006**: Who holds access to each system in a boundary MUST be
  reviewed by its owner role at least every ninety days. Each review MUST
  be recorded as evidence (0028-compliance-controls FR-018), and access
  the review finds unneeded MUST be removed under FR-005.

## Connections and publication

- **FR-007**: A system in a boundary MUST connect to an outside system
  only where the system inventory lists that connection and the system's
  owner role approved it. Outside systems include a third-party service,
  an integration, and a personal device.
- **FR-008**: Information MUST be posted on a publicly reachable system
  only once its audience is Public (0001-eidolon-architecture FR-011).
  Each publicly reachable system MUST have an owner role who checks that
  rule before anything is posted to it.

## Credentials

- **FR-009**: Each person MUST keep their credentials in a password
  manager the company approves, and MUST NOT share a credential with
  anyone. An API token MUST be scoped to the least access its use needs,
  and MUST expire.

## Carried out by

- The vault's clone access is limited to a named circle, and everyone else
  reaches the vault only through the mediated interface:
  0001-eidolon-architecture FR-008 and FR-009.
- No credential is ever committed: 0001-eidolon-architecture FR-023 and
  0005-authentication FR-009.
- Access beyond Public needs an identified agent and a current grant,
  checked on every request: 0005-authentication FR-001, FR-003 through
  FR-005, and FR-008.
- Registrar and DNS accounts: 0023-domain-security FR-015 and FR-026.
- Assessors' access: 0028-compliance-controls FR-022.

## Out of scope

- Physical access, and the devices people sign in from. Both belong to
  0032-endpoint-and-media-policy.
- Who may see a fact in the Eidolon. That is governed by audiences, per
  0001-eidolon-architecture FR-011 through FR-014.

## Edge cases

- A deployment pipeline that signs in to a cloud account: it uses a
  service account with an owner role, and its credential is held only by
  reference, per FR-001.
- A system that offers no phishing-resistant second factor: the
  administrative account departs from FR-002 only under a lapsing
  `Decision`, per FR-002 and 0030-policies FR-012.
- A person who changes role and no longer needs a system: their access
  is removed within a day, per FR-005.
- A quarterly review finding an account nobody recognizes: the account is
  removed, per FR-006.
- A new integration with a third-party service: it is listed and approved
  before it connects, per FR-007.
- A draft about an unannounced venture, about to be posted to a public
  site: it is held back until its audience is Public, per FR-008.

## Assumptions

- Each system in a boundary supports one account per person.
- Each system can list its accounts, so its owner role can review them.

## Open questions

- **OQ-1**: Which password manager the company approves, and whether
  sister companies use the same one, is not stated.
- **OQ-2**: Whether sign-in to the systems in a boundary should go through
  one identity provider with single sign-on is not decided.

## Key entities

- **An account**: one person's, or one service's, means of signing in to
  one system.
- **An owner role**: the role that approves and reviews access to a
  system.
- **An access review**: the owner role's review, every ninety days, of who
  holds access to a system.

## Success criteria

- **SC-001**: No system in a boundary has a shared account or a
  single-factor sign-in.
- **SC-002**: No person keeps access more than a day after leaving.
- **SC-003**: Every system's access is reviewed at least every ninety
  days.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
