# Frontiers Course

How the house teaches a subject at length: a course's outcomes, units, lessons and assessments, the effort each
asks of a learner, and what makes it accessible, written as a directory of AsciiDoc and checked before it reaches a
platform. Its rules are [`spec.md`](spec.md); governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `course.py` | `python3 course.py check COURSE_DIR` reports every rule a course breaks; `python3 course.py model COURSE_DIR` prints the model every delivery target is built from. Standard library only. In this repository: `agora course show PATH` and `agora check course --scope PATH`. |
| `build.py` | `python3 build.py web COURSE_DIR -o DIR`, `olx COURSE_DIR -o OUT.tar.gz --org ORG`, `cmi5 COURSE_DIR -o OUT.zip --iri https://...`; each takes `--brand SLUG`. In this repository: `agora course build PATH --target web -o DIR`, `--target olx --org ORG -o OUT.tar.gz`, `--target cmi5 --iri https://... -o OUT.zip`; each takes `--brand`, and `--dry-run` shows what would change. |
| `web/`, `web.json` | The web edition's stylesheet, in-browser grading (`quiz.js`), cmi5 runtime (`cmi5.js`), fonts, and its theme roles. |
| `adoc.py` | The AsciiDoc subset a course is written in, read and rendered without Asciidoctor; anything outside it is refused. |
| `schema/course.schema.json` | The model, as JSON Schema 2020-12. |
| `limits.json` | Outcome verbs, lesson types and their minutes, item types, and the pacing and accessibility limits. |
| `assurance/` | `python3 assurance/run.py`: a fixture course that must pass, edits of it that must fail, and every target built under every brand and checked (`js.test.mjs` in Node for the scripts, cmi5's XSD with lxml; it needs `node` on PATH, which `pip install nodejs-wheel-binaries` supplies, and the Python packages lxml and fonttools, which `agora` supplies from its locked environment); `node assurance/run.mjs --brand SLUG`: the web edition in Chromium. |

See `assurance/fixtures/pass/fermi-estimation/` for a course: two units, every lesson type (reading, video,
exercise, discussion) and every item type (multiple choice, multiple response, numeric, text match). `course.py`
docstring gives the source format.

Which target for which place: the **OLX export** for Open edX (the graded run; import it in Studio, Tools →
Import), the **cmi5 package** for any LMS that takes cmi5, and the **web edition** for anyone to read, its
practice graded in the browser. Open edX's look comes from the platform's brand package, not from this
design system.
