"""The figure kit: drawing primitives that emit a figure's semantic SVG (spec FR-003, FR-007 to FR-009).

A figure drawn with this kit names every color by its figure role, as a class (f-<role> for fill,
s-<role> for stroke), and its type by size, weight and style only. It holds no color and no font
name: theme.py adds both from a brand when a consumer renders it, in any medium. Text is measured in
the theme's sans (the brand's font-sans, among the families in fonts/) so a box is sized for the
type it will be set in.

Type and spacing follow the house rules: nothing under MIN_FONT_PX (20px on the 1040px standard
canvas, about 6.9pt in print), body text 21px, line height 1.3x the size, box padding of 18px or
more. SVG.text() refuses anything smaller, so a figure built on this kit cannot regress.
Requires Pillow.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import ImageFont

HERE = Path(__file__).resolve().parent
FONTS_DIR = HERE / "fonts"
# The families this design system ships, by the name a brand gives them: file stem (spec FR-006).
FAMILIES = {"Inter": "Inter"}
CANVAS = {name: v["canvas"] for name, v in json.loads((HERE / "roles.json").read_text(encoding="utf-8"))["layout-variants"].items()}

MIN_FONT_PX = 20
BODY_PX = 21
LINE_HEIGHT = 1.3
MIN_PAD = 18
# The most a label's tracking may tighten, in em, to fit its box (spec FR-008).
MIN_TRACKING = -0.02

_fonts: dict = {}
_family = "Inter"


def use_family(family: str) -> None:
    """Measure text in this family from now on: the theme's font-sans."""
    global _family
    if family not in FAMILIES:
        raise ValueError(f"frontiers-figures does not ship {family!r}; it ships {', '.join(FAMILIES)}")
    _family = family
    _fonts.clear()


def use_brand(brand: str | os.PathLike) -> None:
    """Measure text in a brand's font-sans."""
    tokens = json.loads((Path(brand) / "tokens.json").read_text(encoding="utf-8"))
    value = tokens["role"]["font-sans"]["$value"]
    while value.startswith("{"):
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    use_family(value)


def _font(bold: bool, italic: bool):
    style = {(False, False): "Regular", (True, False): "Bold", (False, True): "Italic", (True, True): "BoldItalic"}[(bold, italic)]
    if style not in _fonts:
        _fonts[style] = ImageFont.truetype(str(FONTS_DIR / f"{FAMILIES[_family]}-{style}.otf"), 100)
    return _fonts[style]


def text_width(s: str, size: float, bold: bool = False, italic: bool = False, tracking: float = 0.0) -> float:
    """Width of s set at size px, with tracking in em between letters."""
    bbox = _font(bold, italic).getbbox(s)
    return (bbox[2] - bbox[0]) * (size / 100.0) + tracking * size * max(len(s) - 1, 0)


def wrap(s, size, max_width, bold=False, italic=False):
    words = s.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if text_width(trial, size, bold, italic) <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def text_height(s, size, max_width, bold=False):
    """Height of s wrapped to max_width, at LINE_HEIGHT x size per line."""
    return len(wrap(s, size, max_width, bold)) * size * LINE_HEIGHT


def box_height(s, w, size=BODY_PX, bold=False, pad=MIN_PAD, min_h=0):
    """Height a box of width w needs to hold s with pad on each side."""
    return max(min_h, text_height(s, size, w - 2 * pad, bold) + 2 * pad)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _cls(fill=None, stroke=None):
    names = ([f"f-{fill}"] if fill else []) + ([f"s-{stroke}"] if stroke else [])
    return f' class="{" ".join(names)}"' if names else ""


class SVG:
    """A figure on a standard (1040px) or compact (720px) canvas (spec FR-005)."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def rect(self, x, y, w, h, fill="surface", stroke=None, sw=1.5, rx=4):
        nofill = ' fill="none"' if fill is None else ""
        width = f' stroke-width="{sw}"' if stroke else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"{_cls(fill, stroke)}{nofill}{width}/>')

    def line(self, x1, y1, x2, y2, stroke="line", sw=2, arrow=True, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        m = ' marker-end="url(#arrD)"' if arrow else ""
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{_cls(None, stroke)} stroke-width="{sw}"{d}{m}/>')

    def curve(self, x1, y1, cx, cy, x2, y2, stroke="line", sw=2, arrow=True):
        m = ' marker-end="url(#arrD)"' if arrow else ""
        self.add(f'<path d="M{x1},{y1} Q{cx},{cy} {x2},{y2}" fill="none"{_cls(None, stroke)} stroke-width="{sw}"{m}/>')

    def text(self, x, y, s, size=BODY_PX, bold=False, italic=False, fill="body", anchor="middle", tracking=0.0):
        if size < MIN_FONT_PX:
            raise ValueError(f"{size}px text is below the {MIN_FONT_PX}px minimum: {s!r}")
        if tracking < MIN_TRACKING:
            raise ValueError(f"tracking {tracking}em is tighter than {MIN_TRACKING}em: {s!r}")
        w = "bold" if bold else "normal"
        it = ' font-style="italic"' if italic else ""
        tr = f' letter-spacing="{tracking}em"' if tracking else ""
        self.add(f'<text x="{x}" y="{y}" text-anchor="{anchor}"{_cls(fill)} font-size="{size}" font-weight="{w}"{it}{tr}>{esc(s)}</text>')

    def text_block(self, cx, cy, s, size=BODY_PX, bold=False, fill="body", max_width=380, line_h=None, anchor="middle"):
        """Wrap s to max_width and centre the lines vertically on cy (a baseline position)."""
        line_h = line_h or size * LINE_HEIGHT
        lines = wrap(s, size, max_width, bold)
        top = cy - (len(lines) - 1) * line_h / 2.0
        for i, ln in enumerate(lines):
            self.text(cx, top + i * line_h, ln, size=size, bold=bold, fill=fill, anchor=anchor)
        return lines

    def box_with_text(self, x, y, w, h, s, fill="primary-tint", stroke="primary", text_fill="ink",
                      size=BODY_PX, bold=False, sw=1.5, pad=MIN_PAD):
        """Draw a box and centre s inside it, wrapped to w - 2*pad. Pass h=None to size the box to its
        wrapped text. Returns the box's height."""
        if pad < MIN_PAD:
            raise ValueError(f"box padding {pad}px is below the {MIN_PAD}px minimum")
        if h is None:
            h = box_height(s, w, size=size, bold=bold, pad=pad)
        self.rect(x, y, w, h, fill=fill, stroke=stroke, sw=sw)
        self.text_block(x + w / 2, y + h / 2 + size * 0.35, s, size=size, bold=bold, fill=text_fill, max_width=w - pad * 2)
        return h

    def title(self, s, subtitle=None, x=28, y=50):
        """34px bold title with an optional 20px italic subtitle 34px below it."""
        self.text(x, y, s, size=34, bold=True, fill="ink", anchor="start")
        if subtitle:
            self.text(x, y + 34, subtitle, size=20, italic=True, fill="muted", anchor="start")

    def render(self):
        defs = ('<defs><marker id="arrD" viewBox="0 0 10 10" refX="9" refY="5" '
                'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
                '<path d="M0,0 L10,5 L0,10 z" class="f-line"/></marker></defs>')
        body = "\n  ".join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
                f'width="{self.w}" height="{self.h}">\n  {defs}\n  '
                f'<rect width="{self.w}" height="{self.h}" class="f-surface"/>\n  {body}\n</svg>\n')

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.render())
