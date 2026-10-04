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
import base64
import html
import io
import json
import re
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
        "bar-chart": lambda p: layouts.bar_chart(p, "A bar chart", "One value per category, labelled.",
                                                 [("The date passed", 18), ("The metric missed", 12), ("No next test", 7)],
                                                 highlight=0, source="A fixture", width=w),
        "line-chart": lambda p: layouts.line_chart(p, "A line chart", "Four series, each named at its end.",
                                                   ["2022", "2023", "2024", "2025"],
                                                   [("First", [120, 95, 80, 62]), ("Second", [180, 175, 190, 170]),
                                                    ("Third", [150, 150, 148, 152]), ("Fourth", [70, 60, 52, 40])],
                                                   unit="k", source="A fixture", width=w),
        "timeline": lambda p: layouts.timeline(p, "A timeline", "Events in order, each with its date.",
                                               [("Week 0", "The sponsor signs the metric, the date and the threshold."),
                                                ("Week 6", "The date arrives and the pilot stops.")], width=w),
    }
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, draw in figs.items():
        p = out / f"{name}-{canvas}.svg"
        draw(str(p))
        paths.append(p)
    return paths


# Machado, Oliveira and Fernandes (2009) at full severity, on linear RGB: how a color looks to protan, deutan and
# tritan vision. The series must stay apart to each (spec FR-012).
CVD = {"protan": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       "deutan": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       "tritan": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
SERIES_APART = {"color": 12.0, "grayscale": 8.0}  # least CIEDE2000 between two series
SEQUENTIAL_STEP = 8.0  # least CIEDE2000 between neighbouring steps of a sequential scale


def _linear(h: str) -> list[float]:
    return [(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))]


def _simulate(h: str, kind: str) -> list[float]:
    rgb = _linear(h)
    if kind == "normal":
        return rgb
    return [min(1.0, max(0.0, sum(CVD[kind][r][k] * rgb[k] for k in range(3)))) for r in range(3)]


def _lab(rgb: list[float]) -> tuple[float, float, float]:
    r, g, b = rgb
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116  # noqa: E731
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def ciede2000(c1, c2) -> float:
    import math
    (l1, a1, b1), (l2, a2, b2) = c1, c2
    cbar = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2
    g = 0.5 * (1 - math.sqrt(cbar ** 7 / (cbar ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + g), a2 * (1 + g)
    c1p, c2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if c1p else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if c2p else 0.0
    dl, dc = l2 - l1, c2p - c1p
    dh = 0.0 if c1p * c2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 * math.copysign(1, h2p - h1p))
    dH = 2 * math.sqrt(c1p * c2p) * math.sin(math.radians(dh / 2))
    lbar, cbarp = (l1 + l2) / 2, (c1p + c2p) / 2
    if c1p * c2p == 0:
        hbar = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbar = (h1p + h2p) / 2
    else:
        hbar = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    t = (1 - 0.17 * math.cos(math.radians(hbar - 30)) + 0.24 * math.cos(math.radians(2 * hbar))
         + 0.32 * math.cos(math.radians(3 * hbar + 6)) - 0.20 * math.cos(math.radians(4 * hbar - 63)))
    sl = 1 + 0.015 * (lbar - 50) ** 2 / math.sqrt(20 + (lbar - 50) ** 2)
    sc, sh = 1 + 0.045 * cbarp, 1 + 0.015 * cbarp * t
    rt = -2 * math.sqrt(cbarp ** 7 / (cbarp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-(((hbar - 275) / 25) ** 2))))
    return math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh))


def check_chart_palette(r: Result, brand: Path, variant: str, pal: dict) -> None:
    """spec FR-012: every series 3:1 on the surface and apart from every other, to color-blind vision too in the color
    variants; every sequential scale ordered from light to dark (dark to light on dark) with steps apart."""
    import itertools
    series, steps = theme.ROLES["series"], theme.ROLES["sequential"]
    for role in series:
        c = contrast(pal[role], pal["surface"])
        r.check(c >= 3, f"{variant}: {role} on surface is {c:.2f}:1 under {brand.name}, below 3:1")
    kinds = ("normal",) if variant == "grayscale" else ("normal", "protan", "deutan", "tritan")
    least = SERIES_APART["grayscale" if variant == "grayscale" else "color"]
    for kind in kinds:
        for a, b in itertools.combinations(series, 2):
            d = ciede2000(_lab(_simulate(pal[a], kind)), _lab(_simulate(pal[b], kind)))
            r.check(d >= least, f"{variant}: {a} and {b} are {d:.1f} apart to {kind} vision under {brand.name}, under {least}")
    lum = [luminance(pal[s]) for s in steps]
    toward = all(x > y for x, y in zip(lum, lum[1:])) or all(x < y for x, y in zip(lum, lum[1:]))
    r.check(toward, f"{variant}: the sequential steps are not in order of lightness under {brand.name}")
    for a, b in zip(steps, steps[1:]):
        d = ciede2000(_lab(_linear(pal[a])), _lab(_linear(pal[b])))
        r.check(d >= SEQUENTIAL_STEP, f"{variant}: {a} and {b} are {d:.1f} apart under {brand.name}, under {SEQUENTIAL_STEP}")


def check_data(r: Result) -> None:
    roles = theme.ROLES
    names = set(roles["roles"])
    for v, spec in roles["variants"].items():
        r.check(set(spec["map"]) == names, f"roles.json: variant {v} maps {sorted(set(spec['map']) ^ names)} differently from the role list")
    for group in ("foreground", "background", "graphics", "series", "sequential"):
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
            check_chart_palette(r, brand, variant, pal)
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
        try:
            from fontTools.ttLib import TTFont
        except ImportError:
            TTFont = None
        for p in figs[:3] if TTFont else []:
            svg = p.read_text(encoding="utf-8")
            embedded = theme.apply(svg, brand, "default", embed_fonts=True)
            faces = re.findall(r"font-weight:(\d+);font-style:(\w+);src:url\(data:font/woff;base64,([A-Za-z0-9+/=]+)\)", embedded)
            r.check(bool(faces), f"{p.name}: themed with --embed-fonts but carries no font (FR-006)")
            cmaps = {(w, st): set(TTFont(io.BytesIO(base64.b64decode(d))).getBestCmap()) for w, st, d in faces}
            for m in re.finditer(r"<text\b([^>]*)>(.*?)</text>", svg, re.S):
                bold = bool(re.search(r'font-weight="(?:bold|[6-9]00)"', m.group(1)))
                key = ("700" if bold else "400", "italic" if 'font-style="italic"' in m.group(1) else "normal")
                missing = {c for c in html.unescape(m.group(2)) if ord(c) not in cmaps.get(key, set())}
                r.check(not missing, f"{p.name}: the embedded {key} face lacks {sorted(missing)} (FR-006)")
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
                family = svgkit.FAMILIES[svgkit._family]["stem"]
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
