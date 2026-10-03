#!/usr/bin/env python3
"""The stylesheet that themes a figure (spec FR-004 to FR-006; 0014-design-systems FR-038, FR-044).

    python3 theme.py css --brand DIR [--variant default|on-dark|grayscale]
        The figure stylesheet for that brand and variant: one rule per figure class.

    python3 theme.py apply FIGURE.svg --brand DIR [--variant ...] [--embed-fonts] [-o OUT.svg]
        The figure with that stylesheet placed in it, ready for a renderer or a page. With --embed-fonts, the
        stylesheet also carries the sans, cut to the letters the figure uses, so a page that shows the figure as an
        image (which cannot load the page's fonts) still sets it in the brand's sans (spec FR-006).

A figure's source names its colors by class (f-<role>, s-<role>, c-<role>) and its type by size,
weight and style only; this resolves each role through roles.json to the brand's own value or a
mix of two of its roles, names the brand's font-sans for every label, and sets every nominal type size at
that family's optical size. Standard library only; --embed-fonts needs fontTools.
"""
from __future__ import annotations

import argparse
import base64
import html
import io
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROLES = json.loads((HERE / "roles.json").read_text(encoding="utf-8"))
FALLBACK_SANS = "'Liberation Sans', Arial, sans-serif"


def brand_tokens(brand: Path) -> dict:
    return json.loads((brand / "tokens.json").read_text(encoding="utf-8"))


def brand_value(tokens: dict, role: str) -> str:
    value = tokens["role"][role]["$value"]
    while isinstance(value, str) and value.startswith("{"):
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    return value


def resolve(expr: str, tokens: dict) -> str:
    """A brand role ("primary") or a mix of two ("text!62!surface") as #rrggbb."""
    if "!" not in expr:
        return brand_value(tokens, expr).lower()
    a, pct, b = expr.split("!")
    w = int(pct) / 100
    ca, cb = brand_value(tokens, a), brand_value(tokens, b)
    mix = [w * int(ca[i:i + 2], 16) + (1 - w) * int(cb[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(c):02x}" for c in mix)


def palette(brand: Path, variant: str = "default") -> dict[str, str]:
    """Every figure role's color for this brand and variant."""
    if variant not in ROLES["variants"]:
        raise SystemExit(f"unknown variant {variant!r}: {', '.join(ROLES['variants'])}")
    tokens = brand_tokens(brand)
    return {role: resolve(expr, tokens) for role, expr in ROLES["variants"][variant]["map"].items()}


def font_family(brand: Path) -> str:
    return brand_value(brand_tokens(brand), "font-sans")


def css(brand: Path, variant: str = "default") -> str:
    colors = palette(brand, variant)
    rules = [f"text{{font-family:'{font_family(brand)}',{FALLBACK_SANS}}}"]
    for role, color in colors.items():
        rules.append(f".f-{role}{{fill:{color}}}.s-{role}{{stroke:{color}}}.c-{role}{{stop-color:{color}}}")
    return "".join(rules)


def optical(brand: Path) -> float:
    """The factor a figure's nominal type sizes are set at in the brand's sans: its x-height brought to the
    reference (roles.json "type"; spec FR-007)."""
    family = font_family(brand)
    families = ROLES["type"]["families"]
    if family not in families:
        raise SystemExit(f"frontiers-figures does not ship the brand's sans, {family}; it ships {', '.join(families)}")
    return ROLES["type"]["reference-x-height"] / families[family]["x-height"]


def apply(svg: str, brand: Path, variant: str = "default", embed_fonts: bool = False) -> str:
    """The figure with the theme's stylesheet as the first child of its <svg>, and every nominal type size set
    at the brand's sans's optical size (spec FR-007); with embed_fonts, the sans embedded in it (spec FR-006)."""
    if 'data-theme="' in svg:
        raise ValueError("this figure is already themed; theme its source")
    faces = font_faces(svg, brand) if embed_fonts else ""
    style = f'<style data-theme="{brand.name}" data-variant="{variant}">{faces}{css(brand, variant)}</style>'
    k = optical(brand)
    svg = re.sub(r'(<(?:text|tspan)\b[^>]*?\bfont-size=")([\d.]+)(")', lambda m: f"{m.group(1)}{float(m.group(2)) * k:.4g}{m.group(3)}", svg)
    return re.sub(r"(<svg\b[^>]*>)", lambda m: m.group(1) + "\n  " + style, svg, count=1)


FONTS_DIR = HERE / "fonts"
STYLES = {(False, False): "Regular", (True, False): "Bold", (False, True): "Italic", (True, True): "BoldItalic"}


def font_faces(svg: str, brand: Path) -> str:
    """@font-face rules carrying the brand's sans, one per weight and style the figure sets, each cut to the
    letters it sets in that style and embedded as WOFF (spec FR-006)."""
    from fontTools import subset
    from fontTools.ttLib import TTFont

    family = font_family(brand)
    stem = ROLES["type"]["families"][family]["stem"]
    used: dict[tuple[bool, bool], set[str]] = {}
    for m in re.finditer(r"<text\b([^>]*)>(.*?)</text>", svg, re.S):
        attrs, body = m.group(1), html.unescape(re.sub(r"<[^>]+>", "", m.group(2)))
        bold = bool(re.search(r'font-weight="(?:bold|[6-9]00)"', attrs))
        italic = 'font-style="italic"' in attrs
        used.setdefault((bold, italic), set()).update(body)
    rules = []
    for (bold, italic), chars in sorted(used.items()):
        font = TTFont(FONTS_DIR / f"{stem}-{STYLES[(bold, italic)]}.otf")
        opts = subset.Options()
        opts.flavor, opts.layout_features, opts.name_IDs, opts.notdef_outline = "woff", ["kern", "liga", "calt"], [0, 1, 2, 13, 14], True
        sub = subset.Subsetter(opts)
        sub.populate(text="".join(sorted(chars | {" "})))
        sub.subset(font)
        buf = io.BytesIO()
        font.flavor = "woff"
        font.save(buf)
        data = base64.b64encode(buf.getvalue()).decode()
        rules.append(f"@font-face{{font-family:'{family}';font-weight:{700 if bold else 400};font-style:{'italic' if italic else 'normal'};"
                     f"src:url(data:font/woff;base64,{data}) format('woff')}}")
    return "".join(rules)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("cmd", choices=["css", "apply"])
    ap.add_argument("figure", nargs="?", type=Path)
    ap.add_argument("--brand", type=Path, required=True)
    ap.add_argument("--variant", default="default")
    ap.add_argument("--embed-fonts", action="store_true", help="embed the sans, cut to the figure's letters (needs fontTools)")
    ap.add_argument("-o", "--out", type=Path)
    args = ap.parse_args()
    if args.cmd == "css":
        out = css(args.brand, args.variant) + "\n"
    else:
        if not args.figure:
            ap.error("apply needs a figure")
        out = apply(args.figure.read_text(encoding="utf-8"), args.brand, args.variant, args.embed_fonts)
    if args.out:
        args.out.write_text(out, encoding="utf-8")
    else:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
