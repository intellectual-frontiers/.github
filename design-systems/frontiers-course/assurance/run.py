#!/usr/bin/env python3
"""frontiers-course's assurance harness (spec FR-012, FR-018): every course in fixtures/pass/ reads into a model that
schema/course.schema.json accepts and passes course.py check; every edit in fixtures/fail/, applied to a copy of
the pass course, is refused for the reason fixtures/expected.json names; the ontology registers this design
system as FR-001 says; and, under every brand here, build.py's web edition, OLX tarball and cmi5 package are built
the same on every run and hold what FR-013 to FR-017 say, quiz.js and cmi5.js pass assurance/js.test.mjs (Node),
and cmi5.xml validates against cmi5's own schema (with lxml).

    python3 assurance/run.py

Standard library only; with frontiers-written-voice, frontiers-spoken-voice and frontiers-figures (and Pillow)
beside it, as in this repository, the voice and figure checks run too.
"""
from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import build  # noqa: E402
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
        for t in ("SelfPacedCourse", "InstructorPacedCourse", "MultipleChoiceItem", "MultipleResponseItem", "NumericResponseItem", "TextMatchItem", "StaticWebEdition", "OpenEdxOlxExport", "Cmi5Package"):
            check(f"ifcore:{t}" in text, f"ifcore.ttl does not classify frontiers-course by ifcore:{t} (FR-001)")
        check("ifcore:drawsFiguresWith ifcore:FrontiersFigures" in text, "ifcore.ttl does not name frontiers-figures for frontiers-course (FR-001)")
    targets(check)
    print(f"{'ok  ' if not failed else 'FAIL'} frontiers-course  ({passed} passed{', ' + str(len(failed)) + ' failed' if failed else ''})")
    for f in failed:
        print(f"     ✗ {f}")
    return 1 if failed else 0


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.lang, self.h1, self.imgs, self.refs, self.items, self.scripts = None, 0, [], [], 0, []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "h1":
            self.h1 += 1
        elif tag == "img":
            self.imgs.append(a)
        elif tag == "fieldset" and "item" in (a.get("class") or ""):
            self.items += 1
        elif tag == "script":
            self.scripts.append(a.get("src", ""))
        for k in ("href", "src"):
            if a.get(k):
                self.refs.append(a[k])


LITERAL = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(")
CMI5_XSD = HERE / "cmi5" / "CourseStructure.xsd"


def targets(check) -> None:
    """FR-013 to FR-017 under every brand here."""
    css = (SYSTEM / "web" / "course.css").read_text(encoding="utf-8")
    check(not LITERAL.search(css), "web/course.css holds a color literal (FR-014)")
    theme = build._theme()
    brands = sorted(p.parent for p in SYSTEM.parent.glob("*/brand.css"))
    m = course.model(BASE)
    n_items = sum(len(s["items"]) for u in m["units"] for s in u["steps"] if s["kind"] == "assessment")
    pages = [f"{u['slug']}/{s['slug']}.html" for u in m["units"] for s in u["steps"]]
    for brand in brands:
        b = brand.name
        tokens = theme.brand_tokens(brand)
        roles = {k: theme.resolve(v, tokens) for k, v in build.WEB["roles"].items()}
        for fg, bg in build.WEB["pairs"]:
            r = contrast(roles[fg], roles[bg])
            check(r >= build.WEB["min_contrast"], f"{b}: {fg} on {bg} is {r:.2f}:1 (FR-014)")
        check(not LITERAL.search(build.theme_css(brand)), f"{b}: theme.css holds a color literal (FR-014)")
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            build.web(BASE, tmp / "web", brand)
            site = tmp / "web"
            for rel in ["index.html", *pages]:
                pg = Page()
                pg.feed((site / rel).read_text(encoding="utf-8"))
                where = f"{b}: web/{rel}"
                check(pg.lang == m["language"], f"{where}: no lang (FR-014)")
                check(pg.h1 == 1, f"{where}: {pg.h1} h1 elements (FR-014)")
                check(all(i.get("alt") for i in pg.imgs), f"{where}: an image without alternative text (FR-014)")
                missing = [r for r in pg.refs if not r.startswith(("https://", "#")) and not ((site / rel).parent / r.split("#")[0]).resolve().is_file()]
                check(not missing, f"{where}: links to files the edition does not hold: {missing} (FR-014)")
                check(all(s and not s.startswith("http") for s in pg.scripts), f"{where}: a script from elsewhere (FR-014)")
            built = sum(_items(site / p) for p in pages)
            check(built == n_items, f"{b}: the web edition asks {built} items, the course {n_items} (FR-015)")
            check(not (site / "assets" / "cmi5.js").exists(), f"{b}: the web edition carries cmi5.js (FR-016)")
            olx = [tmp / f"olx{i}.tar.gz" for i in (1, 2)]
            for path in olx:
                build.olx(BASE, path, brand, "ExampleOrg")
            check(olx[0].read_bytes() == olx[1].read_bytes(), f"{b}: the OLX tarball differs between two builds (FR-013)")
            for problem in check_olx(olx[0], m):
                check(False, f"{b}: OLX: {problem} (FR-017)")
            zips = [tmp / f"c{i}.zip" for i in (1, 2)]
            for path in zips:
                build.cmi5(BASE, path, brand, "https://example.org/course/fermi")
            check(zips[0].read_bytes() == zips[1].read_bytes(), f"{b}: the cmi5 package differs between two builds (FR-013)")
            for problem in check_cmi5(zips[0], m):
                check(False, f"{b}: cmi5: {problem} (FR-016)")
    with tempfile.TemporaryDirectory() as tmp:
        bad = Path(tmp) / BASE.name
        shutil.copytree(BASE, bad)
        (bad / "course.md").write_text((bad / "course.md").read_text(encoding="utf-8").replace("O2: Justify", "O2: Understand"), encoding="utf-8")
        for target in ("web", "olx", "cmi5"):
            try:
                {"web": lambda: build.web(bad, Path(tmp) / "w", brands[0]),
                 "olx": lambda: build.olx(bad, Path(tmp) / "o.tar.gz", brands[0], "ExampleOrg"),
                 "cmi5": lambda: build.cmi5(bad, Path(tmp) / "c.zip", brands[0], "https://example.org/c")}[target]()
                check(False, f"build.py {target} builds a course that fails course.py check (FR-013)")
            except build.BuildError:
                check(True, "")
        try:
            build.cmi5(BASE, Path(tmp) / "c.zip", brands[0], "http://example.org/c")
            check(False, "build.py cmi5 takes an --iri that is not https (FR-016)")
        except build.BuildError:
            check(True, "")
    node = shutil.which("node")
    check(bool(node), "Node is not installed, so quiz.js and cmi5.js went untested (FR-018)")
    if node:
        out = subprocess.run([node, str(HERE / "js.test.mjs")], input=json.dumps(m), capture_output=True, text=True)
        try:
            res = json.loads(out.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            res = {"passed": 0, "failed": [f"js.test.mjs did not report: {out.stderr.strip()[-300:]}"]}
        check(res["passed"] > 0 and not res["failed"], f"js.test.mjs: {'; '.join(res['failed'])} (FR-015, FR-016)")


def _items(path: Path) -> int:
    pg = Page()
    pg.feed(path.read_text(encoding="utf-8"))
    return pg.items


def contrast(a: str, b: str) -> float:
    def lum(h: str) -> float:
        c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


PROBLEM = {"multiple-choice": "multiplechoiceresponse", "multiple-response": "choiceresponse", "numeric": "numericalresponse", "text-match": "stringresponse"}


def check_olx(path: Path, m: dict) -> list[str]:
    out = []
    with tarfile.open(path) as tar:
        files = {i.name: tar.extractfile(i).read() for i in tar.getmembers() if i.isfile()}
    if any(not n.startswith("course/") for n in files):
        out.append("a file outside course/")
    xml = {}
    for name, data in files.items():
        if name.endswith(".xml"):
            try:
                xml[name] = ET.fromstring(data)
            except ET.ParseError as e:
                out.append(f"{name} is not XML: {e}")
    root = xml.get("course/course.xml")
    if root is None or root.get("url_name") != m["run"] or root.get("course") != m["code"] or root.get("org") != "ExampleOrg":
        return out + ["course.xml does not name the run, code and org"]
    seen = {"problem": 0, "html": 0, "video": 0, "discussion": 0}

    def walk(kind: str, name: str) -> None:
        el = xml.get(f"course/{kind}/{name}.xml")
        if el is None:
            out.append(f"{kind}/{name}.xml is named but missing")
            return
        if kind in seen:
            seen[kind] += 1
        if kind == "html" and f"course/html/{el.get('filename')}.html" not in files:
            out.append(f"html/{name} names a file that is missing")
        if kind == "html":
            for ref in re.findall(r'(?:src|href)="/static/([^"]+)"', files[f"course/html/{el.get('filename')}.html"].decode()):
                if f"course/static/{ref}" not in files:
                    out.append(f"html/{name} uses /static/{ref}, which is missing")
        if kind == "video":
            t = el.find("transcript")
            if t is None or f"course/static/{t.get('src')}" not in files:
                out.append(f"video/{name} has no transcript in static/")
        for child in el:
            if child.get("url_name"):
                walk(child.tag, child.get("url_name"))
    walk("course", m["run"])
    graded = [e for n, e in xml.items() if n.startswith("course/sequential/") and e.get("graded") == "true"]
    want_graded = sum(s["kind"] == "assessment" and s["graded"] for u in m["units"] for s in u["steps"])
    if len(graded) != want_graded or any(e.get("format") != "Assessment" for e in graded):
        out.append(f"{len(graded)} graded subsections; the course grades {want_graded}")
    policy = json.loads(files.get(f"course/policies/{m['run']}/grading_policy.json", b"{}"))
    if not policy.get("GRADER") or policy["GRADER"][0]["min_count"] != want_graded:
        out.append("the grading policy does not count the graded assessments")
    items = [i for u in m["units"] for s in u["steps"] if s["kind"] == "assessment" for i in s["items"]]
    if seen["problem"] != len(items):
        out.append(f"{seen['problem']} problems; the course has {len(items)} items")
    for it in items:
        el = next((e for n, e in xml.items() if n.startswith("course/problem/") and n.endswith(f"-{it['id']}.xml")), None)
        if el is None or el.find(PROBLEM[it["type"]]) is None:
            out.append(f"item {it['id']} is not a {PROBLEM[it['type']]} problem")
    lessons = [s for u in m["units"] for s in u["steps"] if s["kind"] == "lesson"]
    if seen["video"] != sum(s["type"] == "video" for s in lessons) or seen["discussion"] != sum(s["type"] == "discussion" for s in lessons):
        out.append("a video or discussion lesson has no component")
    return out


def check_cmi5(path: Path, m: dict) -> list[str]:
    out = []
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        if "cmi5.xml" not in names:
            return ["no cmi5.xml at the package's root"]
        data = z.read("cmi5.xml")
        pages = {n: z.read(n).decode() for n in names if n.endswith(".html")}
    ns = {"c": "https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd"}
    root = ET.fromstring(data)
    aus = root.findall(".//c:au", ns)
    steps = [s for u in m["units"] for s in u["steps"]]
    if len(aus) != len(steps):
        out.append(f"{len(aus)} assignable units; the course has {len(steps)} lessons and assessments")
    ids = [e.get("id") for e in root.iter() if e.get("id")]
    if len(ids) != len(set(ids)) or not all(i.startswith("https://example.org/course/fermi") for i in ids):
        out.append("an id is repeated or not under --iri")
    objectives = {o.get("id") for o in root.findall("c:objectives/c:objective", ns)}
    for au in aus:
        url = au.find("c:url", ns).text
        if url not in pages:
            out.append(f"{url} is in cmi5.xml but not the package")
        elif "assets/cmi5.js" not in pages[url]:
            out.append(f"{url} does not load cmi5.js")
        refs = {o.get("idref") for o in au.findall("c:objectives/c:objective", ns)}
        if not refs or not refs <= objectives:
            out.append(f"{au.get('id')} names no outcome, or one the course does not state")
    graded = [a for a in aus if a.get("moveOn") == "Passed"]
    if len(graded) != sum(s["kind"] == "assessment" and s["graded"] for s in steps) or any(a.get("masteryScore") is None for a in graded):
        out.append("a graded assessment does not move on by passing at a mastery score")
    try:
        from lxml import etree
    except ImportError:
        return out
    schema = etree.XMLSchema(etree.parse(str(CMI5_XSD)))
    if not schema.validate(etree.fromstring(data)):
        out.append(f"cmi5.xml breaks cmi5's schema: {schema.error_log.last_error}")
    return out


if __name__ == "__main__":
    sys.exit(main())
