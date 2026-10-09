# Feature Specification: Patent portfolio: patents, their supporting assets, and the pages that offer them

**Spec ID:** 0051-patent-portfolio
**Status:** Draft

**Input:** The company holds a portfolio of patents and publishes it so that a prospective licensee or buyer can find a patent, understand
it, and ask about licensing or acquiring it. Two relationship layers hold the portfolio together and must not be collapsed. The first
connects a patent with the supporting assets made to explain it and show its value: a patent summary, a use case, a market potential
report, a landscape report, a podcast episode. The second connects patents with each other: the members of a family and the
continuation, divisional and continuation-in-part relations between them. This spec states the patent as the primary asset, the two
layers, where the registry's facts about a patent are kept, what is offered and how a reader asks about it, and what the website's patent
pages, addresses, structured data and machine-readable files carry so that search engines and answer engines can find and quote them.
The pages are generated as 0044-public-website states; the terms live in the ontology (`ifcore:Patent`, `ifcore:PatentFamily`,
`ifcore:continuationOf`, `ifcore:divisionalOf`, `ifcore:continuationInPartOf`, and the supporting asset content kinds of
0013-web-content-kinds).

## The patent and its family

- **FR-001**: A **patent** MUST be one patent document that a patent office granted or published: a granted patent or a published
  application. It MUST be an `ifcore:Patent` individual, identified by its publication number with its kind code (`dcterms:identifier`,
  for example `US9525753B2`), and MUST be part of exactly one patent family (`dcterms:isPartOf`). There MUST be one patent for each
  published application: its grant when the application was granted, else its published application. A granted patent's earlier
  publication is the same patent under another number. A provisional or unpublished application MUST NOT be a patent; it appears only
  as a filing in its family's registry record (FR-008).
- **FR-002**: A **patent family** MUST be an `ifcore:PatentFamily` individual that groups the patents sharing a priority claim, and the
  website MUST show it as one portfolio. Its title, its work domain (`ifcore:inWorkDomain`) and its offer (FR-010) are the company's
  facts; its members' registry facts are the registry's (FR-007).

## The two relationship layers

- **FR-003**: A patent that claims the benefit of another patent's application MUST be related to that patent by the relation the
  registry states for the application: `ifcore:continuationOf`, `ifcore:divisionalOf` or `ifcore:continuationInPartOf`
  (0007-work-and-assets FR-011). A relation the registry record does not state MUST NOT be asserted. These relations MUST hold only
  between patents.
- **FR-004**: A **supporting asset** MUST be a content document that explains a patent, gives its technical or market context, or shows
  its value, and MUST be of one of the supporting asset kinds of 0013-web-content-kinds: a patent summary, a use case, a market potential
  report, a landscape report or a podcast episode. It MUST declare `schema:about` naming exactly one patent, or, when it covers a whole
  family, exactly one patent family.
- **FR-005**: A supporting asset MUST NOT be a patent, MUST NOT be listed or counted as a patent, and MUST NOT take a patent's place in
  any list. A patent MUST NOT be listed as a supporting asset of another patent: patents relate to each other only by FR-003.
- **FR-006**: The patent a supporting asset is about MUST be taken from evidence the asset itself carries: a patent or publication
  number in its own record or text. A similar title, a shared word or a nearby position MUST NOT be taken as evidence. An asset that
  carries no such evidence MUST NOT be linked to a patent until a person records the patent it is about.
- **FR-007**: A **patent summary** MUST explain the core idea of exactly one patent in plain language, so that a technology manager can
  decide quickly whether the patent belongs on a shortlist. It MUST be about one patent, never a family, and it MUST NOT replace the
  patent's own page.

## The registry's facts

- **FR-008**: Each patent's registry facts MUST be held as an `ifcore:ExternalRecordReference` that `ifcore:describes` the patent
  (0007-work-and-assets FR-008): filing, publication and grant dates, status, abstract, claims, drawings, classifications, inventors,
  assignee, its parent applications with their relation, and the registry's expiration date. The reference MUST name the registry
  record as its primary source and state its status and dates as its cached value with the date it was read. The structured copy of
  those records MUST be the files under `registers/patents/` in the public root, written by a program from the registry records, never
  by hand, each record naming its source and the date it was read. A patent MUST NOT carry any of these facts as a literal of its own.
- **FR-009**: A page that shows a patent's status, a date or an expiration MUST show it from the record of FR-008 with the date the record
  was read. An expiration date MUST be labelled an estimate, MUST name its source, and MUST say that fees, terminal disclaimers and later
  events can change it and that it is not legal advice; it MUST NOT be stated as the registry's final disposition (0007-work-and-assets
  FR-012).

## What is offered, and asking about it

- **FR-010**: A patent family whose registry status is granted or pending MUST be offered for licence and for acquisition: one
  `schema:Offer` whose `schema:itemOffered` is the family, whose `schema:businessFunction` is both licensing
  (`http://purl.org/goodrelations/v1#LeaseOut`) and sale (`http://purl.org/goodrelations/v1#Sell`), whose `schema:seller` is the rights
  holder, and whose description says exclusive or non-exclusive licences, field-of-use licences included, or acquisition, with terms on
  inquiry. No price MUST be stated. A family whose status is abandoned or expired MUST NOT be offered, and its pages MUST say it is shown
  as prior art and reference.
- **FR-011**: Every patent page, family page and supporting asset page of an offered family MUST carry an inquiry: the company's address
  for intellectual property inquiries shown as text, a mail link to it whose subject names the patent or the family and asks about
  licensing or acquiring it, and the same address as a `schema:ContactPoint` in the page's structured data.

## The website's patent pages

- **FR-012**: The patent pages MUST answer at these addresses: `/patents`, the list; `/patents/<family>`, a family's page; and
  `/patents/<family>/<number>`, a patent's page, where `<number>` is the publication number with its kind code in lower case. An address
  `/patents/<number>`, for its publication number or its earlier publication's, with or without the kind code and in any case, MUST
  redirect permanently to that patent's page. An address the
  previous websites published for one patent MUST redirect to that patent's page, not to its family's (0024-persistent-addresses FR-002).
- **FR-013**: A patent's page MUST show its title, number, family, status and dates with the date they were read, the estimated
  expiration (FR-009), its abstract, every claim its record holds, its drawings, its classifications linked to their classification pages
  (FR-017), the patents it is related to by FR-003 with each relation named, its supporting assets grouped by kind, and the offer and
  inquiry of its family (FR-010, FR-011).
- **FR-014**: A family's page MUST show its patents and the relations between them, its work domain, the supporting assets about the
  family, and the supporting assets about each of its patents, each naming the patent it is about, and the offer and inquiry.
- **FR-015**: The list at `/patents` MUST list patents only, grouped by family, and every count it shows MUST count patents or families
  only. Supporting assets MUST be listed only on their own index pages and on the pages of the patents they are about.
- **FR-016**: A supporting asset MUST answer at the address the previous websites published for it, and its page MUST name the patent or
  family it is about with a link to that page, list the other supporting assets of the same patent, and carry the offer and inquiry.
  Its address MUST NOT redirect to a patent's page. Each supporting asset kind MUST have an index page that lists every asset of the kind
  with the patent it is about.
- **FR-017**: The website MUST have one page for each work domain at `/patents/topics/<domain>` and one for each classification main
  group that a patent carries at `/patents/cpc/<group>` (for example `/patents/cpc/g16h-40`). Each MUST say in one or two sentences which
  of the company's patents cover the subject, and list those patents with their families and patent summaries.
- **FR-018**: Each patent page MUST carry structured data that describes the patent as a `schema:CreativeWork` of the additional type
  patent (`http://www.wikidata.org/entity/Q253623`), with its publication number as a `schema:identifier` property value, its registry
  pages as `schema:sameAs`, its inventors, its family by `schema:isPartOf`, its supporting assets by `schema:subjectOf`, and the offer of
  FR-010. A family page MUST carry the family with its patents by `schema:hasPart` and the offer. A supporting asset page MUST carry its
  patent by `schema:about`. A patent page and a family page MUST carry their licensing questions and answers, shown on the page, as a
  `schema:FAQPage`.
- **FR-019**: The website MUST publish the portfolio in machine-readable form: `/patents.json` and `/patents.csv`, one entry for each
  patent with its number, title, family, status, dates, estimated expiration, classifications, offer, page address and patent summary
  address; a Markdown copy of each patent page at the page's address followed by `.md`; one line in `/llms.txt` for each patent and each
  patent summary; and an entry in the sitemap for each patent, family, topic, classification and supporting asset page.
- **FR-020**: A podcast episode MAY have no audio address. Its page MUST then show its text without a player, and MUST show a player once
  the episode names an audio address in rendition storage (0046-distribution-platform).

## Checks

- **FR-021**: The website's check (0044-public-website FR-004) MUST fail when: a patent in the ontology has no record under
  `registers/patents/` or a record there has no patent; a patent or a patent family has no page; a supporting asset is about no patent or
  family, or about one that is not in the ontology; a supporting asset address redirects; the list at `/patents` lists or counts anything
  but patents; or a page of an offered family has no inquiry.

## Out of scope

- The price or terms of a licence or a sale: they are stated only in an inquiry.
- A patent the company does not hold.
- Foreign filings: the registry records hold none yet; FR-001 and FR-003 apply to them unchanged when they exist.
- The blog posts and essays of the previous websites, which stay in the archive (0044-public-website FR-013), and the whitespace
  analysis, which no previous website published as an asset.

## Edge cases

- A legacy summary address that the previous website redirected to a family page: it answers with the summary again, per FR-016.
- A summary whose title matches one patent and whose record names another: it is about the patent its record names, per FR-006.
- A family with one grant and two published applications: the grant and both applications are patents with their own pages, per FR-001;
  a provisional application in its record is not, per FR-001.
- A patent whose parent is a provisional application: it has no `continuationOf` relation, because a provisional is not a patent, per
  FR-001 and FR-003.
- A family whose status changes from granted to expired when its record is read again: its offer is withdrawn and its pages say it is
  prior art, per FR-010.
- A supporting asset that covers several patents of one family: it is about the family, per FR-004.
- A podcast episode whose audio is not yet in rendition storage: its page shows its text only, per FR-020.

## Assumptions

- The registry records that Google Patents and the USPTO publish are readable by a program without an account.
- Search engines and answer engines read schema.org structured data, `llms.txt` and Markdown copies of pages.

## Open questions

- **OQ-1**: How often the records under `registers/patents/` are read again, and by which command, is not stated.
- **OQ-2**: Whether the company states a field-of-use or territory restriction on any offer is not stated; until then every offer is the
  general one of FR-010.

## Key entities

- **A patent** (`ifcore:Patent`) - one granted patent or published application, by its publication number.
- **A patent family** (`ifcore:PatentFamily`) - the patents that share a priority claim, shown as one portfolio.
- **A supporting asset** - a content document that explains a patent or shows its value: a patent summary, a use case, a market
  potential report, a landscape report or a podcast episode.
- **A registry record** - the registry's facts about one patent, held as its `ifcore:ExternalRecordReference` and its file under
  `registers/patents/`.
- **An offer** (`schema:Offer`) - the statement that a family is available for licence and acquisition, with terms on inquiry.

## Success criteria

- **SC-001**: Every legacy patent summary answers at its legacy address as a summary that names the patent it explains.
- **SC-002**: No supporting asset appears in the list at `/patents`, and the list's counts equal the number of patents and families.
- **SC-003**: Every patent has a page, and `/patents/<number>` reaches it.
- **SC-004**: Every page of an offered family carries an offer in its structured data and an inquiry on the page.
- **SC-005**: `/patents.json` lists every patent with its page, and `/llms.txt` has a line for every patent.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
