#!/usr/bin/env python3
"""Read and check a course (frontiers-course spec FR-003 to FR-011).

    python3 course.py model COURSE_DIR [-o MODEL.json]
    python3 course.py check COURSE_DIR [...]

A course is a directory named for its id, written in AsciiDoc (the subset adoc.py reads):

    COURSE_DIR/
      course.adoc               = Title, then :code:, :run:, :lang:, :format:, :hours-per-week: and, when it has
                                one, :derived-from: (the IRI of the work it comes from); its summary; then
                                `== Outcomes` as a description list, `O1:: Estimate ...`
      units/01-first-unit/
        unit.adoc               = Title, :week:; the unit's overview
        01-a-reading.adoc       a lesson: = Title, :type:, :minutes:, :outcomes: (and for a video :video: and
                                :captions:); its body, and a video's body is its transcript
        02-check.adoc           an assessment: = Title, :kind: assessment, :minutes:, :graded:; its items
        01-a-video.vtt          a video's captions
        figures/                the unit's figures, drawn with frontiers-figures

An assessment item is a section whose attributes give its id, type and the outcomes it assesses; its paragraphs
are its prompt, its checklist its choices, each choice's nested point its feedback:

    [#piano-tuners,type=multiple-choice,assesses=O1]
    == Piano tuners in a city of a million

    About how many piano tuners work in a city of a million people?

    * [ ] About 5
    ** Too few: one tuner can serve about a thousand pianos a year.
    * [x] About 50
    ** Right: ...

A `numeric` item gives `answer=` and `tolerance=` (a number or a percentage), a `text-match` item
`answers="a, b"`; both give their feedback as a paragraph with the role `[.feedback]`. `model` prints the course as
schema/course.schema.json describes it, the form every delivery target is built from; `check` reports every rule a
course breaks. Standard library only; uses the house voice, and frontiers-figures' figcheck (with Pillow), when
they are beside this design system.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEMS = HERE.parent
sys.path.insert(0, str(HERE))
import adoc  # noqa: E402

LIMITS = json.loads((HERE / "limits.json").read_text(encoding="utf-8"))
SCHEMA = json.loads((HERE / "schema" / "course.schema.json").read_text(encoding="utf-8"))


class SourceError(ValueError):
    """A source that cannot be read into a model at all."""


# ── reading ──────────────────────────────────────────────────────────────────────────────────────────────────────


def read(path: Path, where: str) -> tuple[str, dict, str]:
    try:
        title, attrs, body = adoc.header(path.read_text(encoding="utf-8"))
    except ValueError as e:
        raise SourceError(f"{where}: {e} (FR-003)") from None
    if bad := adoc.unsupported(body):
        raise SourceError(f"{where}: {', '.join(bad)}, which this design system does not render (FR-003)")
    return title, attrs, body


def _list(v: str) -> list[str]:
    return [x.strip() for x in v.split(",") if x.strip()]


def _int(v: str | None, where: str, key: str) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        raise SourceError(f"{where}: :{key}: is not a whole number: {v!r} (FR-003)") from None


ITEM_KEYS = {"id", "role", "positional", "type", "assesses", "answer", "tolerance", "answers"}


def parse_items(body: str, where: str) -> list[dict]:
    """An assessment's items, one a level-2 section."""
    items: list[dict] = []
    for b in adoc.blocks(body):
        if b["kind"] == "section" and b["level"] == 2:
            a = b["attrs"]
            if extra := set(a) - ITEM_KEYS:
                raise SourceError(f"{where}: item {a.get('id') or b['text']!r} has attributes this design system does not read: {', '.join(sorted(extra))} (FR-007)")
            item: dict = {"id": a.get("id", ""), "title": b["text"], "type": a.get("type", ""), "assesses": _list(a.get("assesses", "")), "prompt": ""}
            if "answer" in a:
                try:
                    item["answer"] = float(a["answer"].replace(",", ""))
                except ValueError:
                    raise SourceError(f"{where}: item {item['id'] or item['title']!r} has an answer that is not a number (FR-007)") from None
            if "tolerance" in a:
                item["tolerance"] = a["tolerance"]
            if "answers" in a:
                item["answers"] = _list(a["answers"])
            items.append(item)
        elif not items:
            continue
        elif b["kind"] == "para" and b["attrs"].get("role") == "feedback":
            items[-1]["feedback"] = (items[-1].get("feedback", "") + " " + b["text"]).strip()
        elif b["kind"] == "para":
            items[-1]["prompt"] = (items[-1]["prompt"] + "\n\n" + b["text"]).strip()
        elif b["kind"] == "checklist":
            items[-1]["choices"] = [{"text": it["text"], "correct": bool(it["checked"]), "feedback": " ".join(it["sub"])} for it in b["items"]]
        else:
            raise SourceError(f"{where}: item {items[-1]['id']!r} holds a {b['kind']}; an item holds its prompt, its choices and its feedback (FR-007)")
    return items


def model(src: Path) -> dict:
    """The course in `src`, as schema/course.schema.json describes it."""
    title, meta, body = read(src / "course.adoc", "course.adoc")
    summary, _, rest = body.partition("== Outcomes")
    outcomes = [{"id": m.group(1), "text": m.group(2).strip()} for m in re.finditer(r"(?m)^(O\d+):: (.+)$", rest)]
    course = {
        "id": src.name, "title": title, "code": meta.get("code", ""), "run": meta.get("run", ""),
        "language": meta.get("lang", ""), "format": meta.get("format", ""),
        "hours_per_week": float(meta.get("hours-per-week") or 0), "summary": summary.strip(), "outcomes": outcomes,
        "units": [],
    }
    if meta.get("derived-from"):
        course["derived_from"] = meta["derived-from"]
    for udir in sorted(p for p in (src / "units").iterdir() if p.is_dir()) if (src / "units").is_dir() else []:
        where = f"units/{udir.name}"
        utitle, umeta, overview = read(udir / "unit.adoc", f"{where}/unit.adoc")
        unit = {"slug": udir.name, "title": utitle, "week": _int(umeta.get("week"), where, "week"), "overview": overview, "steps": []}
        for path in sorted(p for p in udir.glob("*.adoc") if p.name != "unit.adoc"):
            pwhere = f"{where}/{path.name}"
            stitle, m, b = read(path, pwhere)
            minutes = _int(m.get("minutes"), pwhere, "minutes")
            if m.get("kind") == "assessment":
                unit["steps"].append({"slug": path.stem, "kind": "assessment", "title": stitle, "minutes": minutes,
                                      "graded": m.get("graded", "false").lower() == "true", "items": parse_items(b, pwhere)})
                continue
            lesson = {"slug": path.stem, "kind": "lesson", "type": m.get("type", ""), "title": stitle,
                      "minutes": minutes, "outcomes": _list(m.get("outcomes", "")), "body": b}
            for k in ("video", "captions"):
                if m.get(k):
                    lesson[k] = m[k]
            unit["steps"].append(lesson)
        course["units"].append(unit)
    return course


# ── the schema ───────────────────────────────────────────────────────────────────────────────────────────────────

_TYPES = {"object": dict, "array": list, "string": str, "integer": int, "number": (int, float), "boolean": bool}


def validate(value, schema: dict, path: str = "$", root: dict | None = None) -> list[str]:
    """`value`'s departures from `schema`: the part of JSON Schema 2020-12 schema/course.schema.json uses."""
    root = root or schema
    if "$ref" in schema:
        node = root
        for part in schema["$ref"].removeprefix("#/").split("/"):
            node = node[part]
        return validate(value, node, path, root)
    if "anyOf" in schema:
        tries = [validate(value, s, path, root) for s in schema["anyOf"]]
        return [] if any(not t for t in tries) else min(tries, key=len)
    errs = []
    t = schema.get("type")
    if t and (not isinstance(value, _TYPES[t]) or (t in ("integer", "number") and isinstance(value, bool))):
        return [f"{path} is not {'an' if t[0] in 'aeio' else 'a'} {t}"]
    if "const" in schema and value != schema["const"]:
        errs.append(f"{path} is not {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errs.append(f"{path} is {value!r}, not one of {', '.join(map(str, schema['enum']))}")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errs.append(f"{path} is empty")
        if len(value) > schema.get("maxLength", 1 << 30):
            errs.append(f"{path} is over {schema['maxLength']} characters")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errs.append(f"{path} is {value!r}, which does not match {schema['pattern']}")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value < schema.get("minimum", float("-inf")) or value > schema.get("maximum", float("inf")):
            errs.append(f"{path} is {value}, outside {schema.get('minimum')} to {schema.get('maximum')}")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errs.append(f"{path} has {len(value)} entries, fewer than {schema['minItems']}")
        for i, v in enumerate(value):
            if "items" in schema:
                errs += validate(v, schema["items"], f"{path}[{i}]", root)
    if isinstance(value, dict):
        for k in schema.get("required", []):
            if k not in value:
                errs.append(f"{path} has no {k}")
        props = schema.get("properties", {})
        for k, v in value.items():
            if k in props:
                errs += validate(v, props[k], f"{path}.{k}", root)
            elif schema.get("additionalProperties") is False:
                errs.append(f"{path} has {k}, which the schema does not allow")
    return errs


# ── checking ─────────────────────────────────────────────────────────────────────────────────────────────────────


def _load(name: str, path: Path):
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def words(body: str) -> int:
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’.,%-]*", adoc.text_of(body)))


def vtt_end(text: str) -> float | None:
    """The end of a WebVTT file's last cue, in seconds; None if it is not WebVTT."""
    if not text.lstrip("﻿").startswith("WEBVTT"):
        return None
    ends = re.findall(r"-->\s*(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})", text)
    if not ends:
        return None
    h, m, s, ms = ends[-1]
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def _near(declared: float, estimate: float) -> bool:
    return abs(declared - estimate) <= max(LIMITS["minutes_slack"], LIMITS["minutes_tolerance"] * estimate)


def accessibility(body: str, where: str, base: Path) -> list[str]:
    """FR-009 over a lesson's AsciiDoc body."""
    problems = []
    for src, alt in adoc.images(body):
        if len(alt.split()) < 3 or re.search(r"\.(svg|png|jpe?g|gif|webp)$", alt, re.I):
            problems.append(f"{where}: the image {src} has no alternative text describing it (FR-009)")
        if not src.startswith("https://") and not (base / src).is_file():
            problems.append(f"{where}: the image {src} is not in the course (FR-003)")
    level = 1
    for b in adoc.blocks(body):
        if b["kind"] == "para" and b["text"].startswith("= "):
            problems.append(f"{where}: a level-one heading in a lesson's body; its title is its heading (FR-009)")
        if b["kind"] != "section":
            continue
        if b["level"] > level + 1:
            problems.append(f"{where}: a level-{b['level']} heading after level {level}; headings go down one level at a time (FR-009)")
        level = b["level"]
    for target, text in adoc.links(body):
        if text.strip().lower().rstrip(".") in LIMITS["generic_link_text"]:
            problems.append(f"{where}: a link reading {text!r}; a link says where it goes (FR-009)")
    for pattern in LIMITS["sensory_only"]:
        if m := re.search(pattern, adoc.text_of(body), re.I):
            problems.append(f"{where}: {m.group(0)!r} points by color or position alone (FR-009)")
    return problems


def check(src: Path) -> list[str]:
    """Every rule the course in `src` breaks, naming its requirement."""
    try:
        course = model(src)
    except (OSError, SourceError) as e:
        return [str(e) if isinstance(e, SourceError) else f"cannot be read: {e} (FR-003)"]
    problems = [f"{e} (FR-004)" for e in validate(course, SCHEMA)]
    if problems:
        return problems
    lo, hi = LIMITS["outcomes"]
    outs = {o["id"]: o["text"] for o in course["outcomes"]}
    if not lo <= len(outs) <= hi:
        problems.append(f"{len(outs)} outcomes; a course states {lo} to {hi} (FR-005)")
    for oid, text in outs.items():
        low = text.lower()
        verb = low.split()[0]
        if verb not in LIMITS["verbs"]:
            problems.append(f"{oid} begins with {verb!r}, not an observable verb from limits.json (FR-005)")
        for vague in LIMITS["vague_verbs"]:
            if re.search(rf"\b{vague}\b", low):
                problems.append(f"{oid} names a state of mind no one can observe: {vague!r} (FR-005)")
        if text.count(". ") or not text.endswith("."):
            problems.append(f"{oid} is not one sentence ending in a full stop (FR-005)")
    taught, assessed, ids = set(), set(), set()
    weeks: dict[int, int] = {}
    written = _load("written_voice_sweep", SYSTEMS / "frontiers-written-voice" / "sweep.py")
    spoken = _load("spoken_voice_sweep", SYSTEMS / "frontiers-spoken-voice" / "sweep.py")
    figcheck = None
    try:
        figcheck = _load("figcheck", SYSTEMS / "frontiers-figures" / "figcheck.py")
    except ImportError:
        figcheck = None
    prose = [adoc.text_of(course["summary"]), *outs.values()]
    last_week = 0
    for unit in course["units"]:
        uw = f"units/{unit['slug']}"
        udir = src / "units" / unit["slug"]
        if unit["week"] < last_week or unit["week"] > last_week + 1:
            problems.append(f"{uw}: week {unit['week']} after week {last_week}; weeks run 1, 2, 3 in order (FR-008)")
        last_week = max(last_week, unit["week"])
        steps = unit["steps"]
        lessons = [s for s in steps if s["kind"] == "lesson"]
        a, b = LIMITS["lessons_per_unit"]
        if not a <= len(lessons) <= b:
            problems.append(f"{uw}: {len(lessons)} lessons; a unit has {a} to {b} (FR-006)")
        if steps[-1]["kind"] != "assessment":
            problems.append(f"{uw}: does not end with an assessment (FR-006)")
        prose += [adoc.text_of(unit["overview"])]
        for s in steps:
            where = f"{uw}/{s['slug']}.adoc"
            weeks[unit["week"]] = weeks.get(unit["week"], 0) + s["minutes"]
            if s["kind"] == "lesson":
                kind = LIMITS["lesson_types"][s["type"]]
                for o in s["outcomes"]:
                    if o not in outs:
                        problems.append(f"{where}: teaches {o}, which the course does not state (FR-006)")
                    taught.add(o)
                if s["minutes"] > kind["max_minutes"]:
                    problems.append(f"{where}: {s['minutes']} minutes; a {s['type']} lesson takes at most {kind['max_minutes']} (FR-008)")
                if "wpm" in kind:
                    est = words(s["body"]) / kind["wpm"]
                    if not _near(s["minutes"], est):
                        problems.append(f"{where}: says {s['minutes']} minutes, but its {words(s['body'])} words take about {est:.0f} (FR-008)")
                if s["type"] == "video":
                    if "video" not in s or "captions" not in s:
                        problems.append(f"{where}: a video lesson without its video and captions (FR-009)")
                    else:
                        cap = udir / s["captions"]
                        end = vtt_end(cap.read_text(encoding="utf-8")) if cap.is_file() else None
                        if end is None:
                            problems.append(f"{where}: its captions {s['captions']} are missing or not WebVTT (FR-009)")
                        elif not _near(s["minutes"], end / 60):
                            problems.append(f"{where}: says {s['minutes']} minutes, but its captions run {end / 60:.1f} (FR-008)")
                    if spoken:
                        fails, _ = spoken.sweep(adoc.text_of(s["body"]))
                        problems += [f"{where}: {f} (FR-010)" for f in fails]
                else:
                    if "video" in s or "captions" in s:
                        problems.append(f"{where}: a {s['type']} lesson names a video; make it a video lesson (FR-003)")
                    prose.append(adoc.text_of(s["body"]))
                problems += accessibility(s["body"], where, udir)
                if figcheck:
                    for ref in [src for src, _ in adoc.images(s["body"]) if src.endswith(".svg")]:
                        if (udir / ref).is_file():
                            problems += [f"{where}: {ref}: {p} (FR-011)" for p in figcheck.check(str(udir / ref))]
            else:
                for item in s["items"]:
                    iw = f"{where}, item {item['id']}"
                    if item["id"] in ids:
                        problems.append(f"{iw}: an id another item has; ids are unique in a course (FR-007)")
                    ids.add(item["id"])
                    for o in item["assesses"]:
                        if o not in outs:
                            problems.append(f"{iw}: assesses {o}, which the course does not state (FR-006)")
                        assessed.add(o)
                    problems += [f"{iw}: {p} (FR-007)" for p in item_problems(item)]
                    prose += [adoc.plain(item["prompt"])] + [adoc.plain(c["text"]) + ". " + adoc.plain(c["feedback"]) for c in item.get("choices", [])]
                    prose += [item.get("feedback", "")]
    for o in outs:
        if o not in taught:
            problems.append(f"{o} is taught by no lesson (FR-006)")
        if o not in assessed:
            problems.append(f"{o} is assessed by no item (FR-006)")
    if not any(s["kind"] == "assessment" and s["graded"] for u in course["units"] for s in u["steps"]):
        problems.append("no graded assessment; a course grades at least one (FR-006)")
    lo, hi = LIMITS["week_effort"]
    budget = course["hours_per_week"] * 60
    for w, minutes in sorted(weeks.items()):
        if not lo * budget <= minutes <= hi * budget:
            problems.append(f"week {w} asks {minutes} minutes; at {course['hours_per_week']:g} hours a week it asks {lo * budget:.0f} to {hi * budget:.0f} (FR-008)")
    if written:
        patterns = written.load([SYSTEMS / "frontiers-written-voice" / "patterns.json"])
        terms = written.load_terms([SYSTEMS / "frontiers-written-voice" / "terms.json"])
        fails, _ = written.sweep("\n\n".join(prose), patterns, terms=terms)
        problems += [f"{f} (FR-010)" for f in fails]
    return problems


def item_problems(item: dict) -> list[str]:
    """FR-007: what an item needs for its type."""
    t, choices = item["type"], item.get("choices", [])
    out = []
    if t in ("multiple-choice", "multiple-response"):
        a, b = LIMITS["choices"]
        right = sum(c["correct"] for c in choices)
        if not a <= len(choices) <= b:
            out.append(f"{len(choices)} choices; a {t} item offers {a} to {b}")
        if t == "multiple-choice" and right != 1:
            out.append(f"{right} correct choices; a multiple-choice item has exactly one")
        if t == "multiple-response" and not 1 <= right < len(choices):
            out.append("a multiple-response item needs at least one correct and one incorrect choice")
        if any(not c["feedback"] for c in choices):
            out.append("a choice without feedback saying why it is right or wrong")
        if any(k in item for k in ("answer", "answers", "tolerance")):
            out.append(f"a {t} item gives an answer key; its choices are its key")
    else:
        if choices:
            out.append(f"a {t} item offers choices")
        if t == "numeric" and "answer" not in item:
            out.append("a numeric item without an answer")
        if t == "text-match" and not item.get("answers"):
            out.append("a text-match item without answers")
        if not item.get("feedback"):
            out.append(f"a {t} item without feedback")
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("model")
    m.add_argument("course", type=Path)
    m.add_argument("-o", "--out", type=Path)
    c = sub.add_parser("check")
    c.add_argument("courses", type=Path, nargs="+")
    args = ap.parse_args(argv)
    if args.cmd == "model":
        text = json.dumps(model(args.course), indent=2, ensure_ascii=False) + "\n"
        if args.out:
            args.out.write_text(text, encoding="utf-8")
        else:
            sys.stdout.write(text)
        return 0
    bad = 0
    for path in args.courses:
        problems = check(path)
        print(f"{'ok  ' if not problems else 'FAIL'} {path}")
        for p in problems:
            print(f"     ✗ {p}")
        bad += bool(problems)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
