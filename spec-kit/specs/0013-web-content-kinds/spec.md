# Feature Specification: Web content kinds

**Spec ID:** 0013-web-content-kinds
**Status:** Draft

**Input:** Which `ifweb:` content kinds exist beyond the minimal `Page`
0002-content-format already establishes, and what each one's content
document MUST declare in its JSON-LD block to be valid under that kind.
This spec covers only content kinds whose underlying business concept
already has a settled ontology class elsewhere — a content document for
one of them renders facts that already exist, never asserts a new one,
with one exception: a Journal article, which per 0007-work-and-assets
FR-016 may itself be the primary place Intellectual Frontiers' own
originated text lives. A content kind for a business concept not yet
established anywhere else is out of scope here, per 0002-content-format
FR-007.

## Content kinds backed by one existing individual

- **FR-001**: `ifweb:UnitPage` MUST declare `schema:about` naming exactly
  one `ifcore:Unit` individual. A `UnitPage` MUST NOT declare the Public
  audience, per 0021-works-and-presentations FR-014.
- **FR-002**: `ifweb:ResearchPillarPage` MUST declare `schema:about`
  naming exactly one `ifcore:ResearchPillar` individual.
- **FR-003**: `ifweb:ResearchNotePage` MUST declare `schema:about` naming
  exactly one `ifcore:Note` individual.
- **FR-004**: `ifweb:PatentFamilyPage` MUST declare `schema:about` naming
  exactly one `ifcore:PatentFamily` individual. Any patent status or
  filing-data value it displays MUST be a resolved
  `ExternalRecordReference`, per 0006-research-and-ip FR-008 and
  0002-content-format FR-011 — never a hand-typed literal.
- **FR-005**: `ifweb:TrademarkPage` MUST declare `schema:about` naming
  exactly one `ifcore:Trademark` individual, under the same
  `ExternalRecordReference` discipline as FR-004.
- **FR-006**: `ifweb:DefensiveDisclosurePage` MUST declare `schema:about`
  naming exactly one `ifcore:DefensiveDisclosure` individual.
- **FR-007**: `ifweb:FundPage` MUST declare `schema:about` naming exactly
  one `ifcore:Fund` individual.
- **FR-008**: `ifweb:BookPage` MUST declare `schema:about` naming exactly
  one individual that is both a `schema:Book` and an `ifcore:Copyright`,
  per 0007-work-and-assets FR-013.
- **FR-009**: `ifweb:JournalArticlePage` MUST declare `schema:isPartOf`
  naming the Journal `schema:Periodical` individual (0009-press FR-020)
  and `schema:about` naming the concept the article covers. Where the
  article is derived from the firm's own tracked research, it MUST also
  declare `prov:wasDerivedFrom` naming the `Note` or `ResearchPillar` it
  was drawn from, per 0007-work-and-assets FR-016 and 0009-press FR-022.
- **FR-017**: `ifweb:JournalIssuePage` MUST declare `schema:about` naming
  exactly one `schema:PublicationIssue` individual, the issue it renders,
  and `schema:isPartOf` naming the Journal `schema:Periodical` individual
  (0009-press FR-033). It MUST NOT assert a fact about an article it
  gathers; each article is declared by its own `JournalArticlePage` or
  research record.

## The portfolio index

- **FR-010**: `ifweb:PortfolioIndexPage` MUST NOT assert any fact about a
  specific work. It MAY list any number of individuals already declared
  elsewhere in the ontology, of any combination of: `ifcore:PatentFamily`,
  `ifcore:Patent`, `ifcore:Trademark`, `ifcore:DefensiveDisclosure`, `ifcore:Fund`,
  `schema:Book`, `ifcore:ResearchPillar`, `ifcore:SubstantialWork`,
  `ifcore:VentureCategory`,
  `ifcore:SoftwareCategory`, or `ifcore:SharedServiceCategory`.
- **FR-011**: A work kind with no existing ontology class — standalone
  software, a dataset, a method, a study — MUST be established, in
  whichever spec actually governs that business concept, before
  `ifweb:PortfolioIndexPage` may list an individual of that kind. This
  spec does not itself establish those classes.

## Content kinds for Substantial Works

- **FR-012**: `ifweb:WorkPage` MUST declare `schema:about` naming exactly
  one `ifcore:SubstantialWork` individual. It renders facts that already
  exist about the work — its title, kind, audience-permitted description —
  and asserts none; a book's own page remains `ifweb:BookPage`
  (FR-008).
- **FR-013**: `ifweb:WorkEditionPage` MUST declare `schema:isPartOf`
  naming exactly one `ifcore:SubstantialWork` individual and
  `prov:wasDerivedFrom` naming that same individual. It is the content
  kind of a generated content document (0002-content-format FR-017) that
  renders a part of a work's source — a chapter, an appendix, a companion
  page, a show-notes page — and asserts no fact the work's source does not
  already carry.

## Supporting assets of a patent

- **FR-014**: `ifweb:PatentSummaryPage` MUST declare `schema:about` naming
  exactly one `ifcore:Patent` individual: the patent it explains in plain
  language (0051-patent-portfolio FR-007).
- **FR-015**: `ifweb:UseCasePage`, `ifweb:MarketPotentialPage`,
  `ifweb:PatentLandscapePage` and `ifweb:PodcastEpisodePage` MUST each
  declare `schema:about` naming exactly one `ifcore:Patent` or exactly one
  `ifcore:PatentFamily` individual (0051-patent-portfolio FR-004).
- **FR-016**: A supporting asset page MUST NOT carry a patent's registry
  facts as its own: a status, a date or a claim it shows comes from the
  patent's `ExternalRecordReference`, per FR-004 and 0051-patent-portfolio
  FR-008. A `PodcastEpisodePage` MAY name the address of its audio in
  rendition storage as `schema:associatedMedia`.

## Out of scope

- A content kind for any other legacy, thin, or pre-rebrand content
  collection (a blog post, a cross-cutting topic page) is deliberately
  not established here. Whether, and which, of that content is worth
  curating forward is an editorial decision for the owning unit, not a
  migration this spec performs. The supporting assets of a patent are
  curated forward under FR-014 to FR-016.
- Brand and visual identity (a unit's color, logotype, typography, voice
  rules) is a web property design-system concern, not ontology data, and
  is out of scope entirely — not merely deferred.
- The specific HTML allowed inside any of these shapes' `<body>` is
  governed by 0002-content-format's body allowlist (FR-012), not
  re-specified per content kind here.
- Where a Confidential document under one of these kinds should actually
  live, and what being internal-only changes about its content, is
  governed by 0001-eidolon-architecture's confidentiality model, not this
  spec — a content kind here works the same whether the document carrying
  it is Public or Confidential.

## Edge cases

- A content document whose `schema:about` names an individual of the
  wrong class, or one the ontology does not declare at all: the document
  is not valid under its kind, per FR-001 through FR-008 and FR-012.
- A book whose individual is a `schema:Book` but not yet an
  `ifcore:Copyright`: its page is not valid as `ifweb:BookPage` until the
  individual is both, per FR-008, and it does not fall back to
  `ifweb:WorkPage`, per FR-012.
- A patent family page that shows a filing date or a current status: the
  value is a resolved `ExternalRecordReference`, never a typed literal,
  per FR-004; a trademark page follows the same rule, per FR-005.
- A Journal article not drawn from the firm's own tracked research: it
  names the Journal and its subject and needs no `prov:wasDerivedFrom`,
  per FR-009.
- A work edition page whose `schema:isPartOf` and `prov:wasDerivedFrom`
  name different works: it is not valid; both name the same Substantial
  Work, per FR-013.
- A portfolio entry for standalone software or a dataset with no ontology
  class of its own: it is not listed until a governing spec establishes
  that class, per FR-011, with the gap held as OQ-2.

## Assumptions

- Every business concept a content kind here renders already has a
  settled class in the core ontology, so a content kind only points at
  an individual and never defines one.
- A content document's JSON-LD block can be validated against its kind's
  shape, so a requirement stated here is checkable on the document alone
  plus the ontology it points into.
- The web properties that render these documents read the JSON-LD block
  as the page's meaning, not the visible HTML alone.

## Open questions

- **OQ-1**: Which legacy Record-shaped content other than the supporting
  assets of a patent (FR-014 to FR-016) and the records registers
  (0044-public-website FR-074) is curated forward into content documents,
  and under which content kind, is not stated; until then the public
  website carries it as an archive read from its snapshot
  (0044-public-website FR-013).
- **OQ-2**: No content kind yet exists for standalone software, a
  dataset, a method, or a study as a portfolio work — each needs its own
  governing spec before FR-011 is satisfied for it.
- **OQ-3**: Whether an `ifweb:PortfolioIndexPage` may list an individual
  whose audience is narrower than the page's own audience is not stated.

## Key entities

- **A content kind** — an `ifweb:` shape a content document's JSON-LD
  block may declare as its `@type`, always naming the real ontology
  individual the page is about via `schema:about`.
- **The portfolio index** — a page that lists existing individuals from
  across several ontology classes; it is a view, not a new fact type.
- **A Journal article page** — the one content kind here that may carry
  content Intellectual Frontiers itself originates rather than only
  render an existing fact, per 0007-work-and-assets FR-016.

## Success criteria

- **SC-001**: Every content document declaring one of FR-001 through
  FR-008's kinds names exactly one real, already-declared ontology
  individual via `schema:about`.
- **SC-002**: No `ifweb:PortfolioIndexPage` asserts a new fact about a
  work — every entry it lists already exists as its own individual
  elsewhere.
- **SC-003**: No content document declares a content kind this spec does
  not establish, for a business concept not established anywhere else,
  per 0002-content-format FR-007.
- **SC-004**: Every `ifweb:JournalArticlePage` names the Journal via
  `schema:isPartOf`; one derived from the firm's own research also names
  that research via `prov:wasDerivedFrom`.
- **SC-005**: Every `ifweb:WorkPage` names exactly one real Substantial
  Work via `schema:about`; every `ifweb:WorkEditionPage` names the same one
  Substantial Work via both `schema:isPartOf` and `prov:wasDerivedFrom`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which pages currently exist, which works are
      listed on the portfolio index) is asserted here — all of it is
      ontology data and the content documents themselves
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
