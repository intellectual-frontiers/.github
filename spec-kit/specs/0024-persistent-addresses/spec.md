# Feature Specification: Persistent addresses

**Spec ID:** 0024-persistent-addresses
**Status:** Draft

**Input:** How the addresses a think tank's work is cited by stay true
for as long as anyone may cite them: the web addresses its works and
presentations are published at, the addresses printed in books, slides,
and codes; the ontology's own namespace addresses, which every term the
Eidolon defines is named under and which stay identifiers only; and the persistent identifiers that let a
citation survive an address changing. It extends 0022-domain-names,
0023-domain-security, and 0021-works-and-presentations.

## Published addresses

- **FR-001**: A published address MUST be any web address, on a domain
  the company holds (0022-domain-names FR-008), that the Eidolon asserts
  as the `schema:url` of a work, presentation, digital asset,
  organization, or person, or that appears in the source of a work
  package (0015-work-packages) whose work is Public or from which a
  rendition has been delivered.
- **FR-002**: A published address MUST keep answering for as long as the
  company holds its domain, with the content it was published with or
  with a permanent redirect (HTTP 301 or 308) to where that content now
  lives. Moving or retiring content MUST leave such a redirect; it MUST
  NOT leave the address answering not-found or with an error.
- **FR-003**: A domain that carries a published address MUST NOT be let
  lapse or transferred away (0022-domain-names FR-016). If what it served
  is retired, the domain MUST be kept, at least as a redirect domain,
  because a lapsed domain can be registered by anyone and its published
  addresses used to impersonate the company.
- **FR-004**: Every published address MUST be checked automatically, on
  0023-domain-security FR-017's cadence, and one that does not answer as
  FR-002 requires MUST be reported under 0023-domain-security FR-018.

## The ontology's namespaces

- **FR-005**: Each ontology namespace address (0001-eidolon-architecture
  FR-007: `ifcore:`, `ifweb:` and `ifpriv:`) MUST be an identifier only. The
  web does not serve it: a request for it answers like any address the
  website does not serve (0044-public-website FR-012), and the ontology is
  read and searched in the IF Console (0043-if-console).
- **FR-006**: A request for any namespace address, public or private, MUST
  answer as not found, in the single not-found shape of 0004-addressing
  FR-007, so that a namespace's existence reveals nothing beyond its prefix.
- **FR-007**: A namespace address MUST NOT change once a term is declared
  under it, wherever the ontology is kept.
- **FR-008**: The domain that hosts a namespace MUST be a crown jewel
  domain under 0022-domain-names FR-021.

## Identifiers that outlive addresses

- **FR-009**: A persistent identifier registered for a work, a dataset,
  or a presentation (a DOI, for instance) MUST be recorded on it by
  `schema:identifier`, or by `ifcore:doi` where that property applies,
  and a presentation that cites the work MUST give the identifier
  alongside its address.
- **FR-010**: A persistent identifier for a person who authors a
  published work (an ORCID iD, for instance) MUST be recorded by
  `schema:sameAs` only with that person's consent and only at an audience
  that person's other facts already have, per 0001-eidolon-architecture
  FR-016.
- **FR-011**: A persistent identifier for the company or one of its
  organizations (a ROR ID, for instance) MUST be recorded by
  `schema:sameAs` once one is held.

## Out of scope

- How the web property serves redirects or content negotiation. That is
  the web property's own implementation, held in its own repository.
- Whether the company registers DOIs, and with which agency; that is
  OQ-2.

## Edge cases

- A page moved to a new path: its old address redirects permanently, per
  FR-002.
- An address printed in a delivered book: it is a published address from
  the delivery on, per FR-001, and keeps answering, per FR-002.
- A site retired by a recorded decision: its domain is kept as a
  redirect domain rather than let lapse, per FR-003.
- An address on a domain the company does not hold, such as a partner's
  site: it is not a published address, per FR-001; its upkeep is not the
  company's.
- A request for a namespace address, public or private: it answers not
  found, and the ontology is read in the IF Console, per FR-005 and
  FR-006.
- A co-author without an ORCID iD, or one who does not consent: no
  identifier is recorded, per FR-010.

## Assumptions

- The web property can serve permanent redirects.
- Published addresses can be found from the ontology and from work
  package sources without reading any rendition.

## Open questions

- **OQ-1**: Whether the namespaces also gain a persistent alias through a
  community redirect service (w3id.org, for instance), so the vocabulary
  can outlive any one domain, is not decided.
- **OQ-2**: Whether the company registers DOIs for its papers and
  datasets, through which registration agency, and at what cost, is not
  decided.
- **OQ-3**: Whether the company obtains an organization identifier (a
  ROR ID) is not decided.

## Key entities

- **A published address** — a web address on a company domain that the
  Eidolon asserts or a delivered work prints, kept answering for as long
  as the domain is held.
- **A namespace address** — the address an ontology's terms are named
  under: an identifier that never changes and is not served.
- **A persistent identifier** — an identifier for a work, person, or
  organization that a registry keeps resolvable whatever its address.

## Success criteria

- **SC-001**: No published address answers not-found or with an error
  for longer than the check's cadence.
- **SC-002**: No domain carrying a published address lapses or is
  transferred away.
- **SC-003**: Every namespace address answers not found, and no
  namespace address has changed since a term was declared under it.
- **SC-004**: Every registered persistent identifier is recorded on what
  it identifies.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
