# Feature Specification: Intellectual Frontiers Press

**Spec ID:** 0009-press
**Status:** Draft

**Input:** The behavioral rules Press's output follows: who the imprint
publishes for and what puts a work on its list, how a claim is
labeled, how Native Alpha gets made legible without being invented, how
Press works with companies outside the parent, how publishing is read as
evidence, how a Fieldbook ships as more than pages, and who owns the
words on every surface Press is responsible for. What Press has actually
published, which channels it owns, and the current register of works are
ontology data and registers, not restated here.

## Claims and evidence

- **FR-001**: Press MUST NOT publish a claim without identifying it as one
  of four kinds: an observable fact, an opinion, a framework, or an
  illustration.
- **FR-002**: Press MUST NOT use narrative to cover weak evidence, and MUST
  NOT manufacture reader approval.
- **FR-003**: Press MUST make Native Alpha legible, credible, useful, and
  durable. Press presents Native Alpha that has already been discovered,
  by Intellectual Frontiers' discovering units or by others, per
  0003-intellectual-frontiers FR-018. Press MUST NOT invent an advantage
  that does not already exist, and MUST NOT originate a Native Alpha
  claim, evident or latent, that no discovery supports. Press's novelty
  lies in how it documents and presents an advantage, never in the
  advantage itself.
- **FR-029**: A piece presenting Native Alpha MUST name where the
  discovery came from: the unit, `Note`, or research pillar, or the
  outside party. It MUST NOT present another party's discovery as the
  firm's own, per FR-022 and FR-023.
- **FR-030**: Press MUST present a latent claim
  (0003-intellectual-frontiers FR-014) as provisional, labeled a
  framework or an opinion under FR-001 and not an observable fact, until
  it has changed an actual decision, per 0003-intellectual-frontiers
  FR-016.

## The imprint and its list

- **FR-038**: The books Press publishes MUST be published under one
  imprint. Its official name, internal short name, readership, slogan, and
  thesis are ontology data (`ifcore:Imprint`), not restated here. A public
  surface MUST name the imprint by its official name only. The internal
  short name MAY be used in specs, records, and conversation inside the
  firm, and MUST NOT appear on a public surface.
- **FR-039**: The imprint's thesis MUST be labeled a framework under
  FR-001, MUST name the work its argument is drawn from, per FR-029, and
  MUST be read against the evidence ladder like any other publication,
  per FR-014. Promotion MUST NOT describe the imprint as the leading,
  definitive, or de facto imprint for its readership; a reader's
  adoption of its terms or willingness to pay is evidence to record,
  never a claim to make (0016-press-production FR-047).
- **FR-040**: Every book Press publishes MUST name, in its promotion
  brief (0016-press-production FR-046): the reader side it serves
  (builder, buyer, or both); the decision to build, buy, or adopt that it
  changes; who other than the reader bears the consequence of that
  decision; and why the decision is costly to reverse. The reader side
  and the consequence domain are also stated in the work's ontology
  record. A book made for the company's own operations
  (`ifcore:NotDistributed`, 0015-work-packages FR-034) is not on the
  imprint's list: FR-040 to FR-042 do not apply to it.
- **FR-041**: Each consequence domain the imprint publishes in MUST be
  recorded in the ontology as core or exploratory. A book in an
  exploratory domain is an experiment: it MUST still satisfy FR-040, MUST
  be shown as an experiment wherever the list is presented, and its
  reception MUST be read on the evidence ladder (FR-014) as evidence about
  whether the imprint should enter that domain. A domain moves from
  exploratory to core, or is dropped, only by a recorded Decision
  (0008-decision-records).
- **FR-042**: A book written for one reader side MUST state what the
  other side will check: a builder-side book what a competent buyer will
  ask to see as evidence, and a buyer-side book what a builder can
  actually prove. A book written for both MUST state each.
- **FR-043**: A buyer-side book's evaluation criteria MUST count a
  seller's claim as Acquired Alpha (`ifcore:AcquiredAlpha`) only when the
  evidence for it cost the seller something real and the buyer can check
  it, per 0003-intellectual-frontiers FR-006. A demonstration, an analyst
  placement, a badge, or expressed interest MUST NOT be presented as
  evidence of Acquired Alpha.
- **FR-044**: Press MUST NOT accept payment, sponsorship, placement, or
  anything else of value from a vendor in a category a buyer-side book
  evaluates, for that book or its promotion. Any relationship between the
  author or the firm and a vendor a book names, including an IF Capital
  or Studios company, MUST be disclosed in the book, and MUST NOT change
  what the book concludes (FR-006).
- **FR-045**: A builder-side book that addresses what to build MUST tie
  its answer to the builder's Native Alpha as the ontology defines it
  (`ifcore:NativeAlpha`), and MUST NOT redefine Native Alpha as knowing
  what to build.
- **FR-046**: Wherever the imprint's list is presented, its books MUST be
  grouped by reader side and then by consequence domain, never by unit
  (0021-works-and-presentations FR-014) and never by format alone.

## Voice

- **FR-004**: Every piece Press produces MUST hold to four voice
  principles: evidence-led, practical, skeptical, and plain.

## Working with companies outside the parent

- **FR-005**: When Press helps a Studios company build its voice, the goal
  MUST be capability transfer — the company learns to own its voice,
  source material, channels, and archive — not permanent dependence on
  Press.
- **FR-006**: When Press helps an IF Capital company, that help MUST be
  collaborative and optional. An investment MUST NOT be treated as
  granting Press editorial control or a promise of favorable coverage.

## Scope and levels

- **FR-007**: A piece written at one of Press's five levels MUST address
  what that level covers, per the levels in the ontology, rather than a
  generic account that blurs levels together.
- **FR-008**: Press MUST NOT wait for outside coverage to explain the firm
  correctly. Outside coverage may add reach, scrutiny, or independent
  validation, but MUST NOT replace the firm's own account.
- **FR-009**: Press's work MUST be evaluated by whether it improves
  understanding and helps somebody make a better decision — not by
  whether it fills a content calendar.

## Corrections and sourcing

- **FR-010**: When a published claim or number turns out to be wrong,
  Press MUST run the correction with the same prominence as the original
  claim, in place, and MUST credit whoever caught the error unless they
  ask otherwise.
- **FR-011**: A published piece MUST carry the evidence for its claims —
  named systems, dated numbers, and the constraint that made the problem
  hard — and MUST be organized by the market it addresses.
- **FR-012**: A recurring editorial thread (framing AI by which new work
  becomes possible rather than hours saved, for instance) MUST still
  satisfy FR-001 and FR-002 — using a thread deliberately does not exempt
  it from being evidence-based and honest about the advantage's limits.
- **FR-013**: Press MUST format a piece to match how its intended audience
  actually consumes material, rather than defaulting to one format for
  every audience.

## Publishing as experimentation

- **FR-014**: Press MUST treat publication as an experiment, not only as
  output: the reception a piece gets MUST be read as evidence about the
  underlying thesis, in the ascending order of strength the ontology's
  evidence ladder states.
- **FR-015**: Press MUST NOT treat the absence of criticism or argument as
  confirmation of a claim; unopposed does not mean validated.

## Books as working AI

- **FR-016**: A Fieldbook that teaches an actionable method MUST make that
  method available to a reader's own AI, as a skill, an MCP tool, or both
  — not only as prose.
- **FR-017**: A skill or MCP tool Press ships MUST execute the method a
  Fieldbook teaches faithfully. It MUST NOT make the judgment, decision,
  or interpretation the book teaches a reader to make for themselves —
  legible and useful, never a substitute for the reader's own judgment.
- **FR-018**: "AI Workforce", "Labor as Code", "Consequential Software",
  and "Acquired Alpha" MUST be used as defined, consistent terms across
  every piece Press produces that uses them, the same way "Native Alpha"
  already is.

## Major works beyond books

- **FR-019**: A major work Press produces MAY be a book, a website, a
  piece of software, or an event — evaluated against FR-001 through
  FR-003 the same way regardless of format. Format does not change the
  evidence standard.

## The Journal

- **FR-020**: A standing periodical Press publishes MUST be represented
  as a `schema:Periodical`, distinct from a one-off work like a book —
  its own current roster of issues and articles is ontology and register
  data, not restated here.
- **FR-021**: An article the Journal publishes MUST satisfy FR-001
  through FR-004 the same as any other Press output. A standing
  publication earns no exemption from claim-kind labeling, the evidence
  standard, or the four voice principles.
- **FR-022**: An article derived from the firm's own tracked research (a
  `Note` or `ResearchPillar`, per 0006-research-and-ip) MUST be related
  to it by `prov:wasDerivedFrom`, per 0007-work-and-assets FR-016. The
  article is the publication; the Note or pillar it was drawn from
  remains the primary research record.
- **FR-023**: A concept with research behind it that originates outside
  Intellectual Frontiers — authored by the founder elsewhere, for
  instance — MUST be referenced from the Journal article rather than
  republished as if the Journal were its primary source, per
  0007-work-and-assets FR-016.
- **FR-031**: Press MUST publish one standing journal until a recorded
  Decision adds another. Its name, short form, and cadence are ontology
  data, not restated here.
- **FR-032**: The Journal MUST report outcomes: what the firm's works
  found, made, or proved since the previous issue, including the
  decisions they changed and the evidence for each. Company or unit news
  MUST NOT be its subject; that is a promotional post
  (0021-works-and-presentations FR-023), which points to the Journal.
- **FR-033**: An issue MUST be a presentation (0021-works-and-presentations
  FR-004) that gathers articles, each naming the work it presents. An
  issue's online and print editions MUST be two presentations of the same
  issue, carrying the same articles.
- **FR-034**: The Journal's sections MUST be organized by the market or
  reader problem they address (FR-011), never by unit
  (0021-works-and-presentations FR-014).
- **FR-035**: A correction to an article MUST be made in place online,
  per FR-010, and MUST run in the next printed issue with the same
  prominence as the original, naming the issue it corrects.
- **FR-036**: Where an issue reports what changed in a book, it MUST draw
  on the book's news record (0016-press-production FR-035) rather than a
  second account of the change.
- **FR-037**: Press MAY publish promotional posts for search, answer
  engines, and other promotion, alongside the Journal. Each MUST satisfy
  FR-001 through FR-004 and 0021-works-and-presentations FR-023 through
  FR-025.
- **FR-047**: Every item the Journal carries MUST be labeled with exactly
  one department, the form it takes: a finding, a made item, a paper, a
  program, a note, a position, a referenced piece (elsewhere), or a
  correction, as the ontology's Journal departments define them. A
  department is a label on the item, never a section of the Journal:
  FR-034 stands, and the sections are the research areas, each the reader
  problem it addresses. A paper, a program and a note the Journal carries
  are the firm's research records themselves (0006-research-and-ip),
  shown under the Journal's front and keeping their own pages.
- **FR-048**: A position MUST state, in one sentence on the article, what
  would make it wrong. Where the position's subject is a Noema, that
  sentence MUST agree with the Noema's falsification criteria
  (0048-noemas FR-017). The Journal MUST keep a public register of its
  positions, each with the date it was stated and whether it stands, is
  settled or is reversed; a reversed position stays in the register and
  is reported as a correction under FR-049.
- **FR-049**: Every correction the Journal makes under FR-010 and FR-035,
  and every reversal of a position, MUST be recorded as a correction
  naming the article, the date, what changed and why, and MUST be listed
  on one public corrections page, in place and never deleted. The page
  MUST say so when there is none.
- **FR-050**: A product (a skill, a companion, an interactive tool, a
  piece of software, a shared service, a dataset or a method) MUST NOT be
  introduced in the Journal except by an article that names the reader
  problem it addresses and, where it derives from the firm's own research,
  the Note or pillar it derives from, per FR-022. An article that only
  explains a product, with nothing a reader can run, MUST NOT be published
  as its introduction.
- **FR-051**: A release of a product MUST be reported in the issue of its
  quarter as a made item: what changed and what was measured, each claim
  labeled under FR-001, in the Journal's words and with no launch
  language. The release's announcement MUST be a promotional post
  (0021-works-and-presentations FR-023) that links to the made item, and
  the product's own page and the website's news MUST carry the release
  note; the made item MUST draw on that note, as FR-036 draws on a book's.
- **FR-052**: A failed claim inside a shared service, recorded as a
  completed result under 0011-studios FR-012, MUST be reported in the
  Journal as a finding when the service is public, with the same
  prominence as a claim that held.
- **FR-053**: The Journal MUST publish an item when the work it presents
  lands, and MUST gather every item published in a quarter into that
  quarter's issue, frozen at the quarter's end with its volume and number.
  The front page MUST show the current issue first and the running record
  of programs, notes and positions after it. The periodicity the ontology
  records for the Journal is the issue's.
- **FR-054**: Writing that originated outside the Journal, which FR-023
  requires to be referenced rather than republished, MUST be carried only
  in the elsewhere department, each piece keeping its own kind and linking
  to where it lives, and MUST NOT enter an issue unless it changed a
  decision the issue reports.

## Events and partnerships

- **FR-024**: Press MUST NOT build its own event arm. Where a concept
  earns a stage, Press MUST partner with an operator who owns the venue,
  ticketing, and logistics, and MUST hold a talk to the same editorial
  bar as print — no slide goes in front of an audience that would not
  pass FR-001 and FR-002. Press MUST NOT solicit or pitch itself into an
  event partnership; a partnership becomes eligible only after a Press work
  has been published and an event operator or practitioner has
  independently expressed interest. Accepting or pursuing a partnership,
  and negotiating its terms, is a person's decision, recorded as a
  Decision (0008-decision-records); an agent MAY draft a proposal and MUST
  NOT commit Press or negotiate for it. A talk, deck, workshop, or panel
  built from Press concepts passes the same voice and audit steps as a
  published work (0016-press-production FR-001, FR-002) before it is
  presented.

## Written public-facing surfaces

- **FR-025**: Press MUST be responsible for the accuracy, voice, audit
  step, and change-disclosure of every written public-facing content on
  a web property the company operates. Code, design, and infrastructure
  remain engineering's, not Press's.
- **FR-026**: Press MUST be responsible for the same standard on a
  third-party supplier or vendor registry profile. Unlike a channel it
  owns outright, a registry profile's platform and fields belong to the
  registry — Press owns only the words entered into it.
- **FR-027**: Press MUST review every surface FR-025 and FR-026 cover
  against the current record on a quarterly cadence, and additionally
  within ten business days of any fact a surface states changing. Each
  review MUST be dated and recorded as passed or found-stale.

## Owned channels

- **FR-028**: A publication Press owns outright MUST be represented as a
  `DigitalAsset`, per 0007-work-and-assets FR-007 — not merely named in
  prose.

## Out of scope

- The full voice principles, beyond the four named in FR-004, belong to a
  future brand spec; what's stated here is the minimum Press's own rules
  need to be testable.
- The current register of books, software, and other major works — what
  Press has actually published — is ontology and register data, not
  spec-level, the same reasoning `context/registers.md`'s pattern already
  established for patents.
- Which specific publications Press owns outright, and verifying their
  ownership, is ontology population, not this spec.
- Where Press's own production detail (a method's skill or MCP source,
  how it's built and reviewed) lives relative to the vault is not decided
  here.

## Edge cases

- A book that serves builders and buyers in a domain the ontology records
  as exploratory: it stays under the imprint as an experiment, satisfies
  FR-040 and FR-042 like any other book, and is shown as an experiment,
  per FR-041.
- A buyer-side book evaluating a category in which an IF Capital company
  competes: the relationship is disclosed in the book and does not change
  its conclusion, per FR-044 and FR-006.
- A vendor offers to sponsor the launch of a buyer-side book that
  evaluates its category: the offer is refused, per FR-044.
- A reader writes that the imprint is the best source for buyers of
  consequential software: the remark is recorded as reception on the
  evidence ladder and is not repeated in promotion as a claim, per FR-039.

- A piece that mixes a measured result with the author's reading of it:
  each claim carries its own kind, so the result is an observable fact
  and the reading an opinion or a framework, per FR-001.
- A latent Native Alpha claim that has not yet changed a decision: it is
  presented as provisional and labeled a framework or an opinion, never
  an observable fact, per FR-030, and names its source, per FR-029.
- An article that draws on both a tracked `Note` and a concept that
  originated outside the firm: it is related to the `Note` by
  `prov:wasDerivedFrom`, per FR-022, and references the outside concept
  rather than republishing it, per FR-023.
- A piece that draws no criticism and no argument: the silence is not
  read as confirmation, per FR-015; its reception is placed on the
  evidence ladder like any other, per FR-014.
- A fact on a vendor registry profile changes between quarterly reviews:
  the profile's words are Press's, per FR-026, and are reviewed within
  ten business days of the change, per FR-027.
- A Fieldbook method whose last step is a judgment the reader must make:
  the companion skill or MCP tool runs the method up to that judgment and
  leaves the judgment to the reader, per FR-017.
- A working paper carried by the Journal: it is a paper by department, per
  FR-047, keeps its own page, and its claims carry their kinds and its
  status says it is not peer reviewed, per FR-001 and FR-021.
- An essay of the founder's that lives on the founder's own site: it is
  referenced in the elsewhere department and enters no issue unless it
  changed a decision the issue reports, per FR-023 and FR-054.
- A new skill released with no article behind it: it is listed as a
  product but not introduced in the Journal until its article names the
  problem it addresses, per FR-050; its release is still a made item of
  the quarter, per FR-051.
- A position whose subject is later falsified: the register marks it
  reversed and a correction is listed, per FR-048 and FR-049; the article
  stays, corrected in place, per FR-010.
- A note dated in a quarter that no article draws on: it is in the
  running record and in that quarter's issue as a note, per FR-047 and
  FR-053, and is not a finding.

## Assumptions

- Each book's reader side, decision, consequence bearer, and reversal
  cost can be stated in a sentence each, so FR-040 can be met without a
  new record kind.

- Each claim in a piece can be assigned exactly one of the four claim
  kinds FR-001 names.
- The ontology holds the Press levels, the claim kinds, and the evidence
  ladder that FR-001, FR-007, and FR-014 point to.
- A reader's own AI can load a skill or call an MCP tool, so FR-016's
  companion is usable by the reader it is meant for.
- Every surface FR-025 and FR-026 cover can be listed, so the review
  FR-027 requires can find each one.

## Open questions

- **OQ-1**: No individual Press lead is named, distinct from the founder —
  tracked company-wide per 0003-intellectual-frontiers OQ-1, not repeated
  here.
- **OQ-2**: No process is stated for whether Press retains any oversight
  of a company's claims-standard compliance after capability transfer is
  complete and the company owns its own voice.
- **OQ-3**: No rule states whether FR-005 or FR-006 governs Press's help
  to a company that is both a Studios company and an IF Capital company.
- **OQ-4**: Whether "Acquired Alpha" needs trademark clearance, as "Native
  Alpha" has, is not decided; until it is, the term carries no mark.
- **OQ-5**: The two positions the Journal has published do not yet state
  what would make them wrong, as FR-048 requires; their sentences are the
  author's to write.
- **OQ-6**: How a card's settledness is worded beyond the four claim kinds
  of FR-001 (built, measured once, hypotheses untested, other people's
  evidence) is not a controlled vocabulary yet; each work's status text is
  shown as written until one is decided (0019-controlled-vocabulary).

## Key entities

- **The imprint** — the official name under which Press publishes its
  books, with an internal short name, one readership, a slogan, and a
  thesis labeled a framework.
- **A reader side** — builder, buyer, or both: whom a book serves in a
  decision to build, buy, or adopt.
- **A consequence domain** — a field in which those decisions carry
  consequences for people other than the reader; core or exploratory.
- **Consequential Software** and **Acquired Alpha** — defined terms naming
  the software the imprint's readership builds and buys, and the advantage
  a buyer gains by buying what another party has built, counted only on
  evidence that cost the seller something.

- **A claim kind** — observable fact, opinion, framework, or illustration;
  every claim Press publishes carries one.
- **The evidence ladder** — the ascending-strength reception signals a
  publication's reception is read against.
- **A Press level** — one of five scopes a piece can be written at: the
  firm, a business unit, a Studios company, an IF Capital company, or IF
  Network.
- **AI Workforce** and **Labor as Code** — defined terms naming the
  pattern a Fieldbook teaches a reader to build, and what a reader's own
  work can become once named and made durable.
- **The Journal** — a standing periodical, distinct from a one-off book;
  an article it publishes is related to the research it was drawn from
  by `prov:wasDerivedFrom`, never presented as the primary record.
- **A department** — the form an item of the Journal takes, a label on
  the item and never a section: finding, made, paper, program, note,
  position, elsewhere, correction.
- **A position** — an argued piece that states what would make it wrong
  and stays in the public register of positions until settled or
  reversed.
- **A correction** — a record of a change made in place to a published
  article, or of a position's reversal: the article, the date, what
  changed and why.

## Success criteria

- **SC-001**: Every published claim is labeled by kind — none appear
  unlabeled.
- **SC-002**: A Studios company Press has worked with can produce its own
  material without Press's involvement at some point.
- **SC-003**: No IF Capital company's coverage is contingent on its
  investment relationship.
- **SC-004**: A correction carries the same prominence as the original
  claim and appears in place, not buried or omitted.
- **SC-005**: A piece's reception is recorded and read back against the
  thesis it was meant to test, not published and never revisited.
- **SC-006**: A Fieldbook that teaches an actionable method has a
  companion skill or MCP tool, not only prose describing it.
- **SC-007**: "AI Workforce" and "Labor as Code" carry the same meaning
  everywhere they appear; no piece redefines them locally.
- **SC-008**: No owned channel's accuracy is reviewed less often than
  quarterly, and no stale fact survives ten business days unreviewed.
- **SC-009**: No Journal article derived from the firm's own tracked
  research omits `prov:wasDerivedFrom`; no article republishes an
  externally-originated concept as if the Journal were its primary
  source.
- **SC-010**: Every piece presenting Native Alpha names the source of its
  discovery, and no latent claim is labeled an observable fact.
- **SC-011**: No Journal issue has company or unit news as its subject,
  and no section is named for a unit.
- **SC-012**: Every correction to a printed article appears in the next
  printed issue.

- **SC-013**: Every book names its reader side, the decision it
  changes, who bears the consequence, and why the decision is costly to
  reverse; none is listed without them.
- **SC-014**: Every book in an exploratory domain is shown as an
  experiment, and no domain changes standing without a recorded Decision.
- **SC-015**: No buyer-side book or its promotion was paid for, sponsored,
  or placed by a vendor in the category it evaluates.
- **SC-016**: No promotion calls the imprint the leading, definitive, or
  de facto imprint for its readership.
- **SC-017**: Every item the Journal carries has exactly one department,
  and no department is a section of the Journal.
- **SC-018**: No position is published without the sentence that says
  what would make it wrong, and every position is in the register.
- **SC-019**: Every correction and every reversal is on the corrections
  page, and none is deleted.
- **SC-020**: Every public release of a product in a quarter is a made
  item of that quarter's issue, and no launch note is the record of it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which books exist, which channels are owned, the
      current register) is asserted here — all of it is ontology or
      register data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
