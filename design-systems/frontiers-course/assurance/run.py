#!/usr/bin/env python3
"""frontiers-course's assurance harness (spec FR-012): every course in fixtures/pass/ reads into a model that
schema/course.schema.json accepts and passes course.py check; every edit in fixtures/fail/, applied to a copy of
the pass course, is refused for the reason fixtures/expected.json names; and the ontology registers this design
system as FR-001 says.

    python3 assurance/run.py

Standard library only; with frontiers-written-voice, frontiers-spoken-voice and frontiers-figures (and Pillow)
beside it, as in this repository, the voice and figure checks run too.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import course  # noqa: E402

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"
PASS = HERE / "fixtures" / "pass"
BASE = PASS / "fermi-estimation"


def main() -> int:
    passed, failed = 0, []

    def check(ok: bool, what: str) -> None:
        nonlocal passed
        if ok:
            passed += 1
        else:
            failed.append(what)

    for raw in (SYSTEM / "limits.json", SYSTEM / "schema" / "course.schema.json"):
        check(not re.findall(r"#[0-9a-fA-F]{3,8}\b", raw.read_text(encoding="utf-8")), f"{raw.name} holds a color literal (0014-design-systems FR-044)")
    check(set(course.LIMITS["lesson_types"]) == set(course.SCHEMA["$defs"]["lesson"]["properties"]["type"]["enum"]),
          "limits.json and the schema name different lesson types (FR-004)")
    check(course.LIMITS["item_types"] == course.SCHEMA["$defs"]["item"]["properties"]["type"]["enum"],
          "limits.json and the schema name different item types (FR-004)")
    check(course.LIMITS["formats"] == course.SCHEMA["properties"]["format"]["enum"], "limits.json and the schema name different formats (FR-004)")
    for src in sorted(p for p in PASS.iterdir() if p.is_dir()):
        m = course.model(src)
        check(not course.validate(m, course.SCHEMA), f"pass/{src.name}: its model breaks the schema: {course.validate(m, course.SCHEMA)} (FR-004)")
        check(json.dumps(m) == json.dumps(course.model(src)), f"pass/{src.name}: model is not deterministic (FR-004)")
        problems = course.check(src)
        check(not problems, f"pass/{src.name}: {'; '.join(problems)}")
        types = {s["type"] for u in m["units"] for s in u["steps"] if s["kind"] == "lesson"}
        items = {i["type"] for u in m["units"] for s in u["steps"] if s["kind"] == "assessment" for i in s["items"]}
        check(types == set(course.LIMITS["lesson_types"]), f"pass/{src.name}: does not use every lesson type (FR-012)")
        check(items == set(course.LIMITS["item_types"]), f"pass/{src.name}: does not use every item type (FR-012)")
    bad = course.validate({"id": "X", "units": [{"slug": "1", "steps": [{"kind": "quiz"}]}]}, course.SCHEMA)
    check(any("$.id" in b for b in bad) and any("$.units[0]" in b for b in bad) and any("has no title" in b for b in bad),
          f"the schema validator misses departures it should report: {bad} (FR-004)")
    expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
    fails = sorted((HERE / "fixtures" / "fail").glob("*.json"))
    check({p.name for p in fails} == {k for k in expected if not k.startswith("$")}, "fixtures/expected.json and fixtures/fail/ name different courses")
    for path in fails:
        patch = json.loads(path.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            dst = Path(tmp) / BASE.name
            shutil.copytree(BASE, dst)
            applied = True
            for file, old, new in patch.get("edits", []):
                text = (dst / file).read_text(encoding="utf-8")
                applied &= old in text
                (dst / file).write_text(text.replace(old, new, 1), encoding="utf-8")
            for file in patch.get("delete", []):
                applied &= (dst / file).is_file()
                (dst / file).unlink(missing_ok=True)
            check(applied, f"fail/{path.name} edits text the pass course does not have")
            problems = course.check(dst)
        want = expected.get(path.name, "")
        check(bool(want) and any(want.lower() in p.lower() for p in problems),
              f"fail/{path.name} should be refused for {want!r}; it reported: {'; '.join(problems) or 'nothing'}")
    if ONTOLOGY.exists():
        ttl = ONTOLOGY.read_text(encoding="utf-8")
        block = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[^.]*?dcterms:identifier "frontiers-course"[\s\S]*?\.\n', ttl, re.M)
        text = block.group(0) if block else ""
        check("ifcore:CourseDesignSystemKind" in text, "ifcore.ttl does not register frontiers-course as a course design system (FR-001)")
        for t in ("SelfPacedCourse", "InstructorPacedCourse", "MultipleChoiceItem", "MultipleResponseItem", "NumericResponseItem", "TextMatchItem"):
            check(f"ifcore:{t}" in text, f"ifcore.ttl does not classify frontiers-course by ifcore:{t} (FR-001)")
        check("ifcore:drawsFiguresWith ifcore:FrontiersFigures" in text, "ifcore.ttl does not name frontiers-figures for frontiers-course (FR-001)")
    print(f"{'ok  ' if not failed else 'FAIL'} frontiers-course  ({passed} passed{', ' + str(len(failed)) + ' failed' if failed else ''})")
    for f in failed:
        print(f"     ✗ {f}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
