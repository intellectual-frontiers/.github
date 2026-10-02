# Feature Specification: Work and assets

**Spec ID:** 0007-work-and-assets
**Status:** Draft

**Input:** How the company's work and what it produces or owns relate to
each other, reusing established vocabulary rather than inventing new
concepts: the W3C PROV ontology for work and its outputs, and standard
accounting and asset-management categories (ISO 55000, GAAP/IFRS) for
assets.

## Work

- **FR-001**: A bounded piece of work MUST be represented as a
  `prov:Activity`. A standing, open-ended line of inquiry (such as a
  research pillar) MUST NOT be represented as a `prov:Activity`; it MAY
  instead be represented as a `prov:Plan` that bounded activities are
  carried out under.
- **FR-002**: A thing produced by an activity MUST be represented as a
  `prov:Entity`, linked to the activity that produced it by
  `prov:wasGeneratedBy`.
- **FR-003**: A `prov:Activity` individual is not itself required to be
  tracked in the Eidolon. Only its outputs, once they cross the threshold in
  FR-004, need to be.

## What crosses into the Eidolon

- **FR-004**: A `prov:Entity` MUST become a tracked `ifcore:Fact` —
  carrying its own audience declaration per 0001-eidolon-architecture
  FR-011 — once it is the subject of a Note or has received a Disposition
  (0006-research-and-ip FR-003, FR-005). Before that point, it is not
  required to be represented in the Eidolon at all.
- **FR-005**: When a decision transforms one entity into a materially new
  one — a research finding into a patent filing, for instance — the result
  MUST be a distinct individual related to its origin by
  `prov:wasDerivedFrom`, not the same individual retyped.

## Assets

- **FR-006**: Something the company owns that has potential or actual value
  MUST be represented as an `Asset`, categorized as `TangibleAsset`,
  `IntangibleAsset`, or `FinancialAsset`.
- **FR-007**: `IntellectualProperty` (patents, trademarks, trade secrets,
  defensive disclosures) and `DigitalAsset` (a distinct, separately-valuable
  digital property — a domain and its deployment, a distinct software
  product, a distinct dataset) MUST be represented as kinds of
  `IntangibleAsset`. A `DigitalAsset` MUST NOT be created for an individual
  page or file within a larger property.
- **FR-008**: An asset's own literal properties MUST be limited to
  classifications Intellectual Frontiers itself is the authority on. Any
  property an external registry (a patent office, a trademark office) is
  authoritative over MUST be represented as an `ExternalRecordReference`
  per 0001-eidolon-architecture FR-022, granular to the individual asset —
  never aggregated into one reference for an entire register, and never
  duplicated as a literal on the asset itself.
- **FR-009**: An asset with no external registry — a common-law mark, a
  trade secret — MAY hold its own classifying facts as literals, per
  0001-eidolon-architecture FR-020, since Intellectual Frontiers is the
  authority on them.
- **FR-010**: A trade secret's substantive content MUST be classified as
  sensitive under 0001-eidolon-architecture FR-016 by default. Its public
  representation MUST NOT describe what the secret actually is.

## Patent family relationships

- **FR-011**: A patent family that shares a priority claim with another
  MUST be related to it by the specific relationship that holds —
  continuation, divisional, or continuation-in-part — not left as an
  unrelated filing or collapsed into a generic derivation.

## Canonical authority

- **FR-012**: The relevant registry — the USPTO for a U.S. patent or
  trademark, the corresponding authority elsewhere — MUST be treated as the
  sole canonical source for a right's final disposition (granted,
  registered, abandoned, refused). No statement elsewhere in the Eidolon,
  however confident, overrides what the registry's own record says.
- **FR-013**: A copyrightable work significant enough to track MAY be
  represented as a `Copyright`, a kind of `IntellectualProperty` per FR-007,
  distinct from any trademark protecting a name used in connection with it.
  Copyright is not required for every piece of writing — the same
  materiality judgment in FR-004 applies.

## Attribution

- **FR-014**: A `Right`'s creator MAY be a specific named person,
  independent of who holds the rights. Its rights-holder, absent a specific
  agreement stated otherwise, MUST default to Intellectual Frontiers LLC.
  Creator and rights-holder MUST be represented as `dcterms:creator` and
  `dcterms:rightsHolder` respectively, not a new property.

## Concepts that are also authored research

- **FR-015**: A concept that is also independently authored research —
  carrying its own creative works, a trademark, or a copyright — MUST have
  those facts represented explicitly, on the concept itself or on a
  dedicated individual it is linked to, never left implicit. Where the
  company also builds or operates something distinct based on the concept,
  that artifact MUST be related to the concept by `schema:isBasedOn` rather
  than conflated with it.

## Where content lives

- **FR-016**: A creative work whose primary, authoritative text
  Intellectual Frontiers itself publishes MUST have that text represented
  as a content document in the Eidolon's own content root, per
  0002-content-format and 0004-addressing FR-004. A creative work whose
  primary, authoritative text is published elsewhere — by the founder on
  his own site, for instance — MUST NOT be duplicated into a content
  document; the Eidolon MUST hold only a reference to it (`schema:url`),
  never a copy of the text itself.

## Substantial works and their lifecycle

- **FR-017**: A work produced through its own multi-stage production and
  distribution process — a peer-reviewed paper, a book, a patent filing
  still being ideated or drafted, or software bound for production or
  for another system — MUST be classified a Substantial Work, distinct
  from a work generated by a single bounded activity. The classification
  is operational: a work is substantial because its lifecycle is
  actually being tracked, not because of its length, quality, or
  subject matter.
- **FR-018**: A Substantial Work MUST move through an ordered sequence of
  stages — the stages themselves are ontology data
  (`ifcore:WorkLifecycleStage`). Per 0011-studios FR-003's discipline for
  a venture, each stage MUST end in an explicit decision, recorded per
  0008-decision-records, not silence or default continuation.
- **FR-019**: A Substantial Work's Commercialization stage MUST itself
  decompose into substages — the substages are ontology data
  (`ifcore:CommercializationSubstage`) — since pricing, licensing,
  go-to-market, and revenue operations are distinct, often concurrent
  decisions that do not resolve as a single gate the way an earlier
  stage does.
- **FR-020**: A patent not yet filed — still being ideated, drafted, or
  internally reviewed — MUST be tracked as a Substantial Work through
  its `Note` individual (0006-research-and-ip), the same as any other
  substantial work, through its Deploy stage (filing). Once filed, the
  resulting `PatentFamily` is a distinct individual related to that Note
  by `prov:wasDerivedFrom` (FR-005), and the relevant registry becomes
  the canonical authority for its status per FR-012 — the substantial-
  work lifecycle is not independently continued past that point. FR-012
  governs an already-filed right; this FR governs the work before it
  reaches one.
- **FR-021**: A Substantial Work's lifecycle MUST have exactly one owning
  unit (`ifcore:lifecycleOwner`). Research & IP is the default owner
  while a work's disposition is unsure; Press is the default owner
  otherwise. Any other unit MAY claim ownership explicitly, overriding
  the default — Studios, for instance, for a venture-specific work.

## Out of scope

- Equity interests, securities, and other financial assets are Capital's to
  establish in its own future spec; `FinancialAsset` is named here and left
  otherwise empty.
- Joint ownership percentages, license exclusivity, field-of-use, and
  territorial terms are not modeled yet — today's model only states who the
  primary rights-holder is.
- Asset stewardship distinct from legal ownership is not modeled; the
  company's single decision authority (0001-eidolon-architecture FR-029)
  covers this until a second role actually exists.
- Actual revenue, pricing, and licensing figures generated during a
  Substantial Work's Commercialization stage are Capital's financial-
  asset territory (above), not this spec — the Commercialization
  substages track that commercialization is happening and at what
  point, not the amounts involved.

## Open questions

- **OQ-1**: Whether a `prov:Activity` individual should ever be tracked
  directly — to resolve an inventorship question, for instance — is
  unresolved. Today's default is that only outputs are tracked, never the
  activity itself.

## Key entities

- **An activity** — a bounded piece of work (`prov:Activity`), not itself
  required to be tracked.
- **An entity** — a thing produced by work (`prov:Entity`); becomes a
  tracked Fact only once it crosses the FR-004 threshold.
- **An asset** — something owned that has potential or actual value,
  categorized as tangible, intangible, or financial.
- **A creative work** — a book, article, or similar (`schema:CreativeWork`
  and its subtypes), related to the concept it's about by `schema:about`
  and, where it's an adaptation of a prior work, to that work by
  `schema:isBasedOn`.
- **A content document's origin** — whether Intellectual Frontiers itself
  is the primary publisher (the text lives in the Eidolon) or merely
  describes a work published elsewhere (the Eidolon holds a reference,
  never a copy).
- **A Substantial Work** — a work whose multi-stage lifecycle is actually
  tracked, from intake through commercialization; a paper, a book, a
  not-yet-filed patent, or production-bound software are the standing
  examples, not an exhaustive list.
- **A work lifecycle stage** — one step in a Substantial Work's ordered
  progress, with its own recorded decision; the Commercialization stage
  further decomposes into its own substages.
- **A lifecycle owner** — the one unit accountable for a Substantial
  Work's progress, defaulting to Research & IP while disposition is
  unsure and to Press otherwise, overridable by any unit with a better
  claim.

## Success criteria

- **SC-001**: No `prov:Entity` is tracked in the Eidolon before it is the
  subject of a Note or has received a Disposition.
- **SC-002**: No asset individual duplicates a literal value that its own
  `ExternalRecordReference` already carries.
- **SC-003**: No `DigitalAsset` individual exists for a single page or file
  within a larger digital property.
- **SC-004**: No trade secret's public representation states what the
  secret actually is.
- **SC-005**: No concept that is also authored research (its own creative
  works, trademark, or copyright) has those facts left unrepresented.
- **SC-006**: Every `Right` individual states a rights-holder; where its
  creator differs from its rights-holder, both are stated, not just one.
- **SC-007**: No content document duplicates the primary text of a work
  whose authoritative source is published elsewhere; no work Intellectual
  Frontiers itself primarily publishes is left as a bare reference with no
  content document.
- **SC-008**: No Substantial Work sits at a lifecycle stage without a
  recorded decision for how it got there; none skip a stage silently.
- **SC-009**: No not-yet-filed patent is left untracked as a Substantial
  Work; no filed patent family continues to carry independently-asserted
  lifecycle stages once the registry is its canonical authority.
- **SC-010**: Every Substantial Work has exactly one lifecycle owner; none
  are left jointly owned by default or unowned.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No novel vocabulary invented where an established term already fits —
      PROV-O for work and its outputs, standard asset categories for what
      is owned, Dublin Core for attribution, schema.org for creative works
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
