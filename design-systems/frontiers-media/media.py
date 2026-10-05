#!/usr/bin/env python3
"""Make and check media assets (frontiers-media spec FR-009 to FR-012): podcast and episode art, video thumbnails,
title cards, lower thirds and social cards, themed by a brand.

    python3 media.py render JOB.json -o OUT.png [--brand SLUG] [--svg OUT.svg]
    python3 media.py check JOB.json [...] [--brand SLUG]

A job names its format (formats.json), its tone (light or dark) and its text:

    {"format": "video-thumbnail", "tone": "dark", "kicker": "Episode 12",
     "title": "We stop a pilot when the evidence says stop", "imagery": "@first"}

`title` is the asset's claim (the name, on a lower third), `kicker` a short line above it, `byline` a line below it
(the role, on a lower third), and `imagery` a piece of the brand's imagery pool by id, `@first`, or left out.
`render` lays the text out in the brand's sans (measured in fonts/), places the piece no larger than its master and
the lockup no smaller than the brand's minimum, and renders the SVG to PNG with resvg through fonts/ alone (no font
of the machine's). `check` reports every rule a job breaks and exits non-zero on any. Needs the Python packages Pillow
(to measure) and resvg-py (to render): `pip install Pillow resvg-py`, or run it through `agora`, whose locked environment
holds them. Uses the house voice when it is beside this design system.
"""
from __future__ import annotations

import argparse
import base64
import html
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEMS = HERE.parent
DATA = json.loads((HERE / "formats.json").read_text(encoding="utf-8"))
FORMATS, TONES = DATA["formats"], DATA["tones"]
FONTS = HERE / "fonts"
SANS = "Inter"


def _tokens(brand: Path) -> dict:
    return json.loads((brand / "tokens.json").read_text(encoding="utf-8"))


def _value(tokens: dict, role: str) -> str:
    value = tokens["role"][role]["$value"]
    while isinstance(value, str) and value.startswith("{"):
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    return value


def color(expr: str, tokens: dict) -> str:
    """A brand role ("primary") or a mix of two ("text!72!surface"), as frontiers-figures resolves them."""
    if "!" not in expr:
        return _value(tokens, expr).lower()
    a, pct, b = expr.split("!")
    w = int(pct) / 100
    ca, cb = _value(tokens, a), _value(tokens, b)
    return "#" + "".join(f"{round(w * int(ca[i:i + 2], 16) + (1 - w) * int(cb[i:i + 2], 16)):02x}" for i in (1, 3, 5))


def contrast(a: str, b: str) -> float:
    def lum(h: str) -> float:
        c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


_FONT_CACHE: dict = {}


def width(text: str, px: float, bold: bool) -> float:
    from PIL import ImageFont
    key = (bold, round(px * 4))
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = ImageFont.truetype(str(FONTS / ("Inter-Bold.otf" if bold else "Inter-Regular.otf")), size=px * 4)
    return _FONT_CACHE[key].getlength(text) / 4


def wrap(text: str, px: float, bold: bool, max_w: float) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if line and width(trial, px, bold) > max_w:
            lines.append(line)
            line = word
        else:
            line = trial
    return lines + ([line] if line else [])


def fit_title(text: str, fmt: dict, max_w: float) -> tuple[float, list[str]] | None:
    """The largest title size in the format's range at which the title wraps to no more than its lines, or None."""
    hi, lo = fmt["title_px"][1], fmt["title_px"][0]
    px = hi
    while px >= lo:
        lines = wrap(text, px, True, max_w)
        if len(lines) <= fmt["max_lines"] and all(width(l, px, True) <= max_w for l in lines):
            return px, lines
        px -= 2
    return None


def _data(path: Path) -> str:
    """A file as a data URI, so the SVG stands alone."""
    kind = {".png": "png", ".webp": "webp", ".jpg": "jpeg", ".jpeg": "jpeg"}[path.suffix.lower()]
    return f"data:image/{kind};base64," + base64.b64encode(path.read_bytes()).decode()


def _piece(brand: Path, ref: str | None) -> dict | None:
    if not ref:
        return None
    pool = brand / "imagery" / "catalog.json"
    if not pool.exists():
        return None
    pieces = json.loads(pool.read_text(encoding="utf-8"))["pieces"]
    return pieces[0] if ref == "@first" else next((p for p in pieces if p["id"] == ref), None)


def _lockup(brand: Path, background: str, height: float) -> tuple[dict, float, float]:
    """The lockup file for a background at a height, never scaled up from a smaller file (frontiers-brand FR-008)."""
    logo = _tokens(brand)["$extensions"]["com.intellectualfrontiers.logo"]["lockup"]
    files = sorted((f for f in logo["files"] if f["background"] == background and f["file"].endswith(".png")), key=lambda f: f["width"])
    w = height * files[-1]["width"] / files[-1]["height"]
    f = next((f for f in files if f["width"] >= w), files[-1])
    if f["width"] < w:
        w, height = f["width"], f["height"]
    return f, w, height


def layout(job: dict, brand: Path) -> dict:
    """Where everything goes: {svg, boxes, problems}. Boxes are (what, x0, y0, x1, y1) for the checks."""
    fmt = FORMATS[job["format"]]
    tokens = _tokens(brand)
    tone = TONES[job.get("tone", "light")]
    W, H = fmt["size"]
    m = round(min(W, H) * fmt["safe"])
    ink = {k: color(v, tokens) for k, v in tone.items()}
    els, boxes, problems = [], [], []
    if not fmt.get("transparent"):
        els.append(f'<rect width="{W}" height="{H}" fill="{ink["background"]}"/>')

    def text(s: str, x: float, y: float, px: float, bold: bool, fill: str, what: str) -> None:
        els.append(f'<text x="{x:g}" y="{y:g}" font-family="{SANS}" font-size="{px:g}" font-weight="{700 if bold else 400}" fill="{fill}">{html.escape(s)}</text>')
        boxes.append((what, x, y - px * 0.78, x + width(s, px, bold), y + px * 0.22))

    piece = _piece(brand, job.get("imagery")) if fmt["imagery"] else None
    if fmt["imagery"] and job.get("imagery") and not piece:
        problems.append(f"{brand.name} has no imagery piece {job['imagery']!r} (FR-007)")
    top = m
    if fmt["lockup"]:
        lh = max(round(min(W, H) * 0.06), 48)
        f, lw, lh = _lockup(brand, "dark" if job.get("tone") == "dark" else "light", lh)
        els.append(f'<image href="{_data(brand / f["file"])}" x="{m}" y="{m}" width="{lw:g}" height="{lh:g}"/>')
        boxes.append(("lockup", m, m, m + lw, m + lh))
        top = m + lh + m * 0.5

    title_w = W - 2 * m
    if job["format"] == "video-thumbnail" and piece:
        title_w = W * 0.56 - m
    fitted = fit_title(job.get("title", ""), fmt, title_w)
    if not fitted:
        problems.append(f"the title does not fit {fmt['max_lines']} lines at {fmt['title_px'][0]}px or more; shorten it (FR-008)")
        fitted = (fmt["title_px"][0], wrap(job.get("title", ""), fmt["title_px"][0], True, title_w))
    px, lines = fitted
    lead = px * 1.08
    kpx, bpx = fmt.get("kicker_px", 0), fmt.get("byline_px", 0)
    block = len(lines) * lead + (kpx * 1.6 if job.get("kicker") and kpx else 0) + (bpx * 1.7 if job.get("byline") and bpx else 0)

    if job["format"] == "lower-third":
        pad = 32
        tw = max(width(job.get("title", ""), px, True), width(job.get("byline", ""), bpx, False) if job.get("byline") else 0)
        bh = pad * 2 + px + (bpx * 1.5 if job.get("byline") else 0)
        x0, y0 = m, H - m - bh
        els.append(f'<rect x="{x0}" y="{y0:g}" width="{tw + 2 * pad:g}" height="{bh:g}" fill="{ink["background"]}"/>')
        text(job.get("title", ""), x0 + pad, y0 + pad + px * 0.8, px, True, ink["text"], "title")
        if job.get("byline"):
            text(job["byline"], x0 + pad, y0 + pad + px + bpx * 1.2, bpx, False, ink["byline"], "byline")
    else:
        if job["format"] == "video-thumbnail":
            y = (H - block) / 2 + (kpx * 1.6 if job.get("kicker") else 0)
        else:
            y = H - m - block + (kpx * 1.6 if job.get("kicker") else 0)
        if job.get("kicker") and kpx:
            text(job["kicker"], m, y - kpx * 0.6, kpx, True, ink["kicker"], "kicker")
        for i, line in enumerate(lines):
            text(line, m, y + px * 0.8 + i * lead, px, True, ink["text"], "title")
        if job.get("byline") and bpx:
            text(job["byline"], m, y + len(lines) * lead + bpx * 1.2, bpx, False, ink["byline"], "byline")
        if piece:
            text_top = min(b[2] for b in boxes if b[0] in ("title", "kicker"))
            if job["format"] == "video-thumbnail":
                region = (W * 0.56, m, W - m, H - m)
            else:
                region = (m, top, W - m, text_top - m * 0.5)
            pw, ph = piece["pixel_size"]
            scale = min((region[2] - region[0]) / pw, (region[3] - region[1]) / ph, 1.0)
            if scale <= 0:
                problems.append("no room for the imagery above the text; shorten the title (FR-007)")
            else:
                iw, ih = pw * scale, ph * scale
                ix, iy = region[0] + (region[2] - region[0] - iw) / 2, region[1] + (region[3] - region[1] - ih) / 2
                els.insert(1, f'<image href="{_data(brand / "imagery" / piece["file"])}" x="{ix:g}" y="{iy:g}" width="{iw:g}" height="{ih:g}"/>')
                boxes.append(("imagery", ix, iy, ix + iw, iy + ih))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
           + "\n".join(els) + "\n</svg>\n")
    return {"svg": svg, "boxes": boxes, "problems": problems, "px": px, "ink": ink, "margin": m, "size": (W, H)}


def rasterize(svg: str) -> bytes:
    """The SVG as PNG bytes at its own size, set in the fonts of fonts/ and no others (resvg-py)."""
    import resvg_py
    return bytes(resvg_py.svg_to_bytes(svg_string=svg, font_dirs=[str(FONTS)], skip_system_fonts=True))


def render(job: dict, brand: Path, out: Path, svg_out: Path | None = None) -> dict:
    lay = layout(job, brand)
    out.write_bytes(rasterize(lay["svg"]))
    if svg_out:
        svg_out.write_text(lay["svg"], encoding="utf-8")
    return lay


def _voice():
    path = SYSTEMS / "frontiers-written-voice" / "sweep.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("written_voice_sweep", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def check(job: dict, brand: Path) -> list[str]:
    """Every rule the job breaks, as a sentence naming its requirement."""
    if job.get("format") not in FORMATS:
        return [f"no format {job.get('format')!r}; use one of {', '.join(FORMATS)} (FR-004)"]
    if job.get("tone", "light") not in TONES:
        return [f"no tone {job.get('tone')!r}; use light or dark (FR-006)"]
    fmt = FORMATS[job["format"]]
    problems = []
    if not job.get("title"):
        problems.append("no title (FR-008)")
    words = len(job.get("title", "").split())
    if words > fmt["max_title_words"]:
        problems.append(f"a title of {words} words, over the {fmt['max_title_words']} a {fmt['name']} holds (FR-008)")
    if job.get("byline") and not fmt.get("byline_px"):
        problems.append(f"a {fmt['name']} carries no byline (FR-005)")
    if job.get("kicker") and not fmt.get("kicker_px"):
        problems.append(f"a {fmt['name']} carries no kicker (FR-005)")
    if job.get("imagery") and not fmt["imagery"]:
        problems.append(f"a {fmt['name']} carries no imagery (FR-007)")
    lay = layout(job, brand)
    problems += lay["problems"]
    W, H = lay["size"]
    m = lay["margin"]
    for what, x0, y0, x1, y1 in lay["boxes"]:
        if x0 < m - 1 or y0 < m - 1 or x1 > W - m + 1 or y1 > H - m + 1:
            problems.append(f"the {what} runs outside the safe area (FR-005)")
        if fmt.get("keep_clear") and what != "imagery":
            cx0, cy0, cx1, cy1 = fmt["keep_clear"]
            if x0 < cx1 and x1 > cx0 and y0 < cy1 and y1 > cy0:
                problems.append(f"the {what} is where the platform overlays the video's length (FR-005)")
    for role in ("text", "kicker", "byline"):
        r = contrast(lay["ink"][role], lay["ink"]["background"])
        if r < DATA["min_contrast"]:
            problems.append(f"the {role} is {r:.2f}:1 on the {job.get('tone', 'light')} background, below {DATA['min_contrast']}:1 (FR-006)")
    for px in [lay["px"], fmt.get("kicker_px") or 99, fmt.get("byline_px") or 99]:
        if px < DATA["min_text_px"]:
            problems.append(f"text at {px}px, below {DATA['min_text_px']}px (FR-008)")
    for what, x0, y0, x1, y1 in lay["boxes"]:
        if what == "lockup" and x1 - x0 < 100:
            problems.append("the lockup is narrower than the brand's 100px minimum (FR-007)")
    voice = _voice()
    if voice:
        patterns = voice.load([SYSTEMS / "frontiers-written-voice" / "patterns.json"])
        terms = voice.load_terms([SYSTEMS / "frontiers-written-voice" / "terms.json"])
        fails, _ = voice.sweep("\n\n".join(job.get(k, "") for k in ("kicker", "title", "byline")), patterns, terms=terms)
        problems += [f"{f} (FR-009)" for f in fails]
    return problems


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("cmd", choices=("render", "check"))
    ap.add_argument("jobs", nargs="+", type=Path)
    ap.add_argument("-o", "--out", type=Path)
    ap.add_argument("--svg", type=Path)
    ap.add_argument("--brand", default="frontiers-brand")
    args = ap.parse_args(argv)
    brand = SYSTEMS / args.brand
    if args.cmd == "render":
        for path in args.jobs:
            render(json.loads(path.read_text(encoding="utf-8")), brand, args.out or path.with_suffix(".png"), args.svg)
        return 0
    failed = False
    for path in args.jobs:
        for p in check(json.loads(path.read_text(encoding="utf-8")), brand):
            print(f"FAIL {path}: {p}")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
