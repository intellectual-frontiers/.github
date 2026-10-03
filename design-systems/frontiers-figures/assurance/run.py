#!/usr/bin/env python3
"""The assurance harness for frontiers-figures (0014-design-systems FR-015, FR-032, FR-039).

    python3 assurance/run.py                  every brand vendored beside this design system
    python3 assurance/run.py --brand SLUG     one brand
    python3 assurance/run.py --keep DIR       keep each built and themed figure in DIR

It checks this design system's own data, then, under each brand:

  - every layout draws a figure of its type on the standard and the compact canvas that passes
    figcheck.py measured in the brand's font-sans;
  - every fixture in fixtures/fail/ fails with the problem fixtures/expected.json names;
  - every variant (default, on-dark, grayscale) gives every figure role a color, every text role
    reaches 4.5:1 and every graphic role 3:1 on every background role, and the themed figure
    parses with its stylesheet in place;
  - where rsvg-convert is installed, a themed figure renders to PDF with the brand's font-sans
    embedded and none other.

Needs Python 3 and Pillow; rsvg-convert and pdffonts are optional. Exits non-zero on any failure.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import figcheck  # noqa: E402
import layouts  # noqa: E402
import svgkit  # noqa: E402
import theme  # noqa: E402


class Result:
    def __init__(self) -> None:
        self.passed, self.failed = 0, []

    def check(self, ok: bool, what: str) -> None:
        if ok:
            self.passed += 1
        else:
            self.failed.append(what)


def luminance(h: str) -> float:
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a: str, b: str) -> float:
    x, y = sorted((luminance(a), luminance(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def build_fixtures(out: Path, canvas: int) -> list[Path]:
    """One figure of every layout type, on one canvas."""
    w = canvas
    col = (w - 120) // 2
    figs = {
        "process": lambda p: layouts.chain_vertical(p, "A process diagram", "Steps in order, joined by arrows.",
                                                    ["Write the spec", ("Build against it", True), "Check what was built"],
                                                    width=w, box_w=w - 280, note="The spec is the source of truth."),
        "comparison": lambda p: layouts.two_column(p, "A comparison", "Before and after, side by side.", "BEFORE",
                                                   ["Every change waits on review", "Work queues up"], "AFTER",
                                                   ["Small changes ship daily", "Work flows"], takeaway="Smaller batches move faster.",
                                                   width=w, col_w=col),
        "cycle": lambda p: layouts.loop_circular(p, "A cycle diagram", "Each step feeds the next.",
                                                 ["Observe", "Decide", "Act", "Learn"], width=w,
                                                 radius=220 if w < 1040 else 300, radius_x=230 if w < 1040 else 345),
        "layer": lambda p: layouts.stack_layers(p, "A layer diagram", "Each layer rests on the one below.",
                                                [("Interface", "primary-tint", "primary", "ink", True),
                                                 ("Services", "neutral-tint", "line", "body", False),
                                                 ("Data", "emphasis-tint", "emphasis", "emphasis", False)],
                                                width=w, box_w=w - 180),
        "relationship": lambda p: layouts.converge(p, "A relationship diagram", "Many sources, one result.",
                                                   ["Readers", "Customers", "Examiners"], "Evidence", width=w),
        "decision": lambda p: layouts.gate(p, "A decision flowchart", "One question, two paths.",
                                           "Does the evidence hold?", "Ship it", "Go back and test", width=w),
        "hierarchy": lambda p: layouts.tree(p, "A hierarchy diagram", "One root, its children.",
                                            "The firm", ["Research", "Press"] if w < 1040 else ["Research", "Press", "Capital"], width=w),
    }
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, draw in figs.items():
        p = out / f"{name}-{canvas}.svg"
        draw(str(p))
        paths.append(p)
    return paths


def check_data(r: Result) -> None:
    roles = theme.ROLES
    names = set(roles["roles"])
    for v, spec in roles["variants"].items():
        r.check(set(spec["map"]) == names, f"roles.json: variant {v} maps {sorted(set(spec['map']) ^ names)} differently from the role list")
    for group in ("foreground", "background", "graphics"):
        r.check(set(roles[group]) <= names, f"roles.json: {group} names a role that is not listed")
    r.check(set(svgkit.CANVAS.values()) == {1040, 720}, "roles.json: the layout variants are not the 1040px standard and 720px compact canvases")


def run(brand: Path, keep: Path | None) -> Result:
    r = Result()
    svgkit.use_brand(brand)
    with tempfile.TemporaryDirectory() as tmp:
        root = (keep / brand.name) if keep else Path(tmp)
        figs = []
        for name, canvas in svgkit.CANVAS.items():
            figs += build_fixtures(root / "source", canvas)
        for p in figs:
            problems = figcheck.check(p)
            r.check(not problems, f"{p.name} under {brand.name}: " + "; ".join(problems))
        expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
        for name, want in expected.items():
            if name.startswith("$"):
                continue
            problems = figcheck.check(HERE / "fixtures" / "fail" / name)
            r.check(any(want in p for p in problems), f"fail/{name} should report {want!r}; it reported: {'; '.join(problems) or 'nothing'}")
        for variant in theme.ROLES["variants"]:
            pal = theme.palette(brand, variant)
            r.check(all(v.startswith("#") and len(v) == 7 for v in pal.values()), f"{variant}: a role has no color")
            for fg in theme.ROLES["foreground"]:
                for bg in theme.ROLES["background"]:
                    c = contrast(pal[fg], pal[bg])
                    r.check(c >= 4.5, f"{variant}: {fg} on {bg} is {c:.2f}:1 under {brand.name}, below 4.5:1")
            for g in theme.ROLES["graphics"]:
                for bg in theme.ROLES["background"]:
                    c = contrast(pal[g], pal[bg])
                    r.check(c >= 3, f"{variant}: {g} on {bg} is {c:.2f}:1 under {brand.name}, below 3:1")
            themed = root / variant
            themed.mkdir(parents=True, exist_ok=True)
            for p in figs:
                out = themed / p.name
                out.write_text(theme.apply(p.read_text(encoding="utf-8"), brand, variant), encoding="utf-8")
                try:
                    tree = ET.parse(out).getroot()
                    r.check(tree.find("{http://www.w3.org/2000/svg}style") is not None, f"{variant}/{p.name}: no stylesheet")
                except ET.ParseError as e:
                    r.check(False, f"{variant}/{p.name} does not parse once themed: {e}")
        if shutil.which("rsvg-convert") and shutil.which("pdffonts"):
            sample = root / "default" / figs[0].name
            pdf = root / "sample.pdf"
            # The renderer finds the shipped fonts through a fontconfig file of its own, not the machine's.
            conf = root / "fonts.conf"
            conf.write_text(f'<?xml version="1.0"?><fontconfig><dir>{SYSTEM / "fonts"}</dir>'
                            f'<include ignore_missing="yes">/etc/fonts/fonts.conf</include><cachedir>{root / "fc-cache"}</cachedir></fontconfig>',
                            encoding="utf-8")
            done = subprocess.run(["rsvg-convert", "-f", "pdf", "-o", str(pdf), str(sample)], capture_output=True,
                                  env={**os.environ, "FONTCONFIG_FILE": str(conf)})
            r.check(done.returncode == 0, f"rsvg-convert could not render {sample.name}: {done.stderr.decode()[:200]}")
            if done.returncode == 0:
                fonts = {line.split()[0].split("+")[-1].split("-")[0] for line in subprocess.run(["pdffonts", str(pdf)], capture_output=True, text=True).stdout.splitlines()[2:]}
                family = svgkit.FAMILIES[svgkit._family]
                r.check(fonts == {family}, f"the rendered figure embeds {sorted(fonts)}, not only {family} (install fonts/ where the renderer finds them)")
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--brand")
    ap.add_argument("--keep", type=Path)
    args = ap.parse_args()
    root = SYSTEM.parent
    brands = [root / args.brand] if args.brand else sorted(p.parent for p in root.glob("*/brand.css"))
    data = Result()
    check_data(data)
    print(f"{'ok  ' if not data.failed else 'FAIL'} frontiers-figures data  ({data.passed} passed)")
    for f in data.failed:
        print(f"     ✗ {f}")
    failed = bool(data.failed)
    for b in brands:
        res = run(b, args.keep)
        print(f"{'ok  ' if not res.failed else 'FAIL'} frontiers-figures, themed by {b.name}  ({res.passed} passed{', ' + str(len(res.failed)) + ' failed' if res.failed else ''})")
        for f in res.failed:
            print(f"     ✗ {f}")
        failed |= bool(res.failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
