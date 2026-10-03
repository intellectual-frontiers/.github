#!/usr/bin/env python3
"""Check figure sources against frontiers-figures' rules that can be checked mechanically (spec FR-003 to FR-009).

    python3 figcheck.py [--brand DIR] FIGURE.svg|DIR ...

For every figure (every *.svg under a directory):

  - it is on the standard (1040px) or compact (720px) canvas;
  - it names every color by a figure-role class (f-, s- or c-<role>) and holds no color and no font
    name of its own, so a theme supplies both;
  - no label is smaller than 20px, or tracked tighter than -0.02em;
  - no label has an em dash or a straight quote;
  - every label fits: inside the box it sits in, on the canvas, and under no shape drawn after it,
    measured in the theme's sans at its optical size (the brand's font-sans with --brand, else Inter).

Exits non-zero if any figure fails. Requires Pillow.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import svgkit  # noqa: E402

NS = "{http://www.w3.org/2000/svg}"
ROLES = set(json.loads((Path(__file__).resolve().parent / "roles.json").read_text(encoding="utf-8"))["roles"])
COLOR_ATTRS = ("fill", "stroke", "stop-color", "color", "flood-color", "lighting-color")
# Room a centred label leaves on each side of its box.
BOX_MARGIN = 4


def num(v, default=0.0):
    try:
        return float(re.match(r"-?[\d.]+", str(v)).group(0))
    except (AttributeError, TypeError, ValueError):
        return default


def walk(el, inherited, out):
    here = dict(inherited)
    for k in ("font-size", "font-weight", "font-style", "text-anchor", "letter-spacing"):
        if el.get(k) is not None:
            here[k] = el.get(k)
    tag = el.tag.replace(NS, "")
    if tag in ("text", "tspan") and el.text and el.text.strip():
        out.append((el.text, here, el))
    for child in el:
        walk(child, here, out)
        if child.tail and child.tail.strip() and tag in ("text", "tspan"):
            out.append((child.tail, here, el))


def semantic_problems(root) -> list[str]:
    problems = []
    for el in root.iter():
        tag = el.tag.replace(NS, "")
        if tag == "style":
            problems.append("holds a <style>: the theme's stylesheet is added when the figure is rendered, never kept in its source")
        for a in COLOR_ATTRS:
            v = el.get(a)
            if v is not None and v != "none" and not v.startswith("url("):
                problems.append(f"<{tag}> {a}=\"{v}\": name the color by a figure-role class")
        style = el.get("style") or ""
        if re.search(r"(fill|stroke|stop-color|color|font-family)\s*:", style):
            problems.append(f"<{tag}> style=\"{style[:40]}\": colors and fonts come from the theme")
        if el.get("font-family") is not None:
            problems.append(f"<{tag}> font-family: the label's family comes from the theme")
        for c in (el.get("class") or "").split():
            m = re.fullmatch(r"([fsc])-([a-z0-9-]+)", c)
            if not m or m.group(2) not in ROLES:
                problems.append(f"<{tag}> class {c!r} is not a figure-role class")
    return problems


def check(path) -> list[str]:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        return [f"does not parse: {e}"]
    problems = []
    vb = (root.get("viewBox") or "").split()
    width = num(vb[2]) if len(vb) == 4 else num(root.get("width"))
    if width not in svgkit.CANVAS.values():
        problems.append(f"canvas is {width:g}px wide, not one of {sorted(svgkit.CANVAS.values())}")
    problems += semantic_problems(root)
    # Boxes are outlined rectangles; a fill-only band or quadrant is a background a label may cross.
    rects = []
    for r in root.iter(NS + "rect"):
        w = r.get("width") or ""
        outlined = any(c.startswith("s-") for c in (r.get("class") or "").split()) or r.get("stroke") not in (None, "none")
        if w and not w.endswith("%") and outlined:
            rects.append((num(r.get("x")), num(r.get("y")), num(w), num(r.get("height"))))
    # For each label, the filled rectangles drawn after it, in document order.
    order = list(root.iter())
    filled = [(i, (num(e.get("x")), num(e.get("y")), num(e.get("width")), num(e.get("height"))))
              for i, e in enumerate(order) if e.tag == NS + "rect" and (e.get("width") or "")[-1:] != "%"
              and e.get("fill") != "none" and any(c.startswith("f-") for c in (e.get("class") or "").split())]
    shapes_after = {}
    for i, e in enumerate(order):
        if e.tag == NS + "text":
            shapes_after[e] = [g for j, g in filled if j > i]
    items = []
    walk(root, {}, items)
    for s, a, el in items:
        label = s.strip()
        size = num(a.get("font-size"), 16)
        tracking = num(str(a.get("letter-spacing", "0")).replace("em", ""))
        if size < svgkit.MIN_FONT_PX:
            problems.append(f"{size:g}px text (min {svgkit.MIN_FONT_PX}): {label[:60]!r}")
        if tracking < svgkit.MIN_TRACKING - 1e-9:
            problems.append(f"tracking {tracking:g}em (min {svgkit.MIN_TRACKING}): {label[:60]!r}")
        if "—" in s:
            problems.append(f"em dash: {label[:60]!r}")
        if "'" in s or '"' in s:
            problems.append(f"straight quote: {label[:60]!r}")
        x, y = el.get("x"), el.get("y")
        if x is None or " " in x.strip():
            continue
        x, y = num(x), num(y)
        w = svgkit.text_width(label, size, bold=a.get("font-weight") == "bold",
                              italic=a.get("font-style") == "italic", tracking=tracking)
        anchor = a.get("text-anchor", "start")
        left = x - (w / 2 if anchor == "middle" else w if anchor == "end" else 0)
        if left < -1 or left + w > width + 1:
            problems.append(f"runs off the canvas: {label[:60]!r}")
        else:
            # A shape drawn after a label must not cover part of it (a table's next cell, a neighbouring box).
            top, bottom = y - size * 0.75, y + size * 0.2
            for later in shapes_after.get(el, []):
                lx, ly, lw, lh = later
                if lx < left + w - 0.5 and left + 0.5 < lx + lw and ly < bottom and top < ly + lh and not (lx <= left and left + w <= lx + lw):
                    problems.append(f"runs under a shape drawn after it: {label[:60]!r}")
                    break
            # The box a label starts, ends or is centred in: the smallest outlined box around its anchor.
            boxes = [r for r in rects if r[0] <= x <= r[0] + r[2] and r[1] <= y - size * 0.35 <= r[1] + r[3] and r[2] < width - 1]
            if boxes:
                bx, _, bw, _ = min(boxes, key=lambda r: r[2] * r[3])
                if left < bx + BOX_MARGIN - 0.5 or left + w > bx + bw - BOX_MARGIN + 0.5:
                    problems.append(f"overflows its {bw:g}px box ({w:.0f}px): {label[:60]!r}")
    return problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--brand", help="measure in this brand's font-sans")
    args = ap.parse_args(argv)
    if args.brand:
        svgkit.use_brand(args.brand)
    paths = []
    for a in args.paths:
        paths += sorted(glob.glob(os.path.join(a, "**", "*.svg"), recursive=True)) if os.path.isdir(a) else [a]
    bad = 0
    for p in paths:
        probs = check(p)
        if probs:
            bad += 1
            print(p)
            for pr in probs:
                print("   ", pr)
    print(f"{len(paths)} figures checked, {bad} with problems")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
