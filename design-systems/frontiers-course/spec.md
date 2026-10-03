# Feature Specification: Frontiers Course design system

**Spec ID:** frontiers-course
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How Intellectual Frontiers teaches a subject at length: a course's outcomes, units, lessons and
assessments, the effort each asks of a learner, what makes it accessible, and the source a course is written in so
that one source can be checked and compiled to every place a course is delivered.

## Identity and scope

- **FR-001**: `frontiers-course` MUST live at `design-systems/frontiers-course/` and be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the course kind, classified by every course format it supports
  (self-paced, instructor-paced) and every assessment item type it grades (multiple choice, multiple response,
  numeric response, text match), naming `frontiers-figures` by `ifcore:drawsFiguresWith` (0014-design-systems
  FR-048, FR-052). It MUST NOT assume which work a course comes from, who teaches it, or where it is delivered.
- **FR-002**: It MUST hold `course.py` (the reader and checker), `schema/course.schema.json`, `limits.json`, a
  `README.md`, this spec and an `assurance/` harness.

## Source and model

- **FR-003**: A course's source MUST be a directory named for the course's id, holding `course.md` (front matter:
  title, code, run, language, format, hours per week and, when it has one, the IRI of the work it is derived from;
  then its summary and its outcomes) and `units/NN-slug/`, each holding `unit.md` (title, week, overview), its
  lessons and assessments as `NN-slug.md` files in the order a learner meets them, and the captions and figures
  they name. A file that cannot be read, or that names a video in a lesson that is not a video, MUST be refused.
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

## Assurance

- **FR-012**: `assurance/run.py` MUST check that the fixture course in `assurance/fixtures/pass/` uses every lesson
  and item type, reads into a model the schema accepts, the same on every run, and passes `course.py check`; that
  the schema validator reports the departures it should; that every edit in `assurance/fixtures/fail/`, applied to
  a copy of the pass course, is refused for the reason `assurance/fixtures/expected.json` names; that
  `limits.json` and the schema agree; and that the ontology registers this design system as FR-001 says.

## Out of scope

- A course's content, its run dates, its price and its enrolment: the work's and the platform's own records.
- Hosting a course: the platform's (a managed Open edX host, an LMS that takes cmi5).
- Grading by a person (essays, peer review): a course MAY use a platform's own; this design system grades only
  what can be graded automatically.

## Edge cases

- A video hosted on a platform that writes its own captions: the course still carries its WebVTT file, per FR-009.
- A lesson that teaches no outcome (a welcome, a course map): it names the outcomes it introduces, per FR-006.
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

- **SC-001**: `python3 assurance/run.py` exits zero.
- **SC-002**: An author writes a course in Markdown and learns, before it reaches a platform, every outcome left
  untaught or unassessed, every week that asks too much, and every lesson a learner using a screen reader or
  captions could not follow.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
