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
  - no style file holds one of the brand's colors as a literal.

Needs Python 3, latexmk with XeLaTeX and LuaLaTeX, and poppler-utils (pdfinfo, pdffonts, pdfimages). Exits
non-zero on any failure. This file is the harness and its documentation.
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

# Fixture -> engine, page size in points, and which theme role each style-file color must carry.
FIXTURES = {
    "book": ("-xelatex", (504.0, 661.68), {"ifdeepink": "text", "iffrontierblue": "primary", "ifsignalteal": "secondary", "ifoxblood": "tertiary"}),
    "article": ("-lualatex", (612.0, 792.0), {"ifink": "text", "ifblue": "primary", "ifoxblood": "tertiary", "ifteal": "secondary"}),
}


class Result:
    def __init__(self) -> None:
        self.passed, self.failed = 0, []

    def check(self, ok: bool, what: str) -> None:
        if ok:
            self.passed += 1
        else:
            self.failed.append(what)


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
    return subprocess.run(["latexmk", engine, "-interaction=nonstopmode", "-halt-on-error", "main.tex"],
                          cwd=work, capture_output=True, text=True)


def run(brand: Path, keep: Path | None) -> Result:
    r = Result()
    values = brand_values(brand)
    shipped = shipped_fonts()
    families = {s.split("-")[0] for s in shipped}
    for p in sorted((SYSTEM / "latex").glob("*")):
        if p.suffix in (".tex", ".cls"):
            literals = {h.upper() for h in re.findall(r"\{HTML\}\{([0-9A-Fa-f]{6})\}", p.read_text(encoding="utf-8"))}
            hits = sorted(literals & set(values.values()) - {"FFFFFF", "000000"})
            r.check(not hits, f"latex/{p.name} holds {', '.join(hits)} as a literal: one of {brand.name}'s colors; take it from brand.tex")
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
            info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
            m = re.search(r"Page size:\s+([\d.]+) x ([\d.]+) pts", info)
            r.check(bool(m) and abs(float(m.group(1)) - size[0]) < 0.6 and abs(float(m.group(2)) - size[1]) < 0.6, f"{name}: page size {m.group(0) if m else '?'} is not {size[0]} x {size[1]} pts")
            fonts = subprocess.run(["pdffonts", str(pdf)], capture_output=True, text=True).stdout.splitlines()[2:]
            for line in fonts:
                cols = line.split()
                base = cols[0].split("+")[-1]
                emb = cols[-5] if len(cols) >= 7 else "no"
                r.check(emb == "yes", f"{name}: font {base} is not embedded")
                # A PostScript name is the family's name plus its instance (SourceSerif4Roman-12pt for SourceSerif4-*).
                flat = re.sub(r"[^A-Za-z0-9]", "", base)
                r.check(any(flat.startswith(f) for f in families), f"{name}: font {base} is not one this design system ships")
            for color, role in colors.items():
                got = re.search(rf"THEME {color}=(\w+):([^\s]+)", log)
                want = values.get(role)
                ok = bool(got) and want is not None and (got.group(2).upper() == want or _rgb_matches(got.group(1), got.group(2), want))
                r.check(ok, f"{name}: {color} is {got.group(0) if got else 'not logged'}, not {brand.name}'s {role} ({want})")
            if name == "book":
                images = subprocess.run(["pdfimages", "-list", str(pdf)], capture_output=True, text=True).stdout.splitlines()[2:]
                r.check(len(images) >= 3, f"book: {len(images)} images placed, not the theme's light and dark lockups and icon")
    return r


def _rgb_matches(model: str, spec: str, want: str) -> bool:
    if model != "rgb":
        return False
    parts = [round(float(x) * 255) for x in spec.split(",")]
    return parts == [int(want[i:i + 2], 16) for i in (0, 2, 4)]


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
