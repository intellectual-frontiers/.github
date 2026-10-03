# Feature Specification: Works and presentations

**Spec ID:** 0021-works-and-presentations
**Status:** Draft

**Input:** The separation between a work (the deliverable itself) and its
presentations (the forms in which it reaches an audience: a printed book,
web pages, an episode, a keynote, a course, a skill), and the rule that a
presentation leads with what the work found, made, or proved rather than
with how the company is organized. The model follows the work and
manifestation distinction of the IFLA Library Reference Model, linked with
schema.org's `workExample` and `exampleOfWork`.

## The work

- **FR-001**: A work MUST be the deliverable itself, independent of any
  form it is presented in: a thesis, a method, a finding, a dataset, a body
  of software, or a venture's thesis and operating model.
- **FR-002**: A work's lifecycle stage, lifecycle owner, audience, Native
  Alpha claim (0003-intellectual-frontiers FR-014 through FR-016),
  evidence, and rights MUST be asserted on the work, once, per
  0001-eidolon-architecture FR-019, and never restated on a presentation
  of it. A presentation's own production stage, owner, audience, and
  rights, where it has them, are its own facts, per FR-022.
- **FR-003**: A work MUST NOT be identified by, or exist only as, one of
  its presentations. Retiring a presentation MUST NOT retire the work.

## Presentations

- **FR-004**: A presentation MUST be one form of one work, made for an
  audience through a channel: an edition of a printed or digital book, a
  set of web pages, a journal article, an audio or video episode, a
  keynote or talk, a class or course, or a skill or MCP tool. A
  presentation MAY exist with no rendition, as a live talk does.
- **FR-005**: A presentation MUST name its work by `schema:exampleOfWork`,
  and the work MUST list it by `schema:workExample`. A presentation that
  names no work MUST NOT be published.
- **FR-006**: A presentation made from another presentation of the same
  work (web pages from a book, an episode from a chapter) MUST record that
  by `prov:wasDerivedFrom`, and MUST still name the work itself under
  FR-005.
- **FR-007**: A presentation's audience MUST NOT be broader than its
  work's audience, the rule 0015-work-packages FR-017 and FR-021 already
  apply to renditions and generated content documents.
- **FR-008**: A presentation MUST record who presented it: a person, a
  partner, or an AI-assisted conversion a person approved. The presenter
  is attribution; the work's lifecycle owner (0007-work-and-assets FR-021)
  does not change because someone else presented it.
- **FR-009**: A correction to a claim a work makes MUST be carried to
  every published presentation of that work that states the claim, each
  under its own correction rule (0009-press FR-010 for a published piece).
- **FR-010**: A rendition (0015-work-packages FR-013) MUST be treated as a
  file generated from a presentation, not as the work or as a presentation
  in its own right.

## Channels

- **FR-011**: A web property MUST be treated as a channel through which
  presentations reach an audience, not as a work. A page that presents no
  other work presents the firm itself, and FR-015 governs it.
- **FR-012**: Every other channel (print, audio, video, events, courses
  delivered online or in person) MUST be governed by the same rules as the
  web: no channel's presentation is the work, and none is exempt from
  FR-005 or FR-014.

## Works that become companies

- **FR-013**: When a venture's work leads to a company, the company MUST be
  represented as an organization that the work led to. It is neither the
  work nor a presentation of it. The company receives its own Eidolon once
  it exists, per 0011-studios FR-017, and the work's record in this
  Eidolon then references it rather than duplicating it, per 0011-studios
  FR-018.

## Not shipping the organization

- **FR-014**: The principal subject (`schema:about` or `schema:mainEntity`)
  of a public presentation MUST be a work, a result of a work, or the
  reader's problem that a work addresses. It MUST NOT be a unit or another
  part of how the company is organized. A promotional post is the one
  exception, under FR-023.
- **FR-015**: A public presentation of the firm itself (an organization
  profile, a home or about page) MUST lead with what the firm's works have
  found, made, or proved. It MAY describe the units after that, as the
  means by which the results were produced.
- **FR-016**: A unit MAY appear in a public presentation as provenance (a
  byline, an imprint, or a credit naming who made a work), never as the
  presentation's subject under FR-014.
- **FR-017**: A unit's job and question MUST remain facts in the ontology
  (0003-intellectual-frontiers FR-001), available to people and to AI
  reasoning about the company. FR-014 through FR-016 govern what a
  presentation leads with, not what may be known.
- **FR-018**: The web content kinds (0013-web-content-kinds) MUST make
  FR-014 checkable: a public content document whose principal subject is a
  unit MUST fail the content check.

## The current layout

- **FR-019**: Until a recorded Decision restructures the vault's work
  packages, `works/<kind>/<slug>/` (0015-work-packages FR-004) MUST be
  read with `<kind>` naming the work's primary presentation form, and the
  `ifcore:SubstantialWork` individual for the package MUST be treated as
  the work under FR-001 and FR-002, unless a separate record of the work
  exists. Where one does, the package's individual MUST be typed a
  presentation of that work and name it under FR-005.
- **FR-020**: A package that presents another package's work (a skill that
  carries the method a Fieldbook teaches, per 0009-press FR-016, or a
  book's companion pages) MUST name that work under FR-005 rather than
  stand as an unconnected work. A package whose content is a work of its
  own remains a work.
- **FR-021**: The `website` work kind MUST be treated as the editorial
  record of a channel's own copy, under FR-011, until that copy is
  represented as presentations of works and of the firm.

## Stages of works and presentations

- **FR-022**: A work and each presentation of it that is produced through
  stages MUST each carry their own lifecycle stage. The work's stage is
  how far the idea has matured and been commercialized; a presentation's
  stage is how far its production has gone. Neither implies the other: a
  work MAY be at Commercialize while a book presenting it is at Review,
  and a presentation's stage MUST NOT be read as, or restated as, its
  work's.

## Promotion

- **FR-023**: A promotional post (company or unit news, a launch note, an
  article written for search or answer engines) MAY have the firm or a
  unit as its principal subject, as the one exception to FR-014. It MUST
  be a promotion record under 0016-press-production FR-045, MUST name at
  least one work, presentation, or Journal issue it promotes, and MUST NOT
  be the authoritative record of any result; the work, or the Journal
  article that reports it, is.
- **FR-024**: A promotional post MUST declare a content kind of its own,
  distinct from every presentation kind, so the content check can apply
  FR-014 to every other public page (FR-018).
- **FR-025**: A promotional post MUST meet 0016-press-production FR-047:
  it MUST NOT claim more than the work or article it promotes keeps.

## Out of scope

- The ontology terms for a work, a presentation, a presenter, and a
  channel. They follow this spec, per 0001-eidolon-architecture FR-037,
  reusing established vocabulary per 0019-controlled-vocabulary.
- Restructuring the vault's `works/` directory. FR-019 governs until a
  Decision changes it.
- Which existing packages are presentations of another package's work.
  That classification follows FR-020 and is ontology population.

## Edge cases

- A keynote given with no slides and no recording: it is still a
  presentation of a work, with no rendition, per FR-004, and still names
  its work, per FR-005.
- An audio edition read aloud by an AI voice from a book's text: it is a
  presentation derived from the book, per FR-006; a person's approval is
  recorded as the presenter, per FR-008.
- A web page listing several works, such as a portfolio index: its
  subject is those works, which FR-014 permits; no unit is its subject.
- A careers or contact page whose natural subject is the company's
  structure: it presents the firm itself, so FR-015 requires it to lead
  with results, and OQ-2 holds whether any page is exempt.
- A post announcing what is new at a unit, written for search: it is a
  promotional post, which may have the unit as its subject under FR-023
  and must name what it promotes.
- An idea at Commercialize whose book is still at Review: each carries its
  own stage, per FR-022, and the book's stage says nothing about the
  idea's.
- A talk the founder gives on a work whose authoritative text is
  published elsewhere: the talk names the work under FR-005, and the
  Eidolon holds a reference to the outside text, per
  0007-work-and-assets FR-016.
- A venture company that graduates and is spun out: the work stays the
  work, and the company is an organization it led to, per FR-013.

## Assumptions

- Every channel the company presents through can carry, or be described
  by, a record naming the work presented.
- A work can be identified and described without reference to any one of
  its forms.
- schema.org's `workExample` and `exampleOfWork` remain the established
  link between a work and its examples.

## Open questions

- **OQ-2**: Whether any public page (a legal notice, a contact page) is
  exempt from FR-015 is not stated.
- **OQ-3**: Whether a presentation built for one audience may be re-cut
  for a broader audience without a new presentation record is not
  stated.

## Key entities

- **A work** — the deliverable itself, independent of form; it carries the
  stage, owner, audience, claims, evidence, and rights.
- **A presentation** — one form of one work for an audience through a
  channel; it names its work and records its presenter.
- **A channel** — a medium through which presentations reach an audience:
  the web property, print, audio, video, events, and courses.
- **A rendition** — a file generated from a presentation (0015).
- **A company a work led to** — an organization, neither the work nor a
  presentation of it.
- **A promotional post** — company or unit news written for search,
  answer engines, or promotion; it points to the work or Journal article
  that is the record.

## Success criteria

- **SC-001**: Every published presentation names exactly one work.
- **SC-002**: No work's stage, owner, or audience is stated on a
  presentation.
- **SC-003**: No public content document has a unit as its principal
  subject.
- **SC-004**: The firm's own public profile leads with results of its
  works before it describes its units.
- **SC-005**: A correction to a work's claim appears in every published
  presentation that states the claim.
- **SC-006**: Every public page with a unit as its subject is a
  promotional post that names what it promotes.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
