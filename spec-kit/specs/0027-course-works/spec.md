# Feature Specification: Course works

**Spec ID:** 0027-course-works
**Status:** Draft

**Input:** What a course requires as a work package (0015-work-packages): a
subject taught at length, over weeks, with outcomes a learner can show,
lessons, and assessments, beyond the claims, voice, and audit rules every
Press work already follows (0009-press, 0016-press-production). How a
course is structured, paced, assessed, made accessible and compiled is
`frontiers-course`'s (0014-design-systems FR-052); this spec states how a
course is kept as a work. Which courses exist, and where each runs, is
package records and Decisions, not stated here.

## Course works

- **FR-001**: A work that teaches a subject at length — over weeks, with
  stated outcomes, lessons a learner works through in order, and
  assessments — MUST be a work of kind `course`. A course inherits the
  claims, evidence, voice, and audit standards of every Press work, and its
  own rules MUST be additive: they MUST NOT modify or impose requirements
  on any other work kind.
- **FR-002**: A course's source format is AsciiDoc, in the directory form
  `frontiers-course` reads (frontiers-course FR-003), kept as `course/`
  inside the package, its id the package's slug (0015-work-packages
  FR-011). Its captions are WebVTT and its figures are drawn with
  `frontiers-figures`. Its videos are binary renditions, never tracked in
  Git (0015-work-packages FR-014); a lesson names each by an https address.
- **FR-003**: A course MUST have a course bible, `course-bible.md`, before it
  is drafted: who it is for and what they must already know; the outcomes
  and why each is worth a learner's time; the work it is derived from, if
  any; how each outcome is assessed; its pacing; and where it will be
  delivered and in which form.
- **FR-004**: A course derived from another work — a book, a research
  record, a spoken program — MUST name that work's IRI as its
  `:derived-from:`, and its lessons MUST be written for a learner from that
  work's argument, never pasted from its text: a lesson that repeats a
  chapter's prose is not a lesson. The source work's claims, cases and
  evidence carry their own labels and checks into the course unchanged.
- **FR-005**: A course MUST pass `frontiers-course`'s `course.py check`
  before it advances to Prep, and at every stage after; before Prep, the
  check reports but does not fail the package.
- **FR-006**: A course's delivery targets — its web edition, its Open edX
  export and its cmi5 package — are renditions built by `frontiers-course`'s
  `build.py` from the committed source and the vendored design systems, and
  MUST NOT be tracked in Git. A graded run whose grades matter MUST be
  delivered where grading happens on a server (Open edX), never only in the
  web edition, whose answers are in the page (frontiers-course FR-015).
- **FR-007**: Where a course runs — the platform, the provider, the run's
  dates, its price and its enrolment terms — MUST be recorded as a Decision
  on the work (0008-decision-records), never in its source, so one source
  can run on any platform.

## Out of scope

- How a course is structured, paced, assessed, made accessible, themed and
  compiled: `frontiers-course` and 0014-design-systems FR-052.
- Operating a learning platform, its accounts, and the learners' records it
  keeps.
- Certificates, credit, and accreditation.

## Edge cases

- A course taught live, in a room, from the same lessons: it is the same
  work, and its live run is a Decision like any other run, per FR-007.
- A course whose source work is revised after the course is published: the
  course is revised in its own package, and its bible records which
  edition it follows, per FR-003 and FR-004.
- A lesson that needs a table or another construct `frontiers-course` does
  not render: it is rewritten as prose or a list, or drawn as a figure,
  per FR-002.
- A video hosted by a platform that writes its own captions: the course
  still carries its WebVTT captions, per FR-002.

## Assumptions

- Courses are delivered on platforms outside the Eidolon: an Open edX
  instance, an LMS that takes cmi5, or the house's web edition.
- A course's videos are recorded and hosted outside Git.

## Open questions

None. Which platforms run the house's courses is a standing decision kept in
the vault; each run names its platform in a Decision, per FR-007.

## Key entities

- **A course** — a work of kind `course`: a course bible, an AsciiDoc
  source in `frontiers-course`'s form, captions and figures, and an audit
  record.
- **A run** — one delivery of a course on one platform, with its dates and
  terms, recorded as a Decision.

## Success criteria

- **SC-001**: A course package with a bible and a source that passes
  `course.py check` advances to Prep; one that fails the check does not.
- **SC-002**: One course source is delivered on Open edX, through a cmi5 LMS
  and as a web edition, with nothing written twice.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
