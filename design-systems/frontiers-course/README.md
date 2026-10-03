# Frontiers Course

How the house teaches a subject at length: a course's outcomes, units, lessons and assessments, the effort each
asks of a learner, and what makes it accessible, written as a directory of Markdown and checked before it reaches a
platform. Its rules are [`spec.md`](spec.md); governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `course.py` | `python3 course.py check COURSE_DIR` reports every rule a course breaks; `python3 course.py model COURSE_DIR` prints the model every delivery target is built from. Standard library only. |
| `schema/course.schema.json` | The model, as JSON Schema 2020-12. |
| `limits.json` | Outcome verbs, lesson types and their minutes, item types, and the pacing and accessibility limits. |
| `assurance/` | `python3 assurance/run.py`: a fixture course that must pass, and edits of it that must fail. |

See `assurance/fixtures/pass/fermi-estimation/` for a course: two units, every lesson type (reading, video,
exercise, discussion) and every item type (multiple choice, multiple response, numeric, text match). `course.py`
docstring gives the source format.
