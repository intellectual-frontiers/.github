# Feature Specification: Work packages

**Spec ID:** 0015-work-packages
**Status:** Draft

**Input:** How a work is held in the Eidolon: the difference between a
simple work and a Substantial Work, the work package that holds a
Substantial Work's source, the source formats a work may use, the
renditions generated from that source and where they go, the content
documents that may be generated from it, and how the work's lifecycle and
audience are recorded. What each kind of work additionally requires is the
business of the specs that establish that kind (0016-press-production,
0017-spoken-and-research-works); where renditions are stored and how a web
property fetches them are decisions outside this spec.

## Simple and substantial works

- **FR-001**: A work MUST be either simple or substantial. A simple work is
  a single content document (0002-content-format), authored or generated,
  whose lifecycle is not tracked. A Substantial Work is a work whose
  lifecycle is tracked, per 0007-work-and-assets FR-017.
- **FR-002**: Every Substantial Work MUST have exactly one work package. A
  work package MUST NOT exist for a work whose lifecycle is not tracked.
- **FR-003**: A simple work becomes a Substantial Work only by both
  establishing its `ifcore:SubstantialWork` individual — with its first
  lifecycle stage and its lifecycle owner — and creating its work package.
  Promotion MUST NOT change the URL path of any content document the work
  already has, per 0004-addressing FR-001.

## The work package

- **FR-004**: A work package MUST be a directory at
  `works/<kind>/<slug>/` at the root of the repository that holds the work,
  or at `ventures/<company>/works/<kind>/<slug>/` for a work belonging to a
  venture held under 0011-studios FR-019 through FR-021. `<slug>` MUST be a
  short, URL-safe, kebab-case name, unique within its kind, and MUST NOT
  change once any content document or delivered rendition exposes it.
- **FR-005**: `<kind>` MUST name an `ifcore:WorkKind` individual declared in
  the ontology before any work package of that kind exists, per
  0001-eidolon-architecture FR-037. A kind names the work's primary
  presentation form, not the work itself, per
  0021-works-and-presentations FR-019.
- **FR-006**: A work package is not a content root. No file inside one is a
  content document, and no consumer serves a file from one directly, per
  0004-addressing FR-004 and FR-009.
- **FR-007**: A work package MUST have exactly one live source — one
  committed, live-edited source per work, in one format — and nothing else
  in the repository MAY be a second live copy of it. A frozen predecessor of
  the source in another format, where one is kept, MUST be marked non-live
  in its own folder and MUST NOT be edited. Anything that must exist in
  several places MUST be one real copy referenced from the others, per
  0001-eidolon-architecture FR-019.
- **FR-008**: A file in or beside a work package MUST NOT assert, as a
  literal, a fact the ontology asserts about the same work: its lifecycle
  stage, its lifecycle owner, its audience, or its decisions. It MUST
  reference the ontology instead. A file regenerated mechanically MUST
  carry `.auto.` in its file name and MUST NOT be hand-edited.

## Source formats

- **FR-009**: A work that is long-form, print-bound, or pixel-precise — a
  book, a paper, an issue of a printed periodical, or any work whose
  rendition is typeset — MUST use AsciiDoc (`.adoc`) as the format of its
  source. The Eidolon MUST NOT adopt a second authoring or typesetting
  markup for such a work.
- **FR-010**: A work that is short web content MUST be a simple work
  authored as a content document under 0002-content-format FR-016, unless
  it has been promoted under FR-003.
- **FR-011**: The spec establishing a work kind MUST name the source format
  of every work of that kind. Where it is silent for a prose source, the
  format MUST be AsciiDoc.
- **FR-012**: Markdown, or any markup other than HTML5 and AsciiDoc, MUST NOT
  be the source of any text a work publishes. Structured data that sits
  beside a source (a jacket, an episode record) MAY use a data format but
  MUST NOT carry the prose of the work. A record that belongs to a work
  package's operation and is never published as the work — a bible, an
  audit record, an issue register — is not the work's text and carries no
  format rule from this spec.

## Renditions

- **FR-013**: A rendition is an artifact generated deterministically from a
  work's source: a PDF, an EPUB, a cover, an audio or video file, a bundle.
  A rendition that is not a text content document is a binary rendition.
- **FR-014**: A binary rendition MUST NOT be tracked in Git in any Eidolon
  repository. A binary file that is an input rather than a generated output
  — figure or cover artwork, a font — MAY be tracked. A book's cover mockup
  composed from its approved cover art (0016-press-production FR-028) MAY
  be tracked beside that art: its file name carries `.auto.` (FR-008), and
  it MUST record the fingerprint of every input it is drawn from, so a check
  can say without redrawing it whether it is current.
- **FR-015**: A binary rendition MUST be reproducible from committed source
  and committed tooling at a recorded commit. The build MUST record that
  commit in the artifact's own metadata and in its delivery record.
- **FR-016**: A binary rendition MUST be delivered, by a deterministic
  command, to storage outside every Eidolon repository: the distribution
  platform's archive (0046-distribution-platform FR-020). Which storage holds
  the archive is 0046-distribution-platform OQ-1.
- **FR-017**: Every delivered binary rendition MUST be represented by a
  delivery record — a `Reference` — carrying where the rendition lives, the
  source commit, the date delivered, and a checksum, and carrying its own
  audience declaration per 0001-eidolon-architecture FR-015. A delivery
  record's audience MUST NOT be broader than its work's audience. A
  delivery record MUST NOT hold a credential, a password, an access secret,
  or a signed or expiring address.
- **FR-018**: A rendition circulated before the work's publication decision
  (FR-025) MUST be visibly marked on its face as unpublished and
  uncorrected, so it cannot be mistaken for the published one.

## Generated content documents

- **FR-019**: A content document generated from a work package's source
  (0002-content-format FR-017) MUST live in the `content/` directory of the
  repository that holds the package.
- **FR-020**: A generated content document MUST be reproducible:
  regenerating it from its source at the current commit MUST yield
  identical bytes, and a difference MUST fail the check. A generated
  content document MUST NOT be hand-edited.
- **FR-021**: A generated content document's audience MUST NOT be broader
  than the audience of the work it renders, except a companion page, a
  news record or show notes of an announced work, per FR-030.

## Lifecycle, decisions, and audience

- **FR-022**: A Substantial Work's lifecycle stage MUST be asserted exactly
  once, as ontology data in the repository that holds its package, per
  0007-work-and-assets FR-018. Its lifecycle owner MUST be asserted once,
  per 0007-work-and-assets FR-021.
- **FR-023**: Advancing a Substantial Work to its next stage MUST be
  recorded as a `Decision` (0008-decision-records) in the same commit that
  changes the stage. A work MUST advance only to the next stage in order. A
  work brought in from outside the Eidolon MUST enter at the stage its
  actual state supports, with a `Decision` recording why that stage and not
  an earlier one.
- **FR-024**: A work's audience MUST default to the most restrictive
  available audience until a publication decision records otherwise, per
  0001-eidolon-architecture FR-012.
- **FR-025**: Broadening a work's audience to Public MUST be its own
  `Decision`, made by the decision authority in effect
  (0001-eidolon-architecture FR-029) and recorded before any consumer
  serves the work, one of its generated content documents, or one of its
  renditions to the public. Broadening an audience requires no history
  rewrite; narrowing one is governed by 0008-decision-records FR-013.

## Announcement

- **FR-027**: A Substantial Work MAY be announced: its public record (FR-029)
  is made visible to the public while the work itself keeps its audience.
  Announcing a work MUST be its own `Decision`, made by the decision
  authority in effect (0001-eidolon-architecture FR-029) and recorded before
  any consumer shows the work's public record, and the announcement MUST be
  asserted once, on the work's individual, in the same edit. A Public work's
  publication decision (FR-025) also announces it.
- **FR-028**: A work MUST NOT be announced before it reaches the Review
  stage. Advancing a work to Review MUST record its announcement Decision in
  the same edit, unless the person deciding states that the work is held,
  which the stage `Decision` records; a held work is announced only by a
  later Decision of its own.
- **FR-029**: An announced work's public record MUST be only these facts, as
  the work's own source states them:
  - every kind: its title and subtitle, its kind, its author's name and
    published biography, and its status (FR-031);
  - a book or a book series: its tagline, its jacket's description, its
    back-cover headline, body and bullets, its subject categories, its
    series and volume, its list price, its front cover, and its ISBN once
    the jacket holds an issued one (0016-press-production FR-022);
  - a research record: its abstract, its area and pillar, its licence, its
    claim labels (0017-spoken-and-research-works FR-021), and its DOI once
    one is minted;
  - a spoken work: its description and, for each released episode, its
    show-notes page (0017-spoken-and-research-works FR-016);
  - a skill: its name and its description;
  - a course: its code, its format and the work it is derived from.
- **FR-030**: A companion page, a news record, and a released episode's
  show-notes page generated from an announced work MUST carry the Public
  audience. No other content document generated from an announced work that
  is not Public may carry it.
- **FR-031**: A consumer MUST show an announced work's status as one of
  three, derived from the work's records and never asserted: *available*,
  when a delivery record or reference for one of its presentations is
  Public; *working paper*, for a research record with none; *forthcoming*,
  for any other work with none. A consumer MUST NOT show an announced work's
  lifecycle stage or its Decisions.
- **FR-032**: Announcing a work MUST NOT make its source, its concepts file,
  its renditions, its delivery records, or its Decisions visible beyond the
  work's own audience.

## Works published elsewhere

- **FR-026**: Where a Substantial Work's authoritative text is published
  elsewhere, once published, the Eidolon MUST hold a reference to it and
  MUST NOT serve a copy of it as the work's primary text, per
  0007-work-and-assets FR-016.

## Out of scope

- Where delivered renditions are stored, how a consumer retrieves them, and
  when — these are decisions outside this spec, and a consumer's own spec
  states how a consumer retrieves them (0004-addressing FR-010).
- What a book, a serial series, a spoken work, or a research record
  additionally requires of its package — the specs that establish those
  kinds (0016-press-production, 0017-spoken-and-research-works).
- The commands, build tooling, and layout of any repository's automation —
  those belong to an implementation plan.
- How a web property renders and presents a generated content document.

## Edge cases

- A simple work whose lifecycle starts being tracked: it is promoted by
  establishing its individual and creating its package together, and its
  existing content document keeps its URL path, per FR-003.
- A work brought in already well advanced: it enters at the stage its
  actual state supports, with a `Decision` recording why, per FR-023.
- A predecessor of the source kept in an older format: it sits in its
  own folder marked non-live and is never edited, per FR-007.
- Cover artwork or a font inside a package: it is an input and may be
  tracked; the cover or PDF built from it may not, per FR-014, except the
  cover mockup with its recorded fingerprint.
- A review copy shared before the publication decision: it is marked on
  its face as unpublished and uncorrected, per FR-018.
- A work advanced to Review that its author is not ready to show: the
  advance records that it is held, and it is announced only by a later
  Decision, per FR-028.
- An announced book that is later published: its publication decision
  makes it Public and its status follows its records, per FR-025 and
  FR-031.
- An announced book whose jacket still holds an ISBN placeholder: its
  public record leaves the ISBN out until an issued one is stated, per
  FR-029.
- A rendition held in storage reached through a signed or expiring link:
  its delivery record names where it lives without that link, per
  FR-017.

## Assumptions

- Each repository holding work packages is under Git, so a commit is a
  stable reference for a source and its tooling.
- The build toolchain can be pinned closely enough that rebuilding at a
  recorded commit reproduces a rendition.
- Storage outside every Eidolon repository exists and can be written by
  a deterministic command.
- A work's lifecycle stages form a single ordered sequence, so "the next
  stage" is always defined.

## Open questions

- **OQ-1**: Which lifecycle stage a continuously released work — an online
  edition that is updated each time an item is released — occupies between
  releases is not stated.
- **OQ-2**: Whether a slug must be unique within its kind across the
  root's `works/` and every venture's `works/`, or only within the one
  directory that holds it, is not stated.
- **OQ-3**: How an announcement is withdrawn, and what a consumer then
  shows at the work's addresses, is not stated.

## Key entities

- **A simple work** — a single content document, authored or generated,
  whose lifecycle is not tracked.
- **A work package** — the one directory that holds a Substantial Work's
  source, at `works/<kind>/<slug>/`.
- **A work kind** — an `ifcore:WorkKind` individual naming a family of
  works that share a source format and a set of rules.
- **A work source** — a work's one live, committed source: AsciiDoc for a
  long-form, print-bound, or pixel-precise work.
- **A rendition** — an artifact generated deterministically from a source;
  a binary rendition is never tracked in Git.
- **A delivery record** — a `Reference` recording where a delivered binary
  rendition lives, from which source commit, with its checksum and its own
  audience.
- **An announced work** — a work whose public record is visible to the
  public by a recorded Decision while the work keeps its own audience.
- **A public record** — the fixed set of facts about an announced work a
  consumer may show, per FR-029.
- **A generated content document** — a content document produced from a
  work package's source, living in the content root of the repository that
  holds the package.

## Success criteria

- **SC-001**: No Substantial Work lacks a work package; no work package
  exists for a work whose lifecycle is untracked.
- **SC-002**: No work whose form is long-form, print-bound, or
  pixel-precise has a source in any format other than AsciiDoc.
- **SC-003**: No binary rendition is tracked in any Eidolon repository.
- **SC-004**: No delivery record lacks a source commit, a checksum, or an
  audience; none holds a credential or a signed address.
- **SC-005**: A generated content document regenerated from its source is
  byte-identical to the committed one.
- **SC-006**: No work's lifecycle stage is stated as a literal anywhere but
  its single ontology assertion; no stage changes without a `Decision` in
  the same commit.
- **SC-007**: No work, generated content document, or rendition reaches
  the public without a recorded decision broadening its audience.
- **SC-008**: No consumer shows a fact of an announced, non-Public work
  outside its public record, and none shows a work that is neither
  announced nor Public.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, storage products, hosting) —
      those belong to an implementation plan
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
