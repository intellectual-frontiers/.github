#!/usr/bin/env python3
"""Make and measure a brand's decoration kit (0014-design-systems FR-047).

    python3 tools/brand_decoration.py trace design-systems/<brand>
        For the lockup and the icon in the kit (tokens.json $extensions["com.intellectualfrontiers.decoration"]),
        trace the raster master its "traced-from" names into one-color outlined SVG at its "file", then measure
        its finest detail and write it back to tokens.json. The trace is mechanical and repeatable: the master is
        composited on white, read as luminance, enlarged by "scale" (Lanczos), cut at "threshold" (the share of
        full ink a pixel needs to print) and traced by potrace, dropping specks smaller than "speckle-px" master
        pixels. Nothing is drawn, retouched or generated.

    python3 tools/brand_decoration.py set design-systems/<brand>
        For the wordmark in the kit and every unit mark the brand's logo lists, set the name in the face its "set-from" names (a font in the brand's fonts/,
        at its optical size and weight, tracked by "tracking-em", one line per entry of "lines", baselines
        "leading-em" apart and ink-aligned on the left) and write it as one-color outlined SVG at its "file", then
        measure its finest detail and write it back to tokens.json. It is typesetting, shaped by HarfBuzz with the
        font's own kerning: nothing is drawn. Needs the uharfbuzz package.

    python3 tools/brand_decoration.py measure <svg> [...]
        Print an SVG's finest detail: the thinnest line or gap, as a fraction of its width.

    python3 tools/brand_decoration.py match <hex> <palette.gpl> [...]
        The nearest colors to <hex> in GIMP palettes (a thread chart, a spot-color guide), by CIEDE2000, to
        propose an ink's matches. A match is a candidate until it is checked against the physical card.

Standard library, ImageMagick (`convert`), potrace and rsvg-convert; uharfbuzz for `set`.
"""
from __future__ import annotations

import html
import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path

KIT = "com.intellectualfrontiers.decoration"
# The finest detail is this percentile of every inked or enclosed pixel's local width, so a few stray pixels at a
# path's tip do not stand for the artwork's real lines and gaps.
PERCENTILE = 2
# The measure renders the artwork this many pixels wide.
MEASURE_WIDTH = 2400


def run(*args: str) -> bytes:
    return subprocess.run(args, check=True, capture_output=True).stdout


def trace(brand: Path) -> int:
    tokens_path = brand / "tokens.json"
    tokens = json.loads(tokens_path.read_text(encoding="utf-8"))
    kit = tokens["$extensions"][KIT]
    for part in ("lockup", "icon"):
        art = kit[part]
        src = art["traced-from"]
        master = brand / src["file"]
        width, height = (int(v) for v in run("identify", "-format", "%w %h", str(master)).split())
        scale = int(src["scale"])
        with tempfile.TemporaryDirectory() as tmp:
            pbm = Path(tmp) / "art.pbm"
            run("convert", str(master), "-background", "white", "-alpha", "remove", "-alpha", "off",
                "-grayscale", "Rec709Luma", "-filter", "Lanczos", "-resize", f"{scale * 100}%",
                "-threshold", f"{100 - float(src['threshold']) * 100:g}%", str(pbm))
            svg = run("potrace", "--svg", "--turdsize", str(int(src["speckle-px"]) * scale * scale), "--output", "-",
                      str(pbm)).decode()
        out = brand / art["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(clean(svg, width, height, f"{brand.name} {part}, one color, traced from {src['file']}"),
                       encoding="utf-8")
        art["finest-detail"] = round(finest_detail(out), 4)
        print(f"{art['file']}: traced from {src['file']}, finest detail {art['finest-detail']}")
    tokens_path.write_text(json.dumps(tokens, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


def typeset(brand: Path, spec: dict, title: str) -> str:
    """Set lines of type as one-color outlined SVG. Each line is a string, or an object that may set its own
    "wght", "scale" (its size as a share of the first line's), "tracking-em" and "leading-em" (its baseline's
    distance below the line above, in the first line's em). Shaped by HarfBuzz with the font's own kerning, and
    every line aligned on its ink at the left."""
    import uharfbuzz as hb

    face = hb.Face(hb.Blob.from_file_path(str(brand / spec["font"])))
    font = hb.Font(face)
    upem = face.upem
    d, xs, ys = [], [], []
    baseline = 0.0
    for n, entry in enumerate(spec["lines"]):
        line = entry if isinstance(entry, dict) else {"text": entry}
        scale = line.get("scale", 1)
        track = line.get("tracking-em", spec["tracking-em"]) * upem
        if n:
            baseline += line.get("leading-em", spec["leading-em"]) * upem
        font.set_variations({"opsz": spec["opsz"], "wght": line.get("wght", spec["wght"])})
        buf = hb.Buffer()
        buf.add_str(line["text"])
        buf.guess_segment_properties()
        hb.shape(font, buf)
        x, glyphs = 0.0, []
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            glyphs.append((info.codepoint, x + pos.x_offset))
            x += pos.x_advance + track
        left = min(gx + font.get_glyph_extents(g).x_bearing for g, gx in glyphs)
        for g, gx in glyphs:
            e = font.get_glyph_extents(g)
            gx = (gx - left) * scale
            xs += [gx + e.x_bearing * scale, gx + (e.x_bearing + e.width) * scale]
            ys += [baseline - e.y_bearing * scale, baseline - (e.y_bearing + e.height) * scale]
            d.append(_outline(font, g, gx, baseline, scale))
    x0, y0 = min(xs), min(ys)
    w, h = max(xs) - x0, max(ys) - y0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:g} {y0:g} {w:g} {h:g}" width="{round(w / upem * 100)}" '
            f'height="{round(h / upem * 100)}">\n<title>{html.escape(title)}</title>\n'
            f'<path fill="currentColor" d="{" ".join(p for p in d if p)}"/>\n</svg>\n')


def set_wordmark(brand: Path) -> int:
    """The decoration kit's wordmark, and every unit mark tokens.json lists (frontiers-brand FR-017, FR-019)."""
    tokens_path = brand / "tokens.json"
    tokens = json.loads(tokens_path.read_text(encoding="utf-8"))
    art = tokens["$extensions"].get(KIT, {}).get("wordmark")
    if art:
        spec = art["set-from"]
        name = " / ".join(l if isinstance(l, str) else l["text"] for l in spec["lines"])
        out = brand / art["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(typeset(brand, spec, f"{brand.name} wordmark, one color, set in {spec['font']} "
                                            f"(opsz {spec['opsz']}, wght {spec['wght']}): {name}"), encoding="utf-8")
        art["finest-detail"] = round(finest_detail(out), 4)
        print(f"{art['file']}: set from {spec['font']}, finest detail {art['finest-detail']}")
    for unit, mark in tokens["$extensions"]["com.intellectualfrontiers.logo"].get("units", {}).items():
        if unit.startswith("$"):
            continue
        out = brand / mark["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(typeset(brand, mark["set-from"], f"{mark['name']}, one color, set in {mark['set-from']['font']}"), encoding="utf-8")
        print(f"{mark['file']}: {mark['name']}")
    tokens_path.write_text(json.dumps(tokens, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


def _outline(font, glyph: int, dx: float, baseline: float, scale: float = 1) -> str:
    """One glyph's outline as SVG path data, scaled, moved to (dx, baseline) and flipped so y grows downward."""
    parts: list[str] = []
    pt = lambda x, y: f"{round(x * scale + dx, 1):g} {round(baseline - y * scale, 1):g}"  # noqa: E731

    class Pen:
        def moveTo(self, p): parts.append("M" + pt(*p))
        def lineTo(self, p): parts.append("L" + pt(*p))
        def qCurveTo(self, *ps): parts.append("Q" + " ".join(pt(*p) for p in ps))
        def curveTo(self, *ps): parts.append("C" + " ".join(pt(*p) for p in ps))
        def closePath(self): parts.append("Z")

    font.draw_glyph_with_pen(glyph, Pen())
    return "".join(parts)


def clean(svg: str, width: int, height: int, title: str) -> str:
    """potrace's SVG, drawn in currentColor at the master's size, without its comment and metadata."""
    viewbox = re.search(r'viewBox="([^"]+)"', svg).group(1)
    body = re.search(r"(<g .*</g>)", svg, re.S).group(1)
    body = body.replace('fill="#000000"', 'fill="currentColor"')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" width="{width}" height="{height}">\n'
            f"<title>{title}</title>\n{body}\n</svg>\n")


def finest_detail(svg: Path) -> float:
    """The thinnest line or gap, as a fraction of the artwork's width.

    The artwork is rendered MEASURE_WIDTH pixels wide. A pixel's local width is its shortest run of like pixels
    across rows, columns and both diagonals (a diagonal run scaled by sqrt 2); a background run counts only where
    ink closes it on both sides, so the open ground around the artwork is not a gap.
    """
    png = run("rsvg-convert", "--width", str(MEASURE_WIDTH), "--background-color", "white", str(svg))
    pgm = subprocess.run(["convert", "png:-", "-threshold", "50%", "-depth", "8", "pgm:-"], input=png, check=True,
                         capture_output=True).stdout
    w, h, pixels = read_pgm(pgm)
    ink = bytes(1 if v < 128 else 0 for v in pixels)
    best = [math.inf] * (w * h)
    lines: list[tuple[list[int], float]] = []
    lines += [(list(range(y * w, y * w + w)), 1.0) for y in range(h)]
    lines += [(list(range(x, w * h, w)), 1.0) for x in range(w)]
    for start in range(-(h - 1), w):  # down-right diagonals
        lines.append(([(y * w + start + y) for y in range(h) if 0 <= start + y < w], math.sqrt(2)))
    for start in range(0, w + h - 1):  # down-left diagonals
        lines.append(([(y * w + start - y) for y in range(h) if 0 <= start - y < w], math.sqrt(2)))
    for idx, step in lines:
        n = len(idx)
        i = 0
        while i < n:
            v = ink[idx[i]]
            j = i
            while j < n and ink[idx[j]] == v:
                j += 1
            closed = v == 1 or (i > 0 and j < n)
            if closed:
                length = (j - i) * step
                for k in range(i, j):
                    p = idx[k]
                    if length < best[p]:
                        best[p] = length
            i = j
    widths = sorted(b for b in best if b != math.inf)
    return widths[int(len(widths) * PERCENTILE / 100)] / w


def read_pgm(data: bytes) -> tuple[int, int, bytes]:
    m = re.match(rb"P5\s+(\d+)\s+(\d+)\s+(\d+)\s", data)
    w, h = int(m.group(1)), int(m.group(2))
    return w, h, data[m.end():m.end() + w * h]


def lab(hex_color: str) -> tuple[float, float, float]:
    rgb = [int(hex_color.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    r, g, b = (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116  # noqa: E731
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def ciede2000(c1: tuple[float, float, float], c2: tuple[float, float, float]) -> float:
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
    rt = (-2 * math.sqrt(cbarp ** 7 / (cbarp ** 7 + 25 ** 7))
          * math.sin(math.radians(60 * math.exp(-(((hbar - 275) / 25) ** 2)))))
    return math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh))


def match(hex_color: str, palettes: list[str]) -> int:
    target = lab(hex_color)
    found = []
    for pal in palettes:
        name = "?"
        for line in Path(pal).read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("Name:"):
                name = line.split(":", 1)[1].strip()
            m = re.match(r"\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)", line)
            if m:
                rgb = "#%02x%02x%02x" % tuple(int(m.group(i)) for i in (1, 2, 3))
                found.append((ciede2000(target, lab(rgb)), name, m.group(4).strip(), rgb))
    for de, name, color, rgb in sorted(found)[:5]:
        print(f"{de:5.1f}  {name}: {color} ({rgb})")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "trace":
        return max(trace(Path(p)) for p in argv[1:])
    if len(argv) >= 2 and argv[0] == "set":
        return max(set_wordmark(Path(p)) for p in argv[1:])
    if len(argv) >= 2 and argv[0] == "measure":
        for p in argv[1:]:
            print(f"{p}: {finest_detail(Path(p)):.4f}")
        return 0
    if len(argv) >= 3 and argv[0] == "match":
        return match(argv[1], argv[2:])
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
