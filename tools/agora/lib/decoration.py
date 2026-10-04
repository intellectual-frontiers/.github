#!/usr/bin/env python3
"""A brand's decoration kit: make it, measure it, and record who verified its inks (0014-design-systems FR-047;
frontiers-brand FR-017; 0042-agora FR-006).

`trace`: for the lockup and the icon in the kit (tokens.json $extensions["com.intellectualfrontiers.decoration"]),
trace the raster master its "traced-from" names into one-color outlined SVG at its "file", then measure its finest
detail and write it back to tokens.json. The trace is mechanical and repeatable: the master is composited on white,
read as luminance, enlarged by "scale" (Lanczos), cut at "threshold" (the share of full ink a pixel needs to print) and
traced by potrace's algorithm (the potracer package), dropping specks smaller than "speckle-px" master pixels. Nothing is
drawn, retouched or generated.

`set`: for the wordmark in the kit and every unit mark the brand's logo lists, set the name in the face its "set-from"
names (a font in the brand's fonts/, at its optical size and weight, tracked by "tracking-em", one line per entry of
"lines", baselines "leading-em" apart and ink-aligned on the left) and write it as one-color outlined SVG at its
"file", then measure its finest detail and write it back to tokens.json. It is typesetting, shaped by HarfBuzz with the
font's own kerning: nothing is drawn. Needs the uharfbuzz package.

`record_ink`: record that an ink's matches were checked against the physical guide and card (frontiers-brand FR-017,
briefs/ink-verification.md): its spot-color name and thread number as checked, who checked them and when, and
verified: true, after which goods may be ordered in it.

`finest_detail`: an SVG's thinnest line or gap, as a fraction of its width. `match`: the nearest colors to a color in
GIMP palettes (a thread chart, a spot-color guide), by CIEDE2000, to propose an ink's matches; a match is a candidate
until it is checked against the physical card.

Standard library and four pinned packages of the decoration group's lock, each imported where it is used: Pillow reads and
cuts the masters, potracer traces them, resvg-py renders what is measured, uharfbuzz sets the type. No program of the host
is run, so the bytes depend on the locked versions alone (0025-tooling-environment FR-026). Every function returns what it
would write; the commands write it (`--dry-run` shows it).
"""
from __future__ import annotations

import html
import io
import json
import math
import re
import tempfile
from pathlib import Path

KIT = "com.intellectualfrontiers.decoration"
# The finest detail is this percentile of every inked or enclosed pixel's local width, so a few stray pixels at a
# path's tip do not stand for the artwork's real lines and gaps.
PERCENTILE = 2
# The measure renders the artwork this many pixels wide.
MEASURE_WIDTH = 2400


def dumps(tokens: dict) -> str:
    return json.dumps(tokens, indent=2, ensure_ascii=False) + "\n"


def finest_of(text: str) -> float:
    """The finest detail of SVG text, measured from a scratch file."""
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "art.svg"
        f.write_text(text, encoding="utf-8")
        return finest_detail(f)


def trace(brand: Path, tokens: dict) -> tuple[dict[Path, str], list[str]]:
    """The lockup's and the icon's traced SVG, and `tokens` updated with each one's finest detail."""
    kit = tokens["$extensions"][KIT]
    files: dict[Path, str] = {}
    notes: list[str] = []
    for part in ("lockup", "icon"):
        art = kit[part]
        if "traced-from" not in art:  # a part drawn by hand (the example brand's) is not made by this command
            continue
        src = art["traced-from"]
        master = brand / src["file"]
        width, height, svg = trace_master(master, int(src["scale"]), float(src["threshold"]), int(src["speckle-px"]))
        text = clean(svg, width, height, f"{brand.name} {part}, one color, traced from {src['file']}")
        files[brand / art["file"]] = text
        art["finest-detail"] = round(finest_of(text), 4)
        notes.append(f"{art['file']}: traced from {src['file']}, finest detail {art['finest-detail']}")
    return files, notes


def trace_master(master: Path, scale: int, threshold: float, speckle_px: int) -> tuple[int, int, str]:
    """The master's pixel size, and its trace as SVG: composited on white, read as Rec. 709 luminance, enlarged by `scale`
    (Lanczos), inked where a pixel is not lighter than 1 - `threshold` of full, and traced by potrace's algorithm, dropping
    specks of `speckle_px` master pixels or fewer."""
    import numpy
    import potrace
    from PIL import Image

    with Image.open(master) as raw:
        art = raw.convert("RGBA")
    width, height = art.size
    flat = Image.new("RGBA", art.size, "white")
    flat.alpha_composite(art)
    gray = flat.convert("RGB").convert("L", matrix=(0.2126, 0.7152, 0.0722, 0))
    big = gray.resize((width * scale, height * scale), Image.LANCZOS)
    cut = (1 - threshold) * 255
    light = numpy.asarray(big) > cut  # potracer takes the light pixels and traces the rest
    curves = potrace.Bitmap(light).trace(turdsize=speckle_px * scale * scale, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                                       alphamax=1.0, opticurve=True, opttolerance=0.2)
    # Integer tenths of a bitmap pixel, drawn relative to the last rounded point, so that no rounding drifts.
    tenth = lambda p: (round(p.x * 10), round(p.y * 10))  # noqa: E731
    d = []
    for curve in curves:
        x, y = tenth(curve.start_point)
        d.append(f"M{x} {y}")
        for seg in curve.segments:
            pts = [tenth(p) for p in ((seg.c, seg.end_point) if seg.is_corner else (seg.c1, seg.c2, seg.end_point))]
            rel = []
            for px, py in pts:
                rel += [px - x, py - y]
            if seg.is_corner:
                d.append("l" + " ".join(map(str, rel[:2])) + "l" + " ".join(map(str, (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]))))
            else:
                d.append("c" + " ".join(map(str, rel)))
            x, y = pts[-1]
        d.append("z")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width * scale} {height * scale}">\n'
           f'<g transform="scale(0.1)" fill="#000000" stroke="none">\n<path d="{"".join(d)}" fill-rule="evenodd"/>\n</g>\n</svg>\n')
    return width, height, svg


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


def set_wordmark(brand: Path, tokens: dict) -> tuple[dict[Path, str], list[str]]:
    """The decoration kit's wordmark, and every unit mark tokens.json lists (frontiers-brand FR-017, FR-019)."""
    files: dict[Path, str] = {}
    notes: list[str] = []
    art = tokens["$extensions"].get(KIT, {}).get("wordmark")
    if art:
        spec = art["set-from"]
        name = " / ".join(l if isinstance(l, str) else l["text"] for l in spec["lines"])
        text = typeset(brand, spec, f"{brand.name} wordmark, one color, set in {spec['font']} "
                                    f"(opsz {spec['opsz']}, wght {spec['wght']}): {name}")
        files[brand / art["file"]] = text
        art["finest-detail"] = round(finest_of(text), 4)
        notes.append(f"{art['file']}: set from {spec['font']}, finest detail {art['finest-detail']}")
    for unit, mark in tokens["$extensions"]["com.intellectualfrontiers.logo"].get("units", {}).items():
        if unit.startswith("$"):
            continue
        files[brand / mark["file"]] = typeset(brand, mark["set-from"], f"{mark['name']}, one color, set in {mark['set-from']['font']}")
        notes.append(f"{mark['file']}: {mark['name']}")
    return files, notes


def generate(brand: Path, only: str | None = None) -> tuple[dict[Path, str], list[str]]:
    """The kit's files (traced and set SVG, and tokens.json with the measured finest details), and a line for each."""
    tokens_path = brand / "tokens.json"
    tokens = json.loads(tokens_path.read_text(encoding="utf-8"))
    files: dict[Path, str] = {}
    notes: list[str] = []
    for what, fn in (("trace", trace), ("set", set_wordmark)):
        if only in (None, what):
            f, n = fn(brand, tokens)
            files.update(f)
            notes += n
    files[tokens_path] = dumps(tokens)
    return files, notes


def kit_of(tokens: dict) -> dict:
    return tokens.get("$extensions", {}).get(KIT, {})


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
    """The trace's SVG, drawn in currentColor at the master's size, without its metadata."""
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
    import resvg_py
    from PIL import Image

    png = bytes(resvg_py.svg_to_bytes(svg_path=str(svg), width=MEASURE_WIDTH, background="white", skip_system_fonts=True))
    with Image.open(io.BytesIO(png)) as raw:
        gray = raw.convert("L")  # the art is rendered on white, so there is no alpha to flatten
    w, h = gray.size
    ink = bytes(1 if v < 128 else 0 for v in gray.tobytes())
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


def palette_colors(palettes: list[str | Path]) -> list[tuple[str, str, str]]:
    """Every color of GIMP palettes as (palette name, color name, #rrggbb)."""
    found = []
    for pal in palettes:
        name = "?"
        for line in Path(pal).read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("Name:"):
                name = line.split(":", 1)[1].strip()
            m = re.match(r"\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)", line)
            if m:
                found.append((name, m.group(4).strip(), "#%02x%02x%02x" % tuple(int(m.group(i)) for i in (1, 2, 3))))
    return found


def match(hex_color: str, palettes: list[str | Path], n: int = 5) -> list[dict]:
    """The `n` nearest colors to `hex_color` in the palettes, by CIEDE2000."""
    target = lab(hex_color)
    found = sorted((ciede2000(target, lab(rgb)), name, color, rgb) for name, color, rgb in palette_colors(palettes))
    return [{"delta-e": round(de, 1), "palette": name, "color": color, "rgb": rgb} for de, name, color, rgb in found[:n]]


def record_ink(tokens: dict, ink: str, spot: str, thread: str, by: str, on: str) -> None:
    """Mark an ink verified in `tokens`: its spot-color name and thread number as checked against the card, by whom, when."""
    import datetime
    datetime.date.fromisoformat(on)
    entry = kit_of(tokens)["inks"][ink]
    entry["spot"]["name"] = spot
    # A thread's color name belongs to its number; a different number checked against the card drops the old name.
    entry["thread"] = {"system": entry["thread"]["system"], "number": thread}
    entry.update({"verified": True, "verified-by": by, "verified-on": on})
