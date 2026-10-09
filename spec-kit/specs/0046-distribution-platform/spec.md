# Feature Specification: The distribution platform

**Spec ID:** 0046-distribution-platform
**Status:** Draft

**Input:** How a work's renditions reach people outside the Eidolon, and how
the people who may have them are known: keeping renditions, delivering them,
sharing a review copy or a private copy by email, selling a rendition directly,
serving anonymous and authenticated readers from one website, and growing the
audience that finds them. This spec states what the company builds itself and
when it considers a vendor, how the platform is deployed so that no host owns
it, how it separates anonymous requests from authenticated ones, and what it
records. What a rendition is and how it is delivered is
0015-work-packages FR-014 to FR-018; a cut, 0016-press-production FR-025; who
may see what, 0001-eidolon-architecture and 0005-authentication; the generated
public pages, 0044-public-website. Every feature of distribution, now and
later, is stated here before it is built.

## Building and buying

- **FR-001**: A distribution feature MUST be stated by a requirement of this
  spec before it is built, and MUST follow this spec once built
  (0001-eidolon-architecture FR-037). A feature no requirement states MUST NOT
  be built.
- **FR-002**: The company MUST build and own each distribution capability
  itself, to the house engineering method, Bare Metal Software: start from the
  protocol or the platform's own capability; use a library only where it
  removes more complexity, risk and obligation than it adds; and keep state in
  the simplest reliable form. A vendor MUST NOT supply a distribution
  capability except under FR-003. The platform is a Rust program
  (0025-tooling-environment FR-030).
- **FR-003**: A vendor MAY be considered for a capability only when it helps
  generate audience, sales or revenue by doing something the company cannot do
  itself: reach to readers the company has no channel to, a marketplace or
  retail listing, accepting payment, a tax or legal obligation that only a
  licensed party can carry, or a sending reputation the company cannot build.
  Saving effort, or a lower cost, MUST NOT alone justify a vendor.
- **FR-004**: Considering a vendor MUST NOT adopt it. Adopting a vendor MUST be
  a person's act (0016-press-production FR-027), recorded as a `Decision`
  (0008-decision-records FR-001) that names the capability; what the vendor
  does that the company cannot; the audience, sales or revenue effect expected
  and how it will be measured; the data classes the vendor will hold
  (0033-systems-and-data-policy FR-002); the boundary of FR-005; and the
  answers of FR-007. The vendor MUST also be entered in the vendor register
  (0037-vendor-management-policy FR-001, FR-002).
- **FR-005**: A vendor MUST sit behind a boundary the company owns: a standard
  protocol, or a narrow adapter the company holds, so that replacing the
  vendor changes that adapter alone. A vendor's identifier, data model or
  workflow MUST NOT become the only way the company can operate; the platform
  MUST keep its own identifiers for works, renditions, recipients, purchases
  and entitlements.
- **FR-006**: Every dependency the platform carries, whether a vendor service,
  a library or a hosted component, MUST have an entry in the dependency
  ledger: what it is, the protocol or platform capability it wraps, the
  features the platform uses, the data it holds, and how it is replaced. A
  dependency MUST NOT be added without its entry, and the ledger MUST be
  reviewed at least once a year.
- **FR-007**: Each vendor's disappearance test MUST be answered when the vendor
  is adopted and at least once a year after: whether, if the vendor vanished,
  people could still authenticate, the data could still be read, the platform
  could still be deployed, a fresh agent could rebuild the boundary from its
  description, and service could be restored on other compute. A "no" MUST be
  recorded with the work that removes it.
- **FR-008**: Everything the platform holds about works, renditions,
  recipients, purchases, entitlements and access MUST be exportable in open
  formats that any program can read, and an export MUST be tested at least
  once a year.

## Deployment

- **FR-009**: The platform MUST ship as a container image built from committed
  source and committed tooling. It MUST read its configuration from the
  environment and keep its state on a volume that survives replacing the
  container. One container is the norm; a second MUST have a stated technical
  reason in the dependency ledger (FR-006).
- **FR-010**: The platform MUST NOT depend on any one host's proprietary
  runtime, storage, database or interface for its operation. A host's
  container service MAY run it. Moving it to another host MUST need only its
  image, its configuration and a restore of its backup, with no change to its
  code.
- **FR-011**: The platform MUST run on a person's own computer from the same
  image that is deployed, so that what is tested there is what runs.
- **FR-012**: Each host that runs the platform MUST be described in the
  ontology and entered in the system inventory
  (0033-systems-and-data-policy FR-001) before it is used, and the
  credentials a deploy needs MUST be read from the environment and written to
  no file (0044-public-website FR-022).
- **FR-013**: The platform's state MUST be backed up to a location separate
  from its host (0039-business-continuity-policy FR-003), and a restore onto a
  scratch host MUST be tested at least once a month and recorded as evidence
  (0028-compliance-controls FR-018).

## Anonymous and authenticated requests

- **FR-014**: The platform MUST serve two kinds of request. A request with no
  identified agent MUST be served only the `Public` audience
  (0005-authentication FR-001). A request from an identified agent MUST be
  served beyond `Public` only what that agent's currently valid grants allow,
  checked on that request (0005-authentication FR-004, FR-005).
- **FR-015**: Content beyond the `Public` audience MUST reach a requester only
  through the platform evaluating that request. It MUST NOT be in a generated
  public file, in a repository served directly, or at an address that answers
  without the evaluation.
- **FR-016**: A request for content the requester may not see MUST answer
  exactly as an address that is not served (0044-public-website FR-016). No
  page, listing, sitemap, redirect, header or error message MAY reveal that
  the content, or its work, exists.
- **FR-017**: Access beyond `Public` MUST be logged (0005-authentication
  FR-010). The log MUST be held in the platform's own store and MUST NOT be
  committed to any repository (0005-authentication FR-011).
- **FR-018**: A session MUST expire (0005-authentication FR-008). No
  credential, session token or key MAY be a literal in any repository
  (0005-authentication FR-009), and the platform MUST NOT implement its own
  transport security, signing or credential handshake where a mature, reviewed
  library exists.
- **FR-019**: A rendition MUST be served to the public, free or sold, only
  after its work's publication `Decision` (0015-work-packages FR-025). Before
  it, a rendition MAY be served only to an identified agent holding a valid
  grant, and it MUST be marked on its face as unpublished
  (0015-work-packages FR-018).

## The archive and delivery

- **FR-020**: Every rendition delivered under 0015-work-packages FR-016 MUST be
  kept in the platform's archive: outside every repository, named by a hash of
  its content, with its bytes matching the checksum of its delivery record
  (0015-work-packages FR-017). An archived rendition MUST NOT be altered or
  overwritten; a corrected printing is a new rendition
  (0016-press-production FR-024).
- **FR-021**: An archived rendition MUST be served only through the platform
  (FR-015). An address issued to a recipient MUST be made when it is asked
  for, MUST expire, MUST be revocable, and MUST NOT be held in a delivery
  record or any repository (0015-work-packages FR-017).
- **FR-022**: Moving a rendition into the archive, giving a recipient access to
  a rendition before its work's publication `Decision`, and publishing it MUST
  each be a person's act. The platform MAY draft any of them for the person; an
  agent MUST NOT do them.
- **FR-023**: A rendition sent to a named recipient MAY carry a mark of that
  recipient, added to the copy served. The archived original MUST stay
  unchanged, and the mark MUST be recorded in the access log (FR-017).

## Sharing and review copies

- **FR-024**: Sharing a rendition with a person by email MUST send a link the
  platform issues to that identified recipient (FR-021), not the file, unless a
  person decides otherwise for that send.
- **FR-025**: A review copy MUST be a review cut (0016-press-production
  FR-025) shared under a grant that has an end date (0005-authentication
  FR-003), that the company can revoke, and every access to which is logged
  (FR-017). Revoking the grant MUST end access at the next request
  (0005-authentication FR-005).
- **FR-026**: Mail the platform sends MUST be written to an outbox before it
  is sent, so that a sending outage delays mail and never loses it. The outbox
  MUST be kept as the record of what was sent.

## Sales

- **FR-027**: A sale of a rendition MUST confer an entitlement to that
  rendition, named by the company's own identifiers for the work, edition,
  printing and format, and held in the platform's own record. Access MUST be
  decided from that record on each request, never by asking a payment
  provider at that moment.
- **FR-028**: Where the platform takes payment, a card number MUST NOT be
  received, processed or stored by the platform, and the payment provider MUST
  sit behind the boundary of FR-005.
- **FR-029**: A price MUST be read from the work's public record
  (0015-work-packages FR-029), never restated. Money MUST be held as a whole
  number of the currency's smallest unit together with the currency. A sale, a
  refund, an entitlement and a revocation MUST each be recorded.
- **FR-030**: A refund or a revocation MUST end the entitlement from that
  moment. The access already logged MUST remain.

## Records

- **FR-031**: The platform MUST keep an append-only audit record of every
  write: who made it, what it was, when, and the state before and after,
  written in the same transaction as the change. Nothing MAY delete from it.
  Erasing a person MUST replace their identifiers with a token, record the
  erasure, and keep the events.
- **FR-032**: Data about a recipient, a buyer or a reader MUST be held only in
  the platform's store and MUST NOT be committed to any repository; where a
  repository must mention it, it MUST use a `RestrictedDataReference`
  (0001-eidolon-architecture FR-023). The platform's inventory entry MUST
  declare the highest data class it holds (0033-systems-and-data-policy
  FR-002).

## Growing the audience

- **FR-033**: A feature that collects a reader's contact details, such as a
  list, a sample request or a download gate, MUST record what was consented
  to and when, MUST honour its withdrawal, and MUST belong to a promotion
  layer record, never to a work's source (0016-press-production FR-044,
  FR-045).
- **FR-034**: A free sample or an excerpt of a work is a rendition and MUST
  follow FR-019 and FR-020.
- **FR-035**: The platform MUST measure its downloads and sales from its own
  records (FR-031).

## The website

- **FR-036**: The platform and the generated public pages MUST be deployable
  as one website at one domain (0044-public-website FR-024). The platform MUST
  add no page to the generated public files, and the generated pages stay
  governed by 0044-public-website.

## Out of scope

- Which vendors are considered or adopted, which host runs the platform, which
  storage holds the archive, and which authentication mechanism it uses: these
  are decisions or open questions below, not rules here.
- Print and retail listings submitted to an outside vendor's own site, which
  0016-press-production governs and FR-003 permits.
- The generated public pages, a work's lifecycle, cuts, and ISBNs
  (0044-public-website, 0015-work-packages, 0016-press-production).

## Edge cases

- A vendor offers a cheaper way to send mail: it is not considered on cost
  alone, per FR-002 and FR-003.
- A mail provider carries a sending reputation the company cannot build: it is
  considered, and adopted only by a person's `Decision` with its boundary and
  its exit, and the outbox keeps mail safe if it fails, per FR-003, FR-004,
  FR-005 and FR-026.
- An anonymous request for the address of a private rendition: it answers as an
  address that is not served, per FR-014 and FR-016.
- A reviewer's grant is revoked while the reviewer holds a link: the next
  request is refused, per FR-021 and FR-025.
- The platform's host is lost: the image, its configuration and the last backup
  start it on another host, per FR-010 and FR-013.
- The payment provider is down: access is decided from the platform's own
  entitlement record, per FR-027, and only new sales wait.
- A work that is not yet published has a sample requested: the sample is a
  rendition and is served only to an identified agent holding a valid grant,
  per FR-019 and FR-034.
- A recipient asks to be forgotten: their identifiers are replaced by a token
  and the events stay, per FR-031.
- A reviewer's copy carries a mark of that reviewer: the archived original is
  unchanged and the mark is in the access log, per FR-023.
- A vendor is adopted and later disappears: its adapter alone is replaced, and
  the data is read from the export, per FR-005, FR-007 and FR-008.

## Assumptions

- Every host the platform may run on offers a container runtime and a volume
  that survives replacing the container.
- The platform's code is maintained mainly by an AI coding harness working from
  this spec and its tests; if people must maintain it by hand, FR-002's
  balance between direct protocol use and a library needs revisiting.
- A vendor considered under FR-003 offers either a standard protocol or an
  export of the company's data.
- 0005-authentication leaves the authentication mechanism open
  (0005-authentication FR-002), so this spec constrains only what its result
  must satisfy.

## Open questions

- **OQ-1**: Which storage holds the archive, which 0015-work-packages FR-016
  leaves to a decision outside that spec, is not decided.
- **OQ-2**: Which host runs the platform first, and whether the generated public
  pages and the platform share a host, is not decided.
- **OQ-3**: How an outside person proves identity, and whether a buyer needs an
  account, is not decided (0005-authentication FR-002).
- **OQ-4**: Whether a delivery record is made when a rendition is cut or when it
  is delivered, and whether a copy served to one recipient has a record of its
  own, is not decided (0015-work-packages FR-017).
- **OQ-5**: Whether a request for content beyond `Public` may proceed when its
  access cannot be logged is not decided (0005-authentication OQ-2).
- **OQ-6**: Whether a sale's entitlement is a grant that needs the founder's
  `Decision` under 0005-authentication FR-006, or is conferred under a standing
  delegation, is not decided.
- **OQ-7**: Which vendors, if any, are considered under FR-003 is not decided,
  and none is adopted.
- **OQ-8**: Whether a buyer of an earlier printing is given a corrected
  printing is not decided.
- **OQ-9**: The licence terms, any copy protection, and any site licence for an
  organization are not decided.
- **OQ-10**: Who is the seller of record, how tax is handled, and how long
  buyer and access data are kept are not decided.
- **OQ-11**: The platform's storage engine is not decided; FR-002 constrains
  the choice and does not make it.
- **OQ-12**: Which audience-growth features the platform carries beyond
  FR-033 to FR-035, such as bundles or referral codes, is not decided.

## Key entities

- **The distribution platform** — the service the company builds to keep,
  deliver, share and sell renditions and to know who may have them.
- **The archive** — the platform's store of delivered renditions, each named by
  a hash of its content.
- **An entitlement** — a recipient's or buyer's right to one named rendition,
  held in the platform's record.
- **A review copy** — a review cut shared under a grant with an end date.
- **The dependency ledger** — one entry for every vendor, library or hosted
  component the platform carries.
- **A disappearance test** — five questions asked of each vendor about what
  stops working if it vanishes.
- **A vendor consideration** — the `Decision` that adopts a vendor for a
  capability the company cannot supply itself.

## Success criteria

- **SC-001**: No vendor is in the dependency ledger without a `Decision` that
  names what it does that the company cannot.
- **SC-002**: No content beyond `Public` is in a generated public file or
  answers without the platform evaluating the request.
- **SC-003**: Every archived rendition's bytes match the checksum of its
  delivery record.
- **SC-004**: A restore of the platform from its backup onto a scratch host has
  been tested within the last month.
- **SC-005**: No card number, credential, issued address or buyer record is in
  any repository.
- **SC-006**: Every access beyond `Public` is in the access log.
- **SC-007**: Every vendor has an answered disappearance test from within the
  last year.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which vendors, which host, which price) is asserted here
- [x] No production mechanics (a specific vendor, host or database) —
      those belong to an implementation plan
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated as
      settled fact
