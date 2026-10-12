# Feature Specification: Domain security

**Spec ID:** 0023-domain-security
**Status:** Draft

**Input:** The security settings every domain name the company holds
(0022-domain-names) must carry at its registrar, in its DNS, for email,
and for the web, and how they are kept in place without anyone having to
remember them: a baseline applied by default, checked automatically, and
departed from only by a recorded decision. The settings' values live in
the DNS-as-code source and the registrar account, never in the ontology
(0022-domain-names FR-015).

## The baseline

- **FR-001**: Every `DomainName` MUST meet each control in this spec that
  applies to it. The controls are ontology data, a concept scheme with
  one concept per control, so that a check, a report, and an exception
  can each name a control exactly.
- **FR-002**: A `DomainName` MAY depart from a control only under a
  recorded `Decision` (0008-decision-records) that names the domain and
  the control by `schema:about`, states the reason, and states by
  `dcterms:valid` the date it lapses, no more than one year after it is
  decided. An exception past that date counts as a failure.
- **FR-003**: A control a domain's registry or DNS provider cannot
  support MUST be reported as not applicable for that domain, not as a
  failure and not as an exception, and the report MUST name what does
  not support it.

## At the registrar and registry

- **FR-004**: A domain's registrar transfer lock MUST be on, except while
  a transfer authorized by a `Decision` under 0022-domain-names FR-016 is
  under way.
- **FR-005**: A domain's automatic renewal MUST be on, except for a
  domain a recorded `Decision` lets lapse (0022-domain-names FR-020).
- **FR-006**: A domain's zone MUST be signed with DNSSEC and its
  delegation signer record MUST be published at the registry.
- **FR-007**: A domain's registry record MUST NOT disclose the
  registrant's personal contact details; the registrar's privacy or
  redaction service MUST be on where the registry would otherwise
  publish them.
- **FR-008**: A domain MUST be delegated only to the nameservers of the
  DNS provider that serves its zone from the DNS-as-code source. A
  delegation to any other nameserver MUST fail the check.

## Email

- **FR-009**: A domain that neither sends nor receives email MUST
  publish a null MX record, a sender policy (SPF) that authorizes no
  sender and fails all others, and a DMARC policy of reject. This covers
  every defensive, reserved, and parked domain and every redirect or
  primary domain not used for email.
- **FR-010**: A domain that sends email MUST publish a sender policy
  (SPF) naming only its authorized senders and failing all others, a
  DKIM key for each authorized sender, and a DMARC policy of quarantine
  or reject whose aggregate reports go to an address the company
  controls. A domain that receives email, or whose sender policy
  authorizes any sender, is treated as sending email, so that a domain
  with a mailbox cannot be impersonated for want of a sender policy.
- **FR-011**: A domain that receives email MUST publish an MTA-STS
  policy in enforce mode and a TLS reporting (TLS-RPT) address the
  company controls.

## Certificates and the web

- **FR-012**: Every domain MUST publish CAA records naming only the
  certificate authorities the company uses for it, with an incident
  reporting (iodef) contact. A domain that serves no web content MUST
  publish CAA records that permit no issuance at all.
- **FR-013**: A primary or redirect domain MUST answer on HTTPS with a
  valid certificate, MUST redirect plain HTTP to HTTPS, and MUST send an
  HSTS header with a maximum age of at least one year.
- **FR-014**: No DNS record of a domain MAY point at a host, service, or
  address the company no longer controls. A record whose target no
  longer resolves, or answers as unclaimed, MUST fail the check.

## Accounts

- **FR-015**: Every person who can sign in to a registrar or DNS provider
  account MUST use multi-factor authentication, and every API token for
  such an account MUST be scoped to the least access its use needs and
  MUST expire. Who holds access MUST be reviewed at least every ninety
  days.
- **FR-016**: The email address that recovers a registrar or DNS provider
  account MUST NOT depend solely on a domain held or served in that same
  account, so that losing the account cannot also cut off its recovery.

## Kept in place without remembering

- **FR-017**: Every `DomainName` MUST be checked automatically against
  every control that applies to it, from the registry's record, public
  DNS, the domain's own HTTPS answer, and read-only access to the
  registrar and DNS provider, on a cadence no longer than
  0022-domain-names FR-012's and whenever the DNS-as-code source
  changes. The check MUST NOT hold a write credential.
- **FR-018**: Each failure MUST be reported to the decision authority in
  effect, per 0001-eidolon-architecture FR-025, naming the domain, the
  control, and what was observed. A report MUST NOT carry a record value
  that 0022-domain-names FR-015 treats as sensitive.
- **FR-019**: The baseline MUST be the default. A new zone in the
  DNS-as-code source MUST start from records meeting FR-009 through
  FR-012 for its use, and a change to that source that would make a
  domain fail a control MUST be refused before it is deployed, unless an
  exception under FR-002 covers it.
- **FR-020**: A newly registered domain MUST meet the baseline within
  seven days of its registration, or be reported under FR-018.
- **FR-021**: Correcting a failure MUST go through the DNS-as-code source
  or through a person with access to the account concerned
  (0022-domain-names FR-014), never through the check itself.

## Watching for impersonation

- **FR-022**: A primary domain MUST publish a `security.txt` file
  (RFC 9116) at `/.well-known/security.txt`, naming a contact the company
  controls and an expiry date that has not passed, so that anyone who
  finds a weakness in what the company publishes knows where to report
  it.
- **FR-023**: Certificates issued for a company domain MUST be watched
  through the public certificate transparency logs. A certificate issued
  by an authority the domain's CAA records do not permit, or for a
  hostname the DNS-as-code source does not serve, MUST be reported under
  FR-018.
- **FR-024**: Domain names that look like a Public primary domain (one
  character dropped, doubled, swapped, or replaced by a neighbouring key
  or a look-alike character, or the same name under another common
  top-level domain) MUST be checked for registration on FR-017's cadence.
  One registered by anyone other than the company MUST be reported under
  FR-018; the check MUST NOT contact or act against it.

## Crown jewels

- **FR-025**: A crown jewel domain (0022-domain-names FR-021) MUST be
  registered at least two years ahead at all times, so that a failed
  renewal leaves time to notice it.
- **FR-026**: At least two people MUST be able to administer the
  registrar and DNS provider accounts that hold a crown jewel domain, each
  signing in with a phishing-resistant second factor (a hardware security
  key or a passkey), so that the domain does not depend on one person
  being reachable.
- **FR-027**: The payment method and billing contact on every registrar
  account MUST be reviewed with FR-015's access review, so that an expired
  card cannot let a domain lapse unnoticed.

## Email at scale

- **FR-028**: Bulk or newsletter email MUST be sent from a dedicated
  subdomain, never from a crown jewel domain itself, so that a sending
  problem cannot damage the reputation of the company's own address.

## Out of scope

- Hosting, application security, and the security of what a domain
  serves beyond its HTTPS answer.
- The record values that satisfy each control. They live in the
  DNS-as-code source, per 0022-domain-names FR-015.

## Edge cases

- A registry that does not support DNSSEC: the control is reported as
  not applicable for that domain, naming the registry, per FR-003.
- A parked domain with no records at all: it still needs a null MX, a
  fail-all sender policy, a reject DMARC policy, and CAA records that
  permit no issuance, per FR-009 and FR-012.
- A domain used only to send email, with no mailbox behind it: it meets
  FR-010 and, because it receives no email, not FR-011.
- A domain that receives email but sends none: it is treated as sending,
  so it still publishes a sender policy and DMARC, per FR-010, and meets
  FR-011.
- A domain moving between registrars by a recorded decision: its
  transfer lock may be off while the transfer is under way, per FR-004.
- A DMARC policy held at quarantine while senders are moved over: it
  meets FR-010; holding it at none needs an exception, per FR-002.
- An exception whose lapse date has passed: it counts as a failure and
  is reported, per FR-002 and FR-018.
- A crown jewel domain renewed for only one more year: it fails, per
  FR-025.
- A look-alike of a public brand registered by a stranger: it is
  reported and nothing is done to it by the check, per FR-024.
- A certificate for a hostname nobody configured: it is reported, per
  FR-023.
- A record left pointing at a deleted hosting service: it fails the
  check, per FR-014.

## Assumptions

- The registrar and DNS provider can be read with a credential that
  cannot change anything.
- Whether a domain sends or receives email can be read from its
  published records, as FR-010 states for sending.
- The DNS-as-code source can refuse a change before it is deployed.

## Open questions

- **OQ-1**: Which certificate authorities FR-012's CAA records name, for
  domains served through the DNS provider's proxy and for any served
  elsewhere, is not yet stated.
- **OQ-2**: Whether a registry lock, beyond the registrar transfer lock,
  is required for crown jewel domains, at its cost, is not decided.
- **OQ-3**: Where DMARC aggregate and TLS reports are received, and who
  reads them, is not yet stated.
- **OQ-4**: Whether registrar settings (transfer lock, renewal, DNSSEC
  signing) can be held in the DNS-as-code source alongside the records,
  or must be set by a person, is for DevOps to state, with
  0022-domain-names OQ-1.
- **OQ-5**: Whether a role other than the founder receives FR-018's
  reports is not yet delegated, per 0001-eidolon-architecture FR-029.
- **OQ-6**: Whether newsletter email carries a verified brand logo
  (BIMI), which needs a registered trademark and a paid mark certificate,
  is not decided.
- **OQ-7**: Who may create a subdomain, and the naming convention
  subdomains follow, are for DevOps to state with 0022-domain-names
  OQ-1.

## Key entities

- **A domain security control** — one setting this spec requires, named
  by a concept in the ontology's control scheme.
- **An exception** — a recorded `Decision` letting one domain depart from
  one control until a stated date.
- **The domain security check** — the automated, read-only check of every
  domain against every control that applies to it.

## Success criteria

- **SC-001**: Every domain either meets every control that applies to it
  or carries an unexpired exception for each one it does not.
- **SC-002**: No failure goes unreported for longer than the check's
  cadence.
- **SC-003**: No change to the DNS-as-code source that breaks a control
  is deployed without an exception.
- **SC-004**: No registrar or DNS provider account can be signed in to
  without a second factor, and none is recovered through a domain it
  holds itself.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
