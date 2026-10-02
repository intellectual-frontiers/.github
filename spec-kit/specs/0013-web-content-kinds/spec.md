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
  one `ifcore:Unit` individual.
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

## The portfolio index

- **FR-010**: `ifweb:PortfolioIndexPage` MUST NOT assert any fact about a
  specific work. It MAY list any number of individuals already declared
  elsewhere in the ontology, of any combination of: `ifcore:PatentFamily`,
  `ifcore:Trademark`, `ifcore:DefensiveDisclosure`, `ifcore:Fund`,
  `schema:Book`, `ifcore:ResearchPillar`, `ifcore:VentureCategory`,
  `ifcore:SoftwareCategory`, or `ifcore:SharedServiceCategory`.
- **FR-011**: A work kind with no existing ontology class — standalone
  software, a dataset, a method, a study — MUST be established, in
  whichever spec actually governs that business concept, before
  `ifweb:PortfolioIndexPage` may list an individual of that kind. This
  spec does not itself establish those classes.

## Out of scope

- A content kind for any legacy, thin, or pre-rebrand content collection
  (a blog post, a market-potential record, a use case, a patent-landscape
  record, a plain-language patent summary, a cross-cutting topic page) is
  deliberately not established here. Whether, and which, of that content
  is worth curating forward is an editorial decision for the owning unit,
  not a migration this spec performs.
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

## Open questions

- **OQ-1**: No decision is recorded on which legacy Record-shaped content
  gets curated forward, by Press or by Research & IP — tracked as a
  standing editorial decision, not resolved here.
- **OQ-2**: No content kind yet exists for standalone software, a
  dataset, a method, or a study as a portfolio work — each needs its own
  governing spec before FR-011 is satisfied for it.

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

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which pages currently exist, which works are
      listed on the portfolio index) is asserted here — all of it is
      ontology data and the content documents themselves
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
