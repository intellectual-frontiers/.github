#!/usr/bin/env python3
"""The assurance harness for frontiers-print (0014-design-systems FR-015, FR-031, FR-039).

    python3 assurance/run.py                     every brand vendored beside this design system
    python3 assurance/run.py --brand SLUG        one brand
    python3 assurance/run.py --keep DIR          keep each build (PDFs and logs) in DIR

For each brand, it compiles every fixture (fixtures/book.tex on XeLaTeX, fixtures/article.tex on LuaLaTeX, in the
default layout) with that brand as the theme, and checks:

  - the build succeeds (a theme whose font-serif or font-sans this design system does not ship stops it);
  - each page is the size the design sets (7 x 9.19 in for a book, US Letter for an article);
  - every font in the PDF is embedded and is one this design system ships (fonts/);
  - each theme color the style files use reached the build as the brand's value (brand.tex);
  - the brand's lockups and icon are placed in the book;
  - the PDF's text layer maps every glyph to its Unicode character: no private-use code point, and the sans sample
    line extracts as set;
  - no style file holds a color literal: every color is a role or a mix of roles (0014-design-systems FR-044).

Needs Python 3 with the packages pypdf and pypdfium2 (`pip install pypdf pypdfium2`; they read the PDF: its page size,
fonts, images and text layer), and XeLaTeX and LuaLaTeX on PATH (any TeX Live 2025 or later; the harness runs each engine
again itself until the cross-references settle, so it needs no latexmk and no Perl). In this repository `agora` supplies
the packages from its locked environment and TeX from its own toolchain cache. Exits non-zero on any failure. This file is
the harness and its documentation.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM / "latex"))
import layout  # noqa: E402  (this design system's own layout resolver)

# Fixture -> engine, page size in points, and which theme role or mix of roles each style-file color must carry.
# A role mix is written as xcolor writes it: "text!72!surface" is 72% text, 28% surface.
FIXTURES = {
    "book": ("xelatex", (504.0, 661.68), {
        "ifink": "text", "ifaccent": "accent", "iflink": "link", "ifsubtitle": "tertiary", "ifseries": "primary",
        "ifnote": "info", "iftip": "success", "ifimportant": "warning", "ifwarning": "danger",
        "ifgray": "text!72!surface", "iflabel": "text!50!surface", "ifrule": "text!15!surface", "iftint": "text!4!surface"}),
    "article": ("lualatex", (612.0, 792.0), {
        "ifink": "text", "ifgray": "text!70!surface", "ifrule": "text!22!surface", "iftint": "text!4!surface"}),
}


MAX_PASSES = 4
RERUN = re.compile(r"Rerun to get|Label\(s\) may have changed|Please rerun|rerun LaTeX")


class Result:
    def __init__(self) -> None:
        self.passed, self.failed = 0, []

    def check(self, ok: bool, what: str) -> None:
        if ok:
            self.passed += 1
        else:
            self.failed.append(what)


def pdf_facts(pdf: Path) -> tuple[tuple[float, float], list[tuple[str, bool]], int, str]:
    """The first page's size in points, each font as (BaseFont, embedded), how many images the pages place, and the
    text layer, read with pypdf and pypdfium2."""
    import pypdfium2
    from pypdf import PdfReader

    reader = PdfReader(str(pdf))
    fonts: dict[object, tuple[str, bool]] = {}
    images = 0

    def walk(resources, seen: set) -> None:
        nonlocal images
        for key, ref in (resources.get("/Font") or {}).items():
            font = ref.get_object()
            face = font["/DescendantFonts"][0].get_object() if "/DescendantFonts" in font else font
            desc = face.get("/FontDescriptor")
            embedded = font.get("/Subtype") == "/Type3" or (desc is not None and any(
                k in desc.get_object() for k in ("/FontFile", "/FontFile2", "/FontFile3")))
            fonts[getattr(ref, "idnum", id(font))] = (str(font.get("/BaseFont", "")).lstrip("/"), embedded)
        for ref in (resources.get("/XObject") or {}).values():
            xobj = ref.get_object()
            if xobj.get("/Subtype") == "/Image":
                images += 1
            elif xobj.get("/Subtype") == "/Form" and getattr(ref, "idnum", None) not in seen:
                seen.add(getattr(ref, "idnum", None))
                if xobj.get("/Resources") is not None:
                    walk(xobj["/Resources"].get_object(), seen)

    for page in reader.pages:
        if page.get("/Resources") is not None:
            walk(page["/Resources"].get_object(), set())
    first = reader.pages[0].mediabox
    doc = pypdfium2.PdfDocument(str(pdf))
    try:
        text = "\n".join(p.get_textpage().get_text_range() for p in doc)
    finally:
        doc.close()
    return (float(first.width), float(first.height)), list(fonts.values()), images, text


def brand_values(brand: Path) -> dict[str, str]:
    tex = (brand / "brand.tex").read_text(encoding="utf-8")
    return {r: v.upper() for r, v in re.findall(r"\\definecolor\{brand-([\w-]+)\}\{HTML\}\{([0-9A-Fa-f]{6})\}", tex)}


def shipped_fonts() -> set[str]:
    return {f.stem for f in (SYSTEM / "fonts").iterdir() if f.suffix in (".ttf", ".otf")}


def build(name: str, brand: Path, work: Path) -> subprocess.CompletedProcess:
    engine = FIXTURES[name][0]
    work.mkdir(parents=True, exist_ok=True)
    (work / "main.tex").write_text(
        f"\\def\\printdir{{{SYSTEM}}}\\def\\iffontdir{{{SYSTEM / 'fonts'}/}}\\def\\branddir{{{brand}}}\n"
        f"\\input{{{HERE / 'fixtures' / (name + '.tex')}}}\n", encoding="utf-8")
    if name == "article":
        (work / "iflayout.def").write_text(layout.emit(layout.resolve("")), encoding="utf-8")
        shutil.copy(SYSTEM / "latex" / "ifarticle.cls", work / "ifarticle.cls")
    return typeset(engine, work)


def typeset(engine: str, work: Path) -> subprocess.CompletedProcess:
    """Run the engine on main.tex again, up to MAX_PASSES times, until its log no longer asks for another run."""
    for _ in range(MAX_PASSES):
        proc = subprocess.run([engine, "-interaction=nonstopmode", "-halt-on-error", "main.tex"], cwd=work, capture_output=True, text=True)
        log = work / "main.log"
        if proc.returncode != 0 or not log.is_file() or not RERUN.search(log.read_text(encoding="utf-8", errors="replace")):
            break
    return proc


def run(brand: Path, keep: Path | None) -> Result:
    r = Result()
    values = brand_values(brand)
    shipped = shipped_fonts()
    families = {s.split("-")[0] for s in shipped}
    for p in sorted((SYSTEM / "latex").glob("*")):
        if p.suffix in (".tex", ".cls"):
            hits = re.findall(r"\\definecolor\{[^}]*\}\{[^}]*\}\{[^}]*\}|\{(?:HTML|rgb|RGB|cmyk|gray)\}\{[^}]*\}", p.read_text(encoding="utf-8"))
            r.check(not hits, f"latex/{p.name} holds the color literal {', '.join(hits)}; take it from brand.tex or mix it from roles")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(keep) / brand.name if keep else Path(tmp)
        for name, (_, size, colors) in FIXTURES.items():
            work = root / name
            proc = build(name, brand, work)
            log = (work / "main.log").read_text(encoding="utf-8", errors="replace") if (work / "main.log").exists() else proc.stdout
            r.check(proc.returncode == 0, f"{name}: the build failed under {brand.name}:\n" + "\n".join(l for l in log.splitlines() if l.startswith("!") or "frontiers-print:" in l)[:1200])
            if proc.returncode != 0:
                continue
            pdf = work / "main.pdf"
            size_found, fonts, images, text = pdf_facts(pdf)
            r.check(abs(size_found[0] - size[0]) < 0.6 and abs(size_found[1] - size[1]) < 0.6, f"{name}: page size {size_found[0]:g} x {size_found[1]:g} pts is not {size[0]} x {size[1]} pts")
            for base, emb in fonts:
                r.check(emb, f"{name}: font {base} is not embedded")
                # A PostScript name is the family's name plus its instance (SourceSerif4Roman-12pt for SourceSerif4-*).
                flat = re.sub(r"[^A-Za-z0-9]", "", base.split("+")[-1])
                r.check(any(flat.startswith(f) for f in families), f"{name}: font {base.split('+')[-1]} is not one this design system ships")
            # The text layer maps every glyph to its Unicode character (spec FR-019): no private-use code point, the
            # fixture's typographic quotes extract as themselves, and its sans line extracts as one unspaced string.
            pua = sorted({f"U+{ord(c):04X}" for c in text if 0xE000 <= ord(c) <= 0xF8FF})
            r.check(not pua, f"{name}: the text layer holds private-use code points {', '.join(pua)}; a font feature put glyphs in the PDF with no Unicode mapping")
            # A glyph a font lacks falls back to another font and never vanishes (spec FR-020).
            r.check("Missing character" not in log, f"{name}: a glyph is missing from its font and was dropped from the PDF:\n" + "\n".join(l for l in log.splitlines() if "Missing character" in l)[:600])
            r.check(" ".join(text.split()).count("x ≈ y ≠ z ≤ w ≥ v → u ↔ t ✓ s") >= 3, f"{name}: the code symbols ≈ ≠ ≤ ≥ → ↔ ✓ do not extract as set in a code block, inline code and monospace text")
            flat_text = " ".join(text.split())
            r.check("NOTE: A-B (C) 2026-10 © 2026 Shahid, it’s “set in the sans”." in flat_text,
                    f"{name}: the sans sample line does not extract as the text that was set (a quote, colon, hyphen, parenthesis or letter-spacing is wrong in the text layer)")
            for color, role in colors.items():
                got = re.search(rf"THEME {color}=(\w+):([^\s]+)", log)
                want = _expected(role, values)
                ok = bool(got) and want is not None and (got.group(2).upper() == want or _rgb_matches(got.group(1), got.group(2), want))
                r.check(ok, f"{name}: {color} is {got.group(0) if got else 'not logged'}, not {brand.name}'s {role} ({want})")
            if name == "article":
                # The default typeface set pairs the serif with the house sans, Inter (spec FR-008).
                names = {base.split("+")[-1] for base, _ in fonts}
                r.check(any(re.match(r"Inter(TT)?-", n) for n in names), f"article: its sans is not Inter ({', '.join(sorted(names))})")
            if name == "book":
                # The book's sans is the theme's font-sans in every style the interior sets (spec FR-004, FR-005).
                styles = {re.sub(r"-Identity-H$", "", base.split("+")[-1]) for base, _ in fonts}
                for style in ("Regular", "Bold", "Italic", "BoldItalic"):
                    r.check(any(s.endswith("-" + style) and not s.startswith(("SourceSerif", "SourceCode")) for s in styles),
                            f"book: no sans {style} in the PDF ({', '.join(sorted(styles))})")
                r.check(images >= 3, f"book: {images} images placed, not the theme's light and dark lockups and icon")
    return r


def _expected(role: str, values: dict[str, str]) -> str | None:
    """A role's value, or a mix of two roles ("text!72!surface"), as six hex digits."""
    if "!" not in role:
        return values.get(role)
    a, pct, b = role.split("!")
    if a not in values or b not in values:
        return None
    w = int(pct) / 100
    mix = [w * int(values[a][i:i + 2], 16) + (1 - w) * int(values[b][i:i + 2], 16) for i in (0, 2, 4)]
    return "".join(f"{round(c):02X}" for c in mix)


def _rgb_matches(model: str, spec: str, want: str) -> bool:
    if model != "rgb":
        return False
    parts = [float(x) * 255 for x in spec.split(",")]
    return all(abs(p - int(want[i:i + 2], 16)) <= 1 for p, i in zip(parts, (0, 2, 4)))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--brand", help="the slug of a brand vendored beside this design system")
    ap.add_argument("--keep", type=Path, help="keep each build in this directory")
    args = ap.parse_args()
    siblings = sorted(p for p in SYSTEM.parent.iterdir() if (p / "brand.tex").is_file())
    brands = [SYSTEM.parent / args.brand] if args.brand else siblings
    if not brands or not all((b / "brand.tex").is_file() for b in brands):
        print(f"no brand with a brand.tex beside {SYSTEM.name} ({args.brand or 'none found'}): vendor one to run this harness")
        return 2
    failed = 0
    for brand in brands:
        r = run(brand, args.keep)
        print(f"{'FAIL' if r.failed else 'ok  '} {SYSTEM.name}, themed by {brand.name}  ({r.passed} passed{f', {len(r.failed)} failed' if r.failed else ''})")
        for f in r.failed:
            print("     ✗ " + f.replace("\n", "\n       "))
        failed += len(r.failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
