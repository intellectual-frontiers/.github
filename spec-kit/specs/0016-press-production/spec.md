# Feature Specification: Press production

**Spec ID:** 0016-press-production
**Status:** Draft

**Input:** The rules Press follows when it produces books and other written
works as work packages (0015-work-packages): what a book package holds,
how a serial series is kept coherent, how a book's design, jacket,
identifiers, editions, and cuts are governed, which decisions stay with a
person, how a book's online appendix, companion, and news reach readers,
how skills and the ontology make a book into working AI, how written
public web content is owned, and how promotion is kept apart from the
work. The behavioral rules of Press itself — claim kinds, voice, corrections,
events, owned channels — are 0009-press; this spec adds only production.
What books Press has produced, and where each stands, is ontology data and
is not stated here.

## Voice and audit

- **FR-001**: Every Press work MUST be written or edited to the house voice
  before it is considered ready to publish. A draft that predates the
  current voice standard MUST NOT be treated as a tone model on its own,
  and a second named author on a work is not an exception to this rule.
- **FR-002**: Every Press work MUST pass an audit against the voice
  standard's audit checklist before it is considered ready to publish. The
  audit's findings and the resulting edit MUST be kept alongside the work,
  not discarded. An audit of AI-drafted text allows no "author's language"
  exemption.
- **FR-003**: Text a work publishes that no human wrote — a chapter, a
  jacket, a companion page, a news entry — MUST pass the same audit, run as
  a separate read by someone other than the drafter, with the record kept in
  the work's package.

## Book packages

- **FR-004**: A book is a work of kind `book` (0015-work-packages FR-005).
  Its package MUST hold, as its live sources, `manuscript.adoc` (interior
  prose), a jacket data file (cover and back-cover copy, distribution
  metadata, and which piece of its theme's imagery pool its cover uses), and
  its figures. Each of those is committed together because the manuscript
  references the other two by path; the artwork itself is the brand's
  (0014-design-systems FR-043).
- **FR-005**: A book package MUST keep a book bible: the book's thesis, its
  recorded decisions, its relationship to other books, its reader, its
  conventions, every named tool with its fixed definition, every recurring
  case with the facts that must stay identical across chapters, a chapter
  map, where its facts and sources live, and any inconsistency found in the
  manuscript. The bible MUST be written before drafting starts and updated
  first whenever a decision, definition, or settled case fact changes, with
  the manuscript then brought into line. It MUST NOT hold manuscript prose.
- **FR-006**: Every chapter, including a preface, MUST carry a stable
  identifier above its heading. An identifier MUST NOT change when a chapter
  is retitled, and a change of identifier MUST NOT alter how any edition
  renders.
- **FR-007**: A book package MUST keep its known issues in one register and
  nowhere else. A finding an audit does not fix MUST be recorded there,
  unsorted, and sorting a finding into a category is the editor's decision.
  A final cut MUST be refused while a blocker is open.

## Serial series

- **FR-008**: A serial series — a set of books meant to be read together in
  order — MUST be represented as a work of kind `book-series` whose package
  holds a series bible and the volume map and no manuscript. Each volume is
  its own `book` work whose slug is `<series-slug>-volume-<n>`.
- **FR-009**: The series bible MUST hold the volume map, the fixed
  definition of every term more than one volume uses, the test that decides
  which volume a passage belongs in, and a registry of every named company,
  person, and counterparty with the one volume it belongs to. It MUST be
  updated before any volume's bible or manuscript when a shared decision
  changes, and a volume's bible MUST NOT contradict it.
- **FR-010**: The volumes of a serial series MUST be released together: a
  cut of one volume MUST be accompanied by a cut of every other published or
  in-review volume, each first brought into line on cross-references, shared
  terms, and shared facts. Each volume keeps its own edition and printing.
  A series made from another work's released items, one volume per calendar
  year (0017-spoken-and-research-works), is exempt from joint release.
- **FR-011**: Every synthetic company, person, and counterparty in a series
  MUST be unique to one volume, except where the series bible records a pair
  of volumes that tell one case from two sides or one implementation split
  across two volumes, and both keep every shared fact identical.

## Cases, accuracy, and presentation

- **FR-012**: A book MAY tell realistic, illustrative scenarios in the
  author's first-person voice without their having happened as told. Every
  case, scenario, and worked example in a book is an illustrative composite,
  whether built from synthetic detail or anonymized experience, and the
  book's copyright page MUST say so. A case MUST be accurate — its point is
  true and its numbers agree with each other and with the text — and
  relevant to the section it sits in. No case MAY give invented events or
  statements to a real third party, and no case MAY name a real customer of
  the company. The author's own organizations MAY appear in a case; the
  series or book bible records where. A composite an AI wrote MUST be listed
  for the author's review.
- **FR-013**: A book MUST NOT knowingly include inaccurate information.
  Every factual claim MUST be true as stated or be labeled fact, inference,
  hypothesis, or illustrative composite. A myth or a misquoted figure MAY be
  cited in order to correct it, and the text MUST say it is a correction.
  Information that moves fast MUST go to the online companion with a pointer
  from the book. An agent MUST check an external claim against its source
  itself and MUST NOT hand the lookup to a person.
- **FR-014**: Every chapter MUST carry at least one visual of its major
  concept, introduced and interpreted by surrounding prose. A chapter MUST
  present each piece of content in the form that best teaches it: prose by
  default, a real list for an enumerable set, a table for content dense
  across two dimensions, a visual for a relationship — and MUST NOT leave a
  list, table, or visual standing without prose. A drawn visual MUST be a
  figure drawn with `frontiers-figures` and themed by the book's brand
  (0014-design-systems FR-048).
- **FR-015**: A change that adds or edits a figure, table, or list MUST be
  verified by rebuilding the affected rendition and inspecting the rendered
  pages, not only by a clean build. Before a final cut, the full rendered
  book, cover and jacket pages included, MUST be read page by page by a
  person; a clean build, or a check of the changed pages, is not that read.
- **FR-016**: A chapter MUST NOT re-derive content that belongs in full to
  an appendix or prompt library elsewhere in the same work; it MUST point to
  it and MAY show one worked instance.
- **FR-017**: Where a book runs over 250 printed pages, its full tools MAY
  move to its online companion, leaving print a short version of the tools
  a reader most needs on paper and a table saying where each full tool went,
  and the book bible MUST record the decision. The short version MUST NOT
  contradict the companion.

## House design, jacket, and identifiers

- **FR-018**: Every book Press publishes MUST use the house design for its
  printed form: the `frontiers-print` design system, themed by
  `frontiers-brand` (0014-design-systems FR-038); authors choose
  content and the options the design documents and MUST NOT invent layouts.
  A design change MUST be made once, in the shared design, and reviewed on
  rendered pages.
- **FR-019**: Jacket copy MUST follow the documented jacket pattern. Its
  category line MUST be derived from the book's real subject headings, never
  independently authored.
- **FR-020**: Every book Press publishes MUST credit its author as the
  author record states and MUST carry the imprint's publisher line, never the
  author's own name in its place. A series kicker MUST be used only for the
  format it names.
- **FR-021**: A book's categories MUST come from the real taxonomies of the
  vendors that sell it, each subject heading MUST be a real code, and
  choosing among valid candidates is the decision authority's. A category the
  vendor publishes no machine-readable list for MUST be confirmed live before
  submission.
- **FR-022**: Every book published in print MUST carry an ISBN-13 purchased
  under the imprint's own registration account, never a printer's free
  number and never a reseller's. The ISBN MUST be stated once — on the
  book's jacket data, or as an `ExternalRecordReference` to the agency's
  record — and any index of ISBNs MUST be a generated view, never a second
  live source. A final cut MUST be refused with a placeholder ISBN, and an
  ISBN MUST NOT be invented or guessed. An ebook distributed to a retailer
  that requires an ISBN follows the same rule (an ISBN bought under the
  imprint's own account, never a platform's or reseller's); an ebook sold
  only where the retailer assigns its own identifier needs none. An ebook's
  number is stated once, in the jacket data field `distribution.ebook_isbn`.
- **FR-023**: A volume of a serial series MUST carry its series name and
  volume number on its cover in their own line, not inside the title, and
  anything that shows a title without the cover's layout MUST show the full
  title. A back cover MUST NOT name another volume by number.

## Editions, cuts, and decisions that stay human

- **FR-024**: A book manuscript MUST carry its current edition, and once an
  edition has a final cut, its current printing, each a plain whole number
  and the single source of truth for that value. An edition changes for a
  substantial revision that would warrant a new ISBN; a printing changes for
  a content-affecting correction after a cut.
- **FR-025**: A rendition sent outside the Eidolon for review, or printed
  for distribution, MUST be cut as a review cut or a final cut, never an
  ordinary build, and MUST trace to the exact source commit it came from. A
  review cut MUST NOT overwrite an earlier one, and a final cut MUST be made
  at most once per edition and printing. A final cut MUST also be refused
  while an open issue is unsorted (FR-007), while any of the five gate groups
  (FR-048) lacks a recorded check made after the manuscript last changed, and
  without a passing release validation at the book's current commit. Each cut
  MUST have a delivery record (0015-work-packages FR-017).
- **FR-026**: Every authorship attribution MUST reflect whose work it is, not
  who ran the command. An AI that runs its own autonomous editorial or audit
  pass MUST be attributed to its own agent identity, never to a human, and
  where it is unclear whose work a pass was, it MUST be attributed to a human.
- **FR-027**: The following MUST remain a person's acts and MUST NOT be done
  by an agent: the publication decision and publish date, praise-quote
  outreach, commissioning and approving cover art, the vendor and ISBN
  accounts, the AI-content disclosure a vendor requires, the print proof, the
  page-by-page read of the full rendered book before a final cut (FR-015), the
  decision to accept, pursue, or negotiate an event partnership
  (0009-press FR-024), writing or confirming a research record's basis
  statement (0017-spoken-and-research-works FR-032), minting a DOI, deciding
  a research record's licence or copyright holder
  (0017-spoken-and-research-works FR-033), and a vendor's submission. An
  agent MAY draft any of them for the person, except the page-by-page read,
  which no draft stands in for.
- **FR-028**: A praise quote MUST be real, from a named endorser actually
  contacted, and MUST NOT be drafted, paraphrased, or fabricated by an agent.
  Cover artwork MUST NOT be generated, altered, or approved by the production
  pipeline; a marketing image of a cover MUST be composed from the book's own
  approved cover pixels and MUST NOT be redrawn by a generative tool.
- **FR-029**: A new piece for the imagery pool MUST NOT be commissioned for a
  book before the manuscript has passed its audit.

## Online appendix, companion, and news

- **FR-030**: A book MAY have an online appendix: reference material the text
  cites but a print reader does not need on the page. Its source is
  `online-appendix.adoc` in the package, next to the manuscript. The printed
  book MUST state each table's main point in its own prose, MUST give the
  appendix's address once on the copyright page and once at the first
  citation, and the appendix MUST show the date it last changed.
- **FR-031**: A book MAY have an online companion: material the printed text
  points readers to that a print reader does not need on the page. Its source
  is AsciiDoc in the package's `companion/` directory, and each page is
  published as a generated content document
  (0002-content-format FR-017) of kind `ifweb:WorkEditionPage`. The folder
  tree is the URL tree.
- **FR-032**: A companion or appendix address, and a companion page's file
  name, MUST NOT change once a copy that prints it has left the Eidolon. A
  printed book MUST point readers only to the company's own public site for
  its companion, updates, and resources, and to no other address.
- **FR-033**: A companion page MUST be audited (FR-002), MUST cite a book's
  chapters by their current full titles in quotation marks and never by
  number, and a commit that retitles a chapter MUST update every page that
  quotes the old title. A term defined only in the companion MUST be recorded
  in the book bible and MUST NOT be redefined by the manuscript.
- **FR-034**: A companion page whose tables are fill-in forms SHOULD offer a
  spreadsheet generated from the page's own tables; the generated file MUST
  NOT be committed.
- **FR-035**: Every book MUST keep a news record (`NEWS.adoc`) from the day
  its package is created, whether the book is public or not: the
  reader-facing record of what is new since a reader last read it, newest
  first, each entry dated and headed in plain words. A new book's record MUST
  begin with a summary entry, `New book: <title>`, saying what the book argues
  or gives its reader, who it is for, the problem it solves, and its named
  ideas and tools.
- **FR-036**: A news entry MUST be written, in the same commit as the change,
  when the change is substantial content a reader would care about: a
  chapter, section, argument, framework, case, tool, or figure added,
  removed, or substantially rewritten; material moved between print and the
  companion; a correction a reader could have relied on; a change to who the
  book is for. An entry MUST NOT mention the physical object or the
  publisher's process: the cover, jacket, title, ISBN, page count, layout,
  printings, review copies, audits, or pipeline work. An entry MUST NOT hype,
  promise what the book does not deliver, or name unshipped work, and one that
  stops being true MUST be corrected or removed.
- **FR-037**: A book's news record MUST be published as a generated content
  document once the book itself is announced, and MUST NOT be published for a
  book that has not been announced, because publishing its news would
  announce the book.

## Books as working AI

- **FR-038**: A book that teaches an actionable method MUST make it available
  to a reader's own AI as a skill, an MCP tool, or both, grouped by the
  outcome a practitioner would reach for rather than one per chapter, per
  0009-press FR-016.
- **FR-039**: A skill or MCP tool MUST execute the method the book teaches
  faithfully and MUST conclude with a recommendation and its reasoning. Where
  the book's own material presents more than one defensible path, it MUST
  present the live options side by side with what would make each right.
  Where the evidence is too thin for any recommendation, it MUST say so
  plainly and name the evidence that would resolve it, and MUST NOT fabricate
  certainty. A skill whose role, as its book defines it, is to draft,
  reconcile and execute without deciding is exempt from the duty to conclude
  and MUST say so in its front matter; 0009-press FR-017 governs it.
- **FR-040**: A skill is a work of kind `skill` and a Substantial Work. It
  MUST be related to the concept it operationalizes by `schema:isBasedOn`
  (0007-work-and-assets FR-015) and MUST NOT reach a reader before the
  publication decision for the book it realizes, nor stand in its place.
- **FR-041**: The named tools, tests, and frameworks of a book MUST also be
  queryable in the ontology, each individual carrying provenance to the exact
  source file and section it was extracted from and an explicit audience
  declaration. The extraction MUST be generated and MUST NOT be hand-edited,
  and a naming collision across works MUST be flagged for a person's decision,
  never silently resolved.

## Written public web content

- **FR-042**: Written public-facing content of a web property is a Press work
  of kind `website` (0009-press FR-025). Its text MUST be held in the
  Eidolon as content documents; its package MUST hold the website's
  bible and audit record and MUST NOT hold a second copy of the text.
- **FR-043**: A website's text MUST be audited in full against FR-002 at least
  as often as 0009-press FR-027 requires, with the findings and fixes
  recorded in the package. A change a visitor would care about MUST have a
  dated "what's new" item written in the same commit, in the standard of
  FR-036 and never about layout, titles, or build.

## Promotion

- **FR-044**: No work's source carries promotion: a call to action, a
  conversion prompt, a lead-capture or tracking hook, or promotional framing
  written to move a reader toward a product, service, or contact. A method's
  own instrument — a sample prompt, an interview guide, a worksheet — that is
  part of the argument is content and stays in the work.
- **FR-045**: A promotion layer is its own record in a web property's
  presentation, paired to one work by the work's kind and slug; a
  promotional post that promotes several works or a Journal issue is such
  a record for each (0021-works-and-presentations FR-023). The record
  names the work; the work never names the record, and nothing in a work's
  package is edited to make a pairing. When a work's slug changes, its
  pairing MUST move with it in the same change.
- **FR-046**: Every published work MUST have a promotion brief written before
  release: the reader, the promise checked against the work, each claim in
  any description and where the work keeps it, the keywords and subject
  headings a reader would use, the surfaces where the work will and will not
  be described, comparables or a note that there is no basis yet, the
  decisions a person still owes, and who checks each category and surface
  live. A book keeps this as its distribution metadata; every other work
  keeps it beside its source. The brief is never a second copy of the work.
  The brief MUST state how the work will be found and by whom. Promotion
  MUST be deliberate and in good taste: no spam, manufactured urgency, or
  inflated social proof. Whether, where, and how hard to promote is a
  decision of the decision authority or the editor they name, and no quota
  sets how much.
- **FR-047**: Promotion MUST NOT outrun the work. A description, brief, or
  social text MUST NOT claim more than the work keeps, an epistemic label
  MUST survive into any text that summarizes a claim, and no promotion goal,
  channel, sponsor, or outcome measure MAY change a conclusion, a label, the
  order evidence is given in, or what a work chooses to say. When a work
  changes a claim, its promotion brief and paired promotion record MUST be
  reviewed in the same session.
- **FR-048**: Before release a work MUST pass five groups of checks —
  intellectual quality, editorial quality, reader value, production, and
  commercial readiness — and each unmet item MUST be a blocker, a fix before
  release if practical, a next-edition item, or ignored; only a blocker holds
  the release. A discoverability check is a necessary condition and MUST NOT
  be presented as a promise of visibility.

## Book formats and shared terms

- **FR-049**: A Fieldbook is a book that teaches a person to do a kind of work
  better. A Rolebook is a book for a profession or job function whose job has
  changed structurally: it tells an experienced person that the work itself is
  different and what to do on Monday morning. A Rolebook MUST answer five
  questions — what changed around the role, which old work is disappearing or
  commoditizing, which work stays valuable, what the person is now responsible
  for, and what the person does differently on Monday — and it is short by
  design, so no word-count, chapter-length, or page-count range applies to it
  and it MUST NOT be padded to reach one; its chapter-count range still
  applies. A chapter that bears on none of the five answers SHOULD be cut or moved
  to the companion. A format's series kicker MUST NOT be applied to a book of
  the other format.
- **FR-050**: A term that more than one Press work uses MUST be defined once, in
  the ontology, and every work MUST use it as defined and MUST NOT redefine it
  locally. A term that only one work coins is defined in that work's book bible
  (FR-005). A human-readable glossary MAY be generated from the ontology and
  MUST NOT be authored by hand; the Press glossary is generated, and lives in
  the vault at `ai-training/voice/shahid-shah/glossary.md`. A work that appears to define a shared term
  differently MUST be flagged for a person's decision, never silently
  reconciled.

## Out of scope

- Voice principles beyond those in 0009-press, and the audit checklist's own
  contents.
- The house design's measurements, the typesetting tooling, vendor
  walk-throughs, and the editorial console — these are implementation plans
  and, for the console, a later spec.
- Spoken works, anthologies, and research records, which
  0017-spoken-and-research-works establishes.
- The register of books and their status, and any specific book's decisions,
  which are ontology data and package records.

## Edge cases

- A chapter is retitled after a companion page has quoted it: the
  chapter keeps its identifier, and the commit that retitles it updates
  every page quoting the old title, per FR-006 and FR-033.
- A final cut is asked for while the ISBN is a placeholder or a blocker is
  open in the issue register: the cut is refused, per FR-007 and FR-022.
- A content-affecting correction is needed after an edition's final cut:
  the printing number rises and the corrected printing gets its own final
  cut and delivery record, per FR-024 and FR-025.
- A series built from a spoken program's released items, one volume per
  calendar year: it is exempt from joint release, and each volume keeps
  its own edition and printing, per FR-010 and
  0017-spoken-and-research-works FR-011.
- A change moves a table to the companion and also changes the page
  count: the news entry describes the move and says nothing of the page
  count, per FR-036.
- A skill that realizes a book's method is ready before the book's
  publication decision: it does not reach a reader until that decision,
  per FR-040.

## Assumptions

- Every book is produced as a work package and moves through the work
  lifecycle that 0015-work-packages defines.
- Printed books are sold through outside vendors that publish their own
  subject taxonomies and require an ISBN for print.
- The company controls a public site of its own that a printed book can
  point readers to for as long as the book is in circulation.
- A voice standard and its audit checklist are kept as house assets that
  Press maintains apart from any one work.
- Any rendition can be rebuilt from its source at the commit it was cut
  from.

## Open questions

- **OQ-1**: Whether a serial series' lifecycle stage is asserted for the
  series or derived from its volumes is not decided; FR-010's joint release
  assumes the volumes advance together.
- **OQ-2**: No process is stated for a reader's correction of a published
  printing beyond the printing number's meaning in FR-024.
- **OQ-3**: Whether a companion page that a printed copy points to may be
  withdrawn, rather than moved, is not stated; FR-032 forbids only a change
  of its address or file name.

## Key entities

- **A book package** — a work package of kind `book`: manuscript, jacket
  data, figures, book bible, issue register, news record, and optional
  appendix and companion.
- **A serial series** — a work of kind `book-series` that keeps one series
  bible over its volumes.
- **An edition and a printing** — plain whole numbers on the manuscript
  marking a substantial revision and a content-affecting correction.
- **A review cut and a final cut** — renditions made traceable to a source
  commit and recorded by a delivery record.
- **A companion** — the generated, web-published material a printed book
  points to, authored in AsciiDoc in the package.
- **A skill** — a Substantial Work of kind `skill` that carries a book's
  method for a reader's own AI.
- **A Fieldbook and a Rolebook** — the two book formats FR-049 distinguishes:
  teaching a person to do a kind of work better, and telling a person whose job
  has changed structurally what to do about it.
- **A shared term** — a term more than one Press work uses, defined once in the
  ontology and used as defined everywhere.
- **A promotion brief** — the supporting record that keeps promotion tied to
  what a work actually keeps, never a copy of the work.

## Success criteria

- **SC-001**: No book is published that has not passed FR-002's audit with
  its record kept.
- **SC-002**: Every chapter keeps its identifier through a retitle.
- **SC-003**: No volume of a serial series is cut without the joint release
  FR-010 requires, except an exempt annual volume.
- **SC-004**: No final cut exists with an open blocker, a placeholder ISBN,
  or more than once per edition and printing.
- **SC-005**: No agent performs an act FR-027 reserves to a person, and no
  praise quote or cover artwork originates with an agent.
- **SC-006**: No companion or appendix address changes after a copy that
  prints it leaves the Eidolon; no book prints an address other than the
  company's own.
- **SC-007**: No news entry mentions the physical object or the publisher's
  process, and every announced book has a news record.
- **SC-008**: Every book that teaches an actionable method has a companion
  skill or MCP tool; none ships before the book's publication decision.
- **SC-009**: No work's source contains promotion; no promotion record
  claims more than its work keeps.
- **SC-010**: No Rolebook lacks an answer to any of its five questions or is
  padded to a length range; no shared term is defined by hand anywhere but the
  ontology, and none is redefined by a work.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which books exist, their status, any identifier) is
      asserted here — all of it is ontology data or package records
- [x] No production mechanics (a specific typesetter, vendor, or hosting
      setup) — those belong to an implementation plan
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
