#!/usr/bin/env python3
"""frontiers-signage-print's assurance harness (spec FR-013): formats.json holds together; under every brand here,
every tone's text meets 4.5:1, every job in fixtures/pass/ passes signage.py check and (where reportlab and pypdf
are installed) renders to a one-page PDF of its trim plus bleed with only the sans embedded; every job in
fixtures/fail/ is refused for the reason fixtures/expected.json names; and the ontology registers this design system.

    python3 assurance/run.py

Needs the Python package Pillow; rendering also needs fonttools, reportlab and pypdf
(`pip install Pillow fonttools reportlab pypdf`).
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import signage  # noqa: E402

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"


class Result:
    def __init__(self) -> None:
        self.passed, self.failed = 0, []

    def check(self, ok: bool, what: str) -> None:
        if ok:
            self.passed += 1
        else:
            self.failed.append(what)


def pdf_facts(path: Path) -> tuple[int, tuple[float, float], list[tuple[str, bool]]]:
    """A PDF's page count, its first page's size in points, and each font it uses as (BaseFont, embedded), read with pypdf."""
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    page = reader.pages[0]
    fonts: list[tuple[str, bool]] = []
    for ref in (page["/Resources"].get("/Font") or {}).values():
        font = ref.get_object()
        base = str(font.get("/BaseFont", "")).lstrip("/")
        face = font["/DescendantFonts"][0].get_object() if "/DescendantFonts" in font else font
        desc = face.get("/FontDescriptor")
        fonts.append((base, font.get("/Subtype") == "/Type3" or (desc is not None and any(
            k in desc.get_object() for k in ("/FontFile", "/FontFile2", "/FontFile3")))))
    return len(reader.pages), (float(page.mediabox.width), float(page.mediabox.height)), fonts


def run_brand(brand: Path) -> Result:
    r = Result()
    tokens = signage._tokens(brand)
    for tone, roles in signage.TONES.items():
        bg = signage.color(roles["background"], tokens)
        for role in ("text", "kicker", "details"):
            c = signage.contrast(signage.color(roles[role], tokens), bg)
            r.check(c >= signage.DATA["min_contrast"], f"{tone}: {role} is {c:.2f}:1 under {brand.name} (FR-006)")
    tools = all(importlib.util.find_spec(m) for m in ("reportlab", "pypdf", "fontTools"))
    with tempfile.TemporaryDirectory() as tmp:
        for path in sorted((HERE / "fixtures" / "pass").glob("*.json")):
            job = json.loads(path.read_text(encoding="utf-8"))
            problems = signage.check(job, brand)
            r.check(not problems, f"pass/{path.name} under {brand.name}: {'; '.join(problems)}")
            if tools:
                out = Path(tmp) / f"{path.stem}.pdf"
                signage.render(job, brand, out)
                pages, size, fonts = pdf_facts(out)
                fmt = signage.FORMATS[job["format"]]
                want = [fmt["trim"][0] + 2 * fmt["bleed"], fmt["trim"][1] + 2 * fmt["bleed"]]
                r.check(all(abs(a - b) < 0.6 for a, b in zip(size, want)), f"pass/{path.name} is {list(size)}pt, not {want} (FR-004)")
                r.check(pages == 1, f"pass/{path.name} is not one page (FR-004)")
                names = {base.split("+")[-1].split("-")[0] for base, _ in fonts}
                r.check(names <= {"Inter"} and all(emb for _, emb in fonts), f"pass/{path.name} embeds {names} (FR-010)")
    covered = {json.loads(p.read_text(encoding="utf-8"))["format"] for p in (HERE / "fixtures" / "pass").glob("*.json")}
    r.check(covered == set(signage.FORMATS), f"fixtures/pass/ has no job for {sorted(set(signage.FORMATS) - covered)}")
    expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
    fails = sorted((HERE / "fixtures" / "fail").glob("*.json"))
    r.check({p.name for p in fails} == {k for k in expected if not k.startswith("$")}, "fixtures/expected.json and fixtures/fail/ name different jobs")
    for path in fails:
        problems = signage.check(json.loads(path.read_text(encoding="utf-8")), brand)
        want = expected.get(path.name, "")
        r.check(bool(want) and any(want in p for p in problems), f"fail/{path.name} under {brand.name} should be refused for {want!r}; it reported: {'; '.join(problems) or 'nothing'}")
    if not tools:
        print("     · reportlab, fonttools or pypdf is not installed; signs were checked, not rendered")
    return r


def check_data(r: Result) -> None:
    raw = (SYSTEM / "formats.json").read_text(encoding="utf-8")
    r.check(not re.findall(r"#[0-9a-fA-F]{3,8}\b", raw), "formats.json holds a color literal (0014-design-systems FR-044)")
    for slug, fmt in signage.FORMATS.items():
        r.check(fmt["bleed"] >= 8.5, f"formats.json: {slug}'s bleed is under 3mm (FR-004)")
        r.check(fmt["title_pt"][0] <= fmt["title_pt"][1] and fmt["details_pt"] >= signage.DATA["min_text_pt"], f"formats.json: {slug}'s type is inverted or too small (FR-008)")
    if ONTOLOGY.exists():
        ttl = ONTOLOGY.read_text(encoding="utf-8")
        block = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[^.]*?dcterms:identifier "frontiers-signage-print"[\s\S]*?\.\n', ttl, re.M)
        text = block.group(0) if block else ""
        r.check("ifcore:PrintDesignSystemKind" in text, "ifcore.ttl does not register frontiers-signage-print as a print design system (FR-001)")
        for t in ("Poster", "RollUpBanner", "EventBadge"):
            r.check(f"ifcore:{t}" in text, f"ifcore.ttl does not classify frontiers-signage-print by ifcore:{t} (FR-001)")


def main() -> int:
    data = Result()
    check_data(data)
    failed = bool(data.failed)
    print(f"{'ok  ' if not data.failed else 'FAIL'} frontiers-signage-print data  ({data.passed} passed{', ' + str(len(data.failed)) + ' failed' if data.failed else ''})")
    for f in data.failed:
        print(f"     ✗ {f}")
    for brand in sorted(p.parent for p in SYSTEM.parent.glob("*/brand.css")):
        r = run_brand(brand)
        print(f"{'ok  ' if not r.failed else 'FAIL'} frontiers-signage-print, themed by {brand.name}  ({r.passed} passed{', ' + str(len(r.failed)) + ' failed' if r.failed else ''})")
        for f in r.failed:
            print(f"     ✗ {f}")
        failed |= bool(r.failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
