# Feature Specification: Spoken and research works

**Spec ID:** 0017-spoken-and-research-works
**Status:** Draft

**Input:** What a spoken work, an anthology made from a spoken program, and a
research record each require as a work package (0015-work-packages), beyond
the claims, voice, and audit rules every Press work already follows
(0009-press, 0016-press-production). Research records are the written form
of the research chain 0006-research-and-ip governs: this spec states how a
record is written, labeled, and kept, not what the chain decides about it.
Which shows and records exist is ontology data and package records, not
stated here.

## Spoken works

- **FR-001**: A spoken-first work — radio, podcast, interview, spoken essay,
  talk, panel, or video whose argument is carried mainly by speech — MUST be
  a work of kind `spoken`. A work whose visuals are necessary to make its
  argument is not spoken-first. A spoken work inherits the claims, evidence,
  voice, and audit standards of every Press work, and its own rules MUST be
  additive: they MUST NOT modify or impose requirements on any other work
  kind.
- **FR-002**: A recurring spoken program MUST have a show bible and an
  editorial constitution before an episode is treated as production-ready.
  One intellectual work distributed through several channels MUST remain one
  work, never a duplicate source tree per channel.
- **FR-003**: Every episode MUST state its intellectual purpose in a brief:
  the question, claim, or working theory, the intended listener, the relevant
  evidence, the strongest disconfirming evidence, and the change in listener
  understanding or action it seeks. When a program addresses more than one
  audience, such as the builders of products and the buyers of them, the brief
  MUST state, for each audience, what that listener can do on the next working
  day.
- **FR-004**: An episode's one live source is its script in AsciiDoc. Briefs,
  source ledgers, metadata, audits, recordings, and transcripts MUST NOT
  become second live-edited copies of it.
- **FR-005**: An episode's selected format, recorded in its episode record,
  MUST control the artifacts it requires. A format that requires a full
  script is not satisfied by talking points.
- **FR-006**: Audio and video are binary renditions and MUST NOT be tracked in
  Git (0015-work-packages FR-014). An episode's published locations and
  channel metadata belong in its episode record.
- **FR-007**: A committed post-recording transcript MUST be mechanically
  generated, MUST carry `.auto.` in its file name, and MUST NOT be hand-edited.
  A transcript is a machine record: a quotation from it MUST be checked
  against the recording before it is relied on.
- **FR-008**: A script's length MUST be estimated mechanically from its
  words and the host's observed pace, stored beside the script, and MUST be
  read as stale when the script's content changes. Every figure so derived
  MUST be called an estimate.
- **FR-009**: A schedule a spoken program receives from an outside producer
  MUST be represented as an `ExternalRecordReference`
  (0001-eidolon-architecture FR-022) whose cached copy carries the date it
  was verified, a verification cadence, and a verification method, and MUST
  be read as stale when overdue, per 0001-eidolon-architecture FR-024. Only the schedule MUST be
  copied; nothing else the producer's document holds MAY be read, written, or
  kept, because such a document can hold credentials.
- **FR-010**: A spoken work MUST NOT bind Press to an event. The rules for
  events and partnerships are 0009-press FR-024.
- **FR-035**: A sponsor, vendor, employer, partner, portfolio company, guest,
  or distribution outlet MUST NOT control a spoken work's conclusions,
  questions, guest selection, criticism, or editorial judgment. A guest MAY
  correct factual errors in their own biography, company facts, numbers, or
  quotations and MUST NOT receive general approval or a veto.
- **FR-036**: A commercial relationship that matters to a reasonable
  listener's interpretation of a spoken work MUST be disclosed; a payment
  that buys no appearance and no say over content is recorded privately.
- **FR-037**: A spoken work MUST offer meaningful alternatives where it
  recommends, and MUST NOT make a marketing claim it cannot support.

## Anthologies

- **FR-011**: An anthology is a serial series made from another work's
  released items, one chapter per item, in release order. Each calendar year
  of a program is one volume, a `book` work whose slug is
  `<series-slug>-volume-<year>`, and a volume closes when the next year
  begins, so joint release (0016-press-production FR-010) does not apply.
- **FR-012**: A chapter is a written adaptation of one item: a summary of it,
  never a transcript and never a second copy of the script. It MUST keep the
  host's argument, evidence, and judgment and MUST add no claim the item did
  not make; it MUST leave out every spoken device that does not read on a page;
  it MUST carry at least one visual of its own concept
  (0016-press-production FR-014); it MUST record the identity of the item it
  adapts and a hash of the source it was adapted from, and a check MUST warn
  when that source later changes.
- **FR-013**: A guest chapter MUST state what the guest said as the guest's own
  statements, never as the book's or the host's. The anthology MUST NOT
  fact-check, correct, or label as unverified a guest's attributed statements;
  it MUST check a quotation for fidelity to what was said, never for truth. A
  chapter MAY quote a guest in short attributed excerpts and MUST NOT
  reproduce a whole interview. A guest who asks that a quotation come out MUST
  have it removed in the next running release.
- **FR-014**: A volume MUST be published two ways. A running release goes out
  each time an item finishes its on-demand release, versioned
  `<year>.<n>` and dated, with no ISBN and no print, as a generated online
  edition. One formal release goes out after the volume's year closes, with a
  summary preface, an ISBN, and a final cut. A retail volume MUST NOT change
  after its cut except through printings; the online volume MAY keep
  carrying corrections.
- **FR-015**: A running release MUST NOT reach the public until a named
  person's publication decision is recorded (0015-work-packages FR-025). A
  standing authorization MAY be recorded for a stated condition, and only a
  chapter that meets the condition MAY be published under it.
- **FR-016**: Every released item MUST have a public show-notes page
  generated from the item's record, of kind `ifweb:WorkEditionPage`, holding
  only the title, number and date, where to listen, the guests as the
  broadcast named them, a short summary, the public rows of its source ledger,
  related reading, corrections, and a link to its chapter. It MUST NOT hold the
  brief, the audit record, the machine transcript, or an unresolved claim.

## Research records

- **FR-017**: Research is a work kind, `research`. A record MUST be exactly one
  of an area, a pillar, a note, a landscape review, a paper, a
  publication, a defensive disclosure, a trademark record, or a patent
  draft, and each MUST correspond to its class in 0006-research-and-ip: an
  area to `ifcore:ResearchArea`, a pillar to `ifcore:ResearchPillar`, a
  note or paper to `ifcore:Note`, a landscape review to `ifcore:LandscapeReview`
  (a subclass of `ifcore:Note`), a disclosure to
  `ifcore:DefensiveDisclosure`, a trademark record to `ifcore:Trademark`.
  A landscape review shows how an organization is likely to fare against
  others on a complex task by letting the reader place their own numbers
  against a peer spread. It MUST state its reference class (which
  organizations, which task, which scope and period) and the decision it
  serves. It MUST show a spread, never a single headline figure, when its
  evidence is heterogeneous; each number MUST carry its source, date, and
  the setting it came from. It MUST NOT state a commercial consequence
  without a public source. A vendor's own page is evidence of its process
  only. A landscape review MUST carry the date it is as of and the date by
  which it is reviewed, and an undated review MUST NOT be published.
- **FR-018**: The live source of every prose record MUST be AsciiDoc
  (0015-work-packages FR-009). Typed metadata MUST live in the document
  header or in a data file beside the source, and MUST NOT duplicate a fact
  the ontology asserts. A record is written natively; an idea that came from
  other material MUST say where it came from, as provenance only.
- **FR-019**: A pillar MUST state its question and its status. An area's or
  a pillar's `:status:` MUST begin with one of Intake, Active, Paused or
  Closed, and MAY continue, after a full stop, with what is untested; a
  note's status is plain words on where it stands. No record's status
  speaks of its provenance or of the previous website, which is
  `:derived-from:`'s to say. A note MUST be
  typed as a design pattern or an operating theory, carry a date, and have a
  one-paragraph summary, per 0006-research-and-ip FR-003. A paper MUST have an
  abstract, a status statement, hypotheses each with a practical test, and
  references.
- **FR-034**: A research section states one claim and its support, short and
  exact; a record MUST NOT be a guide, workshop, or Rolebook, and a section
  MUST NOT be padded to a length. A note belongs to exactly one pillar and a
  pillar to one area; a note that bears on another pillar links to it
  instead of repeating.
- **FR-020**: A publication — a peer-reviewed article published elsewhere —
  MUST be held as a reference carrying its authors, journal, date, DOI, and
  address exactly as the DOI registry records them, per
  0007-work-and-assets FR-016. Its abstract MUST be the publisher's or empty.
- **FR-021**: Every research section that makes a claim MUST carry one
  `claim label` from the closed set: observation, hypothesis, evidence,
  inference, recommendation, unknown. The label MUST be true to the evidence.
  A claim label states how settled a research claim is; it is distinct from
  the claim kinds of 0009-press FR-001, which state what sort of claim any
  Press output makes, and a section MAY carry both. The six labels are the
  `ifcore:ClaimLabel` individuals; a check reads the set from the ontology.
- **FR-022**: A section labeled hypothesis, inference, or recommendation MUST
  state what would weaken or overturn it. A section labeled evidence MUST
  carry its source and the date it was checked. A section labeled unknown MUST
  name what evidence would resolve it. A record whose claims are not validated
  MUST say so near its top, in plain words, and MUST NOT present a hypothesis
  as a finding.
- **FR-032**: A research record MAY rest a judgment, recommendation,
  inference, definition, instrument, hypothesis, or open question on its
  author's experience, and MUST then state the basis (roles, years, kinds of
  cases) once near its top, in words the named author wrote or confirmed. An
  agent MAY draft a basis statement and MUST NOT write or confirm it. A
  section labeled observation or evidence MUST carry a citation, a
  supporting source, or a confirmed basis. An author's basis MUST NOT carry
  a quantitative claim the author cannot back.
- **FR-023**: Every external fact in a record MUST be checked against its
  source before it goes in. A reference a public DOI registry resolves needs
  no separate checked date; every other reference carries the date it was
  checked or a plain note that it could not be. A record tied to dated events
  MUST carry the date its facts were checked and the date it must next be
  re-read.
- **FR-024**: A record MUST NOT imply a registration, ownership, or
  enforcement position the underlying record does not support. A granted or
  in-flight patent MUST be referenced, never stored, with the registry
  canonical (0006-research-and-ip FR-008, 0007-work-and-assets FR-012). A
  patent not yet filed MUST be a patent draft held as a Substantial Work
  through filing, and once filed its draft MUST be closed with a pointer to
  its application and MUST NOT be edited further (0007-work-and-assets
  FR-020).
- **FR-025**: A sponsor, vendor, employer, partner, portfolio company, or
  customer MUST NOT control a research conclusion, and a commercial
  relationship that matters to a reasonable reader's interpretation MUST be
  disclosed. When new evidence changes a claim, the record MUST change in the
  same commit, keeping the earlier claim in its revision record if it was ever
  published, and MUST carry a visible correction where a reader must know.
- **FR-033**: A research record's licence and copyright holder MUST be
  stated in its header and recorded by a Decision (0008-decision-records)
  before the record is published; until then its printed form MUST read all
  rights reserved. A licence on a record's text and figures MUST NOT license
  the company's names and marks, and code and tools that accompany a record
  are licensed separately. Minting a DOI is a person's act, and a DOI MUST
  be minted only for a version the person is ready to have cited.
- **FR-026**: A record's slug MUST NOT change once published. A rename MUST
  leave a redirect entry.
- **FR-027**: A record's links to books, named ideas, episodes, other
  records, patents, disclosures, and trademarks MUST resolve at check time.
- **FR-028**: A record MAY have a companion: worksheets, templates, evidence
  dictionaries, calculators, study kits, and data a reader uses to apply or
  test its claims, authored as AsciiDoc in the package's `companion/`
  directory and published as generated content documents
  (0016-press-production FR-031). A companion offers a working copy of an
  instrument; the record states the claim, the evidence, and the instrument as
  it was tested. A tool MUST define each measure the way the record defines it,
  show its inputs and its formula, and say what the measure does not show, and
  MUST NOT send a user's data anywhere unless the user chooses. A companion
  instrument MUST name the record and the `:revnumber:` it implements. A
  change to an instrument that alters what it measures, asks, or decides MUST
  be made in the record first, as a revision (FR-025), and then carried to
  the companion; a companion MUST NOT fix a method the record has not
  corrected. A companion page cites the record's sections by their current
  full titles in quotation marks, never by number. A replication result MUST
  NOT be published without the permission of whoever supplied it.
- **FR-029**: A record that teaches an actionable method MAY make it available
  as a skill, an MCP tool, or both, under 0016-press-production FR-039 and
  FR-040. A skill built on an untested hypothesis MUST ship labeled with the
  hypothesis's status. A result a study kit returns from outside is evidence
  to weigh and MUST NOT by itself change a claim's label.
- **FR-030**: A paper's printed form MUST be a rendition built from the same
  AsciiDoc source to the house design for research papers (`frontiers-print`'s
  journal article, themed by `frontiers-brand`), which holds the
  quality of the best professional journals of its kind. The paper's source
  and printed form MUST carry only what a reader needs to read, judge, and cite
  it; editorial records MUST sit beside it, never in it. A paper unpublished
  elsewhere MUST be labeled a working paper. A change to the paper design MUST
  be made once, in the shared design, and reviewed on rendered pages of at
  least one two-column and one single-column paper.
- **FR-031**: A research record carries no promotion (0016-press-production
  FR-044), and it MUST have a promotion brief before release
  (0016-press-production FR-046). Any text that summarizes a research claim
  MUST carry the claim's label.

## Out of scope

- The decisions the research chain makes about a finding — disposition, the
  commercialization gate, where AI's role stops — which are
  0006-research-and-ip.
- The migration of research held elsewhere into native records, and any
  triage of it: standing practice here is only the native record.
- The design of the house paper layout, the typesetting tooling, and
  transcription and estimation tooling.
- Spoken-program scheduling by an outside producer beyond FR-009.

## Edge cases

- An episode's format requires a full script and only talking points
  exist: the episode does not meet its format, per FR-005.
- A quotation taken from a machine transcript differs from the
  recording: the recording governs, and the quotation is checked against
  it before it is relied on, per FR-007.
- An outside producer's schedule document also holds credentials or
  contact details: only the schedule is copied, and nothing else in the
  document is read or kept, per FR-009.
- A guest asks that a quotation come out of a chapter already in a
  running release: it is removed in the next running release, per
  FR-013.
- A patent draft is filed: the draft is closed with a pointer to its
  application and is not edited further, per FR-024.
- A study kit returns a result from outside that bears on a hypothesis:
  the result is evidence to weigh and does not by itself change the
  claim's label, per FR-029.

## Assumptions

- Spoken works are recorded and distributed through channels outside the
  Eidolon, and their audio and video can be held outside Git.
- An outside producer's schedule reaches the company as a document the
  company can read but does not control.
- Every peer-reviewed publication a record holds is registered with a DOI
  registry that states its authors, journal, date, and address.
- Machine transcription is available but is not accurate enough to quote
  from without checking the recording.

## Open questions

- **OQ-2**: The lifecycle stage of a recurring spoken program's individual
  episode, where each episode is its own work, is not stated.
- **OQ-3**: Whether a guest's request to remove a quotation obliges a new
  printing of a formal release that already carries it is not stated;
  FR-013 requires removal only from the next running release, and FR-014
  lets a retail volume change only through printings.
- **OQ-4**: Whether a landscape review, an `ifcore:LandscapeReview` and so an
  `ifcore:Note`, also carries a note type (0006-research-and-ip FR-003: a design
  pattern or an operating theory) is not decided.

## Key entities

- **A spoken work** — a work of kind `spoken` whose argument is carried by
  speech: a brief, a script in AsciiDoc, an episode record, and generated
  transcripts and estimates.
- **An anthology volume** — one calendar year of a spoken program, written as
  a book, one chapter adapting each released item.
- **A running release and a formal release** — the always-current online
  edition of a volume, and the one closed print-and-ebook edition after the
  year ends.
- **A research record** — a work of kind `research` that is an area, pillar,
  note, paper, publication, disclosure, trademark record, or patent draft.
- **A claim label (`ifcore:ClaimLabel`)** — one of observation, hypothesis,
  evidence, inference, recommendation, unknown: how settled a research claim
  is.
- **A patent draft** — a not-yet-filed patent held as a Substantial Work
  through filing and closed once filed.

## Success criteria

- **SC-001**: No spoken work has a source other than its AsciiDoc script; no
  audio or video file is tracked in Git.
- **SC-002**: No episode is treated as production-ready without a show bible,
  an editorial constitution, and its brief.
- **SC-003**: No committed transcript is hand-edited; every stored estimate is
  read as stale when its script changes.
- **SC-004**: No anthology chapter adds a claim its item did not make; no guest
  statement is corrected or labeled unverified; no running release reaches the
  public without a recorded decision.
- **SC-005**: No research section that makes a claim lacks a claim label; none
  labeled hypothesis, inference, or recommendation lacks its overturning
  condition.
- **SC-006**: No research record states a filed patent's status as a literal or
  stores its claims; no filed patent draft is still edited.
- **SC-007**: No research record's slug changes without a redirect; every link
  in a record resolves.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which shows or records exist, any guest, any producer)
      is asserted here — all of it is ontology data or package records
- [x] No production mechanics (a specific transcriber, typesetter, or sheet
      product) — those belong to an implementation plan
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
