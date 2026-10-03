# Feature Specification: Frontiers Course design system

**Spec ID:** frontiers-course
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How Intellectual Frontiers teaches a subject at length: a course's outcomes, units, lessons and
assessments, the effort each asks of a learner, what makes it accessible, the source a course is written in, and
the compiler that turns one source into every form a course is delivered in.

## Identity and scope

- **FR-001**: `frontiers-course` MUST live at `design-systems/frontiers-course/` and be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the course kind, classified by every course format it supports
  (self-paced, instructor-paced) and every assessment item type it grades (multiple choice, multiple response,
  numeric response, text match) and every delivery target it compiles to (static web edition, Open edX OLX
  export, cmi5 package), naming `frontiers-figures` by `ifcore:drawsFiguresWith` (0014-design-systems FR-048,
  FR-052). It MUST NOT assume which work a course comes from, who teaches it, or where it is delivered.
- **FR-002**: It MUST hold `course.py` (the reader and checker), `adoc.py` (the AsciiDoc it reads and renders), `build.py` (the compiler), `schema/course.schema.json`,
  `limits.json`, `web.json`, `web/` (the web edition's stylesheet, scripts and fonts, with their licence), a
  `README.md`, this spec and an `assurance/` harness.

## Source and model

- **FR-003**: A course's source MUST be AsciiDoc (0015-work-packages FR-009): a directory named for the course's
  id, holding `course.adoc` (its title, and as header attributes its code, run, language, format, hours per week
  and, when it has one, the IRI of the work it is derived from; then its summary and its outcomes as a description
  list) and `units/NN-slug/`, each holding `unit.adoc` (title, week, overview), its lessons and assessments as
  `NN-slug.adoc` files in the order a learner meets them, and the captions and figures they name. It MUST keep to
  the subset `adoc.py` reads and renders (sections, paragraphs, lists, checklists, figures, quotations, block
  attributes, and strong, emphasis, code, links and inline images); a file that uses anything else (a table, an
  include, an admonition, another delimited block, a passthrough, an attribute entry or reference in its body),
  that cannot be read, or that names a video in a lesson that is not a video MUST be refused, so every target
  shows what the source says.
- **FR-004**: `course.py model` MUST read a source into one JSON model that `schema/course.schema.json` accepts,
  the same model on every run; every delivery target MUST be built from that model and nothing else, and
  `course.py check` MUST refuse a course whose model the schema rejects, naming where.

## Outcomes and alignment

- **FR-005**: A course MUST state three to eight outcomes (`limits.json`), each one sentence that begins with an
  observable verb from `limits.json` (after Anderson and Krathwohl's revision of Bloom's taxonomy) and names no
  state of mind no one can observe ("understand", "know", "appreciate").
- **FR-006**: Every outcome MUST be taught by at least one lesson and assessed by at least one item, and every
  lesson and item MUST name only outcomes the course states. Every unit MUST hold one to eight lessons and end
  with an assessment, and a course MUST grade at least one assessment.
- **FR-007**: Every item MUST have an id unique in its course and name the outcomes it assesses. A multiple-choice
  item MUST offer three to five choices with exactly one correct, a multiple-response item the same number with at
  least one correct and one incorrect, and every choice MUST carry feedback saying why it is right or wrong. A
  numeric item MUST give its answer (and MAY give a tolerance, a number or a percentage), a text-match item its
  accepted answers, and both their feedback.

## Pacing

- **FR-008**: A lesson MUST take no more minutes than `limits.json` allows for its type (reading 20, video 12,
  exercise 45, discussion 20). A reading's stated minutes MUST be within 30% (or two minutes) of its words at 200
  a minute, a video's of its transcript at 150 a minute and of its captions' running time. Units MUST run in weeks
  1, 2, 3 without a gap, and the minutes a week asks MUST be between half and 115% of the course's hours per week.

## Accessibility

- **FR-009**: A lesson MUST meet WCAG 2.2 AA in what its source can carry: every image has alternative text
  describing it; a video has WebVTT captions and its transcript as the lesson's body; a lesson's body starts at
  level-two headings (its title is its heading) and goes down one level at a time; a link's text says where it
  goes; no instruction points by color or position alone; and the course states its language.

## Voice and figures

- **FR-010**: A course's summary, outcomes, overviews, lessons and items MUST sweep clean under
  `frontiers-written-voice`, and a video's transcript under `frontiers-spoken-voice`, when they are beside this
  design system.
- **FR-011**: A figure in a lesson MUST be drawn with `frontiers-figures` and pass its `figcheck.py` when it is
  beside this design system (0014-design-systems FR-048); a raster image (a screenshot, a photograph) is a
  course's own asset.

## Delivery targets

- **FR-013**: `build.py` MUST build every target from `course.py`'s model alone, MUST refuse a course that does
  not pass `course.py check`, and MUST write the same bytes for the same course and brand on every run. A figure
  is themed by the target's brand with `frontiers-figures`, its sans embedded when fontTools is installed.
- **FR-014**: The **web edition** MUST be a static site (a home page stating the course's summary and outcomes, then
  one page a lesson or assessment, in order, with the course's contents, and previous and next links), themed
  by a brand: `web/course.css` holds no color, and every color is a role in `web.json`, a brand role or a mix of
  two (0014-design-systems FR-044), each pair `web.json` names meeting 4.5:1 under every brand here. Every page
  MUST state its language, have one h1, a skip link first, alternative text on every image, captions on every
  video with its transcript beneath, load no script from elsewhere, and not scroll sideways at 375px.
- **FR-015**: An assessment's page MUST let a learner answer each item and check it with `web/quiz.js`, which
  grades it as the item's key says, shows the item's feedback, announces both to assistive technology, and
  keeps a score. The web and cmi5 editions grade in the browser, so the key is in the page: they suit practice
  and LMS completion, and a graded assessment that matters is taken on Open edX, which grades on its server.
- **FR-016**: The **cmi5 package** MUST be a zip holding `cmi5.xml` at its root, valid against cmi5's
  `CourseStructure.xsd`, with a block a unit and an assignable unit a lesson or assessment, the course's outcomes
  as objectives each unit references, and every id under the https IRI given as `--iri`; and the web edition,
  whose pages load `web/cmi5.js`. Launched by an LMS, `cmi5.js` MUST fetch its token and `LMS.LaunchData`, send
  `initialized`; then for a lesson `completed`, for a graded assessment `passed` or `failed` against the LMS's
  mastery score (else `web.json`'s), for practice `completed`; and `terminated` when the page is left, each with
  the launch's context template and cmi5's categories; in Browse or Review mode only `initialized` and
  `terminated`; and opened without cmi5's parameters, nothing.
- **FR-017**: The **OLX export** MUST be a `.tar.gz` holding `course/` as Open edX Studio imports it, with the
  organization given as `--org`: a chapter a unit, a subsection a lesson or assessment (a graded assessment
  graded as `Assessment` in a grading policy that counts them), html for a reading, exercise or discussion
  prompt, a video component with its transcript in `static/` for a video, a discussion component for a
  discussion, a problem an item (multiple choice, checkboxes, numerical with its tolerance, text input), every
  feedback as a hint, the course's files in `static/`, and its summary and effort as the about pages. Its look
  is the platform's theme (a brand package; 0014-design-systems FR-038).

## Assurance

- **FR-012**: `assurance/run.py` MUST check that the fixture course in `assurance/fixtures/pass/` uses every lesson
  and item type, reads into a model the schema accepts, the same on every run, and passes `course.py check`; that
  the schema validator reports the departures it should; that every edit in `assurance/fixtures/fail/`, applied to
  a copy of the pass course, is refused for the reason `assurance/fixtures/expected.json` names; that
  `limits.json` and the schema agree; and that the ontology registers this design system as FR-001 says.
- **FR-018**: `assurance/run.py` MUST also, under every brand here, build every target twice and check FR-013 to
  FR-017 in what it builds (validating `cmi5.xml` against `assurance/cmi5/CourseStructure.xsd` when lxml is
  installed), and run `assurance/js.test.mjs` in Node; and `assurance/run.mjs` MUST, under every brand here,
  render the web edition in Chromium at 375px and 1280px and check its width, type, contrast as rendered,
  images, skip link and grading.

## Out of scope

- A course's content, its run dates, its price and its enrolment: the work's and the platform's own records.
- Hosting a course: the platform's (a managed Open edX host, an LMS that takes cmi5).
- The platform's own theme: a brand package for Open edX is built from a brand, not from this design system.
- Grading by a person (essays, peer review): a course MAY use a platform's own; this design system grades only
  what can be graded automatically.

## Edge cases

- A video hosted on a platform that writes its own captions: the course still carries its WebVTT file, per FR-009.
- A lesson that teaches no outcome (a welcome, a course map): it names the outcomes it introduces, per FR-006.
- A video on a platform that serves no file (a streaming service's page): the course names a file it can serve,
  per FR-003's schema, so every target can play it with its captions, per FR-009 and FR-014.
- An LMS that sends no mastery score: a graded assessment passes at `web.json`'s, per FR-016.
- A course derived from a book: `derived-from` names the book's IRI, and its lessons are written for the course,
  never pasted from the book, per FR-008's honest minutes.

## Assumptions

- Learners read at about 200 words a minute in technical prose and listen at about 150.

## Open questions

None.

## Key entities

- **Course** — one subject taught at length, from one source directory.
- **Outcome** — what a learner can do by the end, stated with an observable verb.
- **Unit** — a week's work: lessons, then an assessment.
- **Lesson** — a reading, video, exercise or discussion.
- **Assessment** — items graded automatically, graded or for practice.

## Success criteria

- **SC-001**: `python3 assurance/run.py` and `node assurance/run.mjs` under every brand here exit zero.
- **SC-002**: An author writes a course in AsciiDoc and learns, before it reaches a platform, every outcome left
  untaught or unassessed, every week that asks too much, and every lesson a learner using a screen reader or
  captions could not follow.
- **SC-003**: The same source becomes a site anyone can read, a course Open edX imports and a package any cmi5
  LMS imports, with no step by hand.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
