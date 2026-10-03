# Feature Specification: Domain names

**Spec ID:** 0022-domain-names
**Status:** Draft

**Input:** How the domain names Intellectual Frontiers holds are kept as
assets: what a domain name is, apart from the web property or other thing
it serves; which of its facts the company is the authority on and which
belong to the domain's registry; who may see that the company holds it;
where its DNS records live; and how the catalog is kept true against the
registrar and DNS provider accounts the company holds. It applies
0007-work-and-assets FR-006 through FR-008 and 0001-eidolon-architecture
FR-016 through FR-025 to domain names.

## What a domain name is

- **FR-001**: A domain name the company holds through a registrar MUST be
  represented as a `DomainName`, a kind of `IntangibleAsset` per
  0007-work-and-assets FR-006, distinct from any `DigitalAsset`,
  organization, or other thing it serves. A `DomainName` MUST NOT be typed
  as the `DigitalAsset` deployed at it, nor the reverse.
- **FR-002**: A `DomainName` MUST be the registrable name: the label
  directly beneath a public suffix (a name a registry delegates, such as a
  name under `.com` or `.co.uk`). A hostname beneath it (a subdomain) MUST
  NOT be a `DomainName` of its own; a subdomain that serves a distinct
  `DigitalAsset` is reached through that asset's own `schema:url`.
- **FR-003**: A `DomainName` MUST state the name itself as its
  `dcterms:identifier`, in lowercase, with an internationalized name in
  its ASCII (A-label) form.
- **FR-004**: A `DomainName` MUST state its rights-holder by
  `dcterms:rightsHolder`, defaulting to Intellectual Frontiers LLC per
  0007-work-and-assets FR-014. Another organization that operates the
  domain, or in whose name the registrar or DNS account holding it is
  kept, MUST NOT be stated as its rights-holder on that account alone.

## Its role

- **FR-005**: A `DomainName` MUST carry exactly one role from the
  ontology's domain role scheme, by `dcterms:type`: primary (it is the
  address of the thing it serves), redirect (it forwards to another
  domain), mail (it carries email and serves nothing else), defensive (it
  is held to protect a name, a brand, a misspelling, or another top-level
  domain, and serves nothing), reserved (it is held for a work, venture,
  or presentation not yet announced), or parked (it is held with no
  current use).
- **FR-006**: A `DomainName` whose role is primary, redirect, mail, or
  defensive MUST name what it serves by `dcterms:relation`: the
  `DigitalAsset`, organization, `Trademark`, or Eidolon component it is
  the address of or protects, or, for a redirect, the `DomainName` it
  forwards to. A reserved or parked `DomainName` MAY name one.
- **FR-007**: A `DigitalAsset`'s `dcterms:created` MUST state when the
  company began the property, not when a domain it uses was registered;
  the registration date is the registry's, per FR-010.

## Who may see it

- **FR-008**: Every domain name the company holds MUST be represented, in
  the public root if its audience is Public and in the vault otherwise,
  per 0001-eidolon-architecture FR-002 and FR-003, so that the two
  together are the complete catalog.
- **FR-009**: A `DomainName` MAY declare the Public audience only when its
  role is primary, redirect, or mail and everything it names by
  `dcterms:relation` is itself Public. A defensive, reserved, or parked
  `DomainName` MUST NOT be Public, since holding it can reveal a work, a
  venture, or a concern not yet announced.

## Facts the registry holds

- **FR-010**: A domain name's registration facts (its registrar, its
  registration and expiry dates, its status codes, its nameservers, and
  whether its delegation is signed) MUST be held as one
  `ExternalRecordReference` per `DomainName`, per 0007-work-and-assets
  FR-008, never as literals on the `DomainName` and never as one
  reference for a whole account or portfolio. The registry for the
  domain's top-level domain is their authority.
- **FR-011**: That reference's primary source MUST be the registry's own
  RDAP record for the domain, located through IANA's RDAP bootstrap
  registry. A registrar's own record MAY serve as the primary source only
  for a top-level domain whose registry offers no RDAP service.
- **FR-012**: That reference's verification method MUST be automated and
  its cadence MUST NOT be longer than thirty days, so that a lapse or an
  unexpected change of registrar or nameservers is found before it costs
  the domain.
- **FR-013**: A cached registration value MUST NOT carry the registrant's,
  administrative, or technical contact details, even where a registry
  publishes them unredacted, per 0001-eidolon-architecture FR-016.

## Registrars, DNS, and access

- **FR-014**: Each account the company holds at a registrar or DNS
  provider MUST be represented as a `RestrictedDataReference`, per
  0001-eidolon-architecture FR-023. No credential, API token, or account
  recovery detail for any such account MAY appear in any Eidolon
  repository.
- **FR-015**: A domain's DNS records MUST be kept as code, in the
  company's DNS-as-code source, which is their single source per
  0001-eidolon-architecture FR-019. They MUST NOT be asserted as facts in
  the ontology or copied into any other Eidolon repository; a record that
  exposes an origin address or a verification token is sensitive under
  0001-eidolon-architecture FR-016(c).

## Gaining, keeping, and giving up a domain

- **FR-016**: Registering or acquiring a domain name, transferring one to
  another registrar or rights-holder, and letting one lapse or deleting
  it MUST each be recorded as a `Decision`, per 0008-decision-records.
  Renewing a domain already held is routine and MUST NOT require one, per
  0001-eidolon-architecture FR-031.
- **FR-017**: A `DomainName` whose expiry, as last verified under FR-012,
  falls within sixty days MUST be reported to the decision authority in
  effect, per 0001-eidolon-architecture FR-029, unless a `Decision` to let
  it lapse is already recorded.

## Keeping the catalog true

- **FR-018**: The catalog MUST be reconciled against every registrar and
  DNS provider account represented under FR-014, on a cadence no longer
  than FR-012's. A domain held in such an account with no `DomainName`,
  and a `DomainName` held in none of them, MUST each be reported to the
  decision authority in effect.
- **FR-019**: A reconciliation run under FR-018 MUST only report; it MUST
  NOT add, change, or remove a `DomainName` on its own. Acting on a report
  follows FR-016 and FR-037 of 0001-eidolon-architecture.
- **FR-020**: A domain name the decision authority has decided to let
  lapse MAY be left out of the catalog, despite FR-008, once that
  `Decision` is recorded under FR-016; the `Decision` itself MUST name
  the domain, and reconciliation under FR-018 MUST NOT report it.

## Out of scope

- How DNS records are written, reviewed, and deployed, and which tool
  does so. That belongs to the DNS-as-code source and to whoever operates
  it; OQ-1 records what this spec still needs to know about it.
- Certificates, email authentication policy, and hosting. They are
  configuration of what a domain serves, not facts about the domain as an
  asset.
- What a domain name is worth. Valuation is Capital's financial-asset
  territory, per 0007-work-and-assets.

## Edge cases

- A web property that moves to a new domain: the property stays one
  `DigitalAsset`, the new name is a new `DomainName` related to it, and
  the old name becomes a redirect or is let lapse by a recorded decision,
  per FR-001, FR-005, FR-006, and FR-016.
- A subdomain serving a distinct product: it is not a `DomainName`; the
  product is a `DigitalAsset` whose `schema:url` names the subdomain, per
  FR-002.
- A domain bought to protect a brand that is already public: it is
  defensive and still not Public, because which misspellings and other
  top-level domains the company guards is itself revealing, per FR-009.
- A domain held for a venture still known only by a code name: it is
  reserved and held in the vault, per FR-008 and FR-009.
- A registry that publishes a registrant's contact details: they are not
  cached, per FR-013.
- A domain found at the registrar with no `DomainName`: reconciliation
  reports it and changes nothing, per FR-018 and FR-019.
- A domain nearing expiry that the company means to drop: no report is
  needed once a `Decision` to let it lapse is recorded, per FR-016 and
  FR-017.
- A misspelled registration the company will not renew: once a
  `Decision` to let it lapse names it, it is left out of the catalog and
  reconciliation does not report it, per FR-020.
- A domain a sister company operates, in an account kept in that
  company's name: the company that holds it by policy is still its
  rights-holder, per FR-004.

## Assumptions

- Every top-level domain the company uses has a registry reachable for
  re-verification, through RDAP or, failing that, a registrar's record.
- Registrar and DNS provider accounts can be listed with read-only access,
  so that FR-018's reconciliation needs no write credential.
- The DNS-as-code source is held somewhere at least as restricted as the
  vault.

## Open questions

- **OQ-1**: Where the DNS-as-code source lives, which tool deploys it to
  each DNS provider, how a change to it is reviewed, and how a
  `RestrictedDataReference` names it are not yet stated; DevOps is to
  supply them.
- **OQ-2**: Which registrars hold the domain names that are served by the
  primary DNS provider but registered elsewhere, and how FR-018's
  reconciliation reaches those registrars, are not yet stated.
- **OQ-3**: No rule says whether a `DomainName` that has lapsed or been
  transferred away stays in the catalog, or what marks it as no longer
  held.
- **OQ-4**: No rule says whether a domain's delegation must be signed
  (DNSSEC), or whether its registrar transfer lock must be on.

## Key entities

- **A domain name** — a registrable name the company holds through a
  registrar; an intangible asset in its own right, apart from what it
  serves.
- **A domain role** — why the company holds a domain name: primary,
  redirect, mail, defensive, reserved, or parked.
- **A domain registration reference** — the `ExternalRecordReference`
  pointing at a domain name's registry record, checked automatically.
- **A registrar or DNS provider account** — where domain names are held
  and served, represented only as a `RestrictedDataReference`.
- **The DNS-as-code source** — the single source of a domain's DNS
  records, outside the ontology.

## Success criteria

- **SC-001**: Every domain name held at any registrar account the company
  holds appears as exactly one `DomainName`, in the public root or the
  vault.
- **SC-002**: No `DomainName` carries a registration fact as a literal;
  each has exactly one registration reference, checked within the last
  thirty days.
- **SC-003**: No defensive, reserved, or parked `DomainName` is Public.
- **SC-004**: No credential for a registrar or DNS provider account, and
  no DNS record, appears in any Eidolon repository.
- **SC-005**: No domain lapses without either a recorded `Decision` to let
  it go or a report to the decision authority at least sixty days before
  expiry.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
