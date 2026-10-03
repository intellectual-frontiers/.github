#!/usr/bin/env python3
"""Make and check printed signs (frontiers-signage-print spec FR-009 to FR-012): posters, a roll-up banner and event
badges, as vector PDF at their trim size plus bleed, themed by a brand.

    python3 signage.py render JOB.json -o OUT.pdf [--brand SLUG]
    python3 signage.py check JOB.json [...] [--brand SLUG]

A job names its format (formats.json), its tone and its text:

    {"format": "poster-18x24", "tone": "dark", "kicker": "Workshop", "title": "Write the failure test first",
     "details": ["Thursday 10:00", "Main room"], "imagery": "@first"}

On an event badge the title is the wearer's name and the details their role and organization. `render` lays the text
out in the brand's sans (measured in fonts/), places the lockup and any imagery piece no larger than the minimum
print resolution allows, fills the bleed with the background, and renders the SVG to PDF with rsvg-convert through
fonts/. `check` reports every rule a job breaks and exits non-zero on any. Needs Pillow and rsvg-convert; uses the
house voice when it is beside this design system.
"""
from __future__ import annotations

import argparse
import base64
import html
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEMS = HERE.parent
DATA = json.loads((HERE / "formats.json").read_text(encoding="utf-8"))
FORMATS, TONES = DATA["formats"], DATA["tones"]
FONTS = HERE / "fonts"


def _tokens(brand: Path) -> dict:
    return json.loads((brand / "tokens.json").read_text(encoding="utf-8"))


def _value(tokens: dict, role: str) -> str:
    value = tokens["role"][role]["$value"]
    while isinstance(value, str) and value.startswith("{"):
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    return value


def color(expr: str, tokens: dict) -> str:
    """A brand role or a mix of two ("text!78!surface"), resolved as frontiers-figures resolves them."""
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


_FONTS: dict = {}


def width(text: str, pt: float, bold: bool) -> float:
    from PIL import ImageFont
    if bold not in _FONTS:
        _FONTS[bold] = ImageFont.truetype(str(FONTS / ("Inter-Bold.otf" if bold else "Inter-Regular.otf")), size=400)
    return _FONTS[bold].getlength(text) * pt / 400


def wrap(text: str, pt: float, bold: bool, max_w: float) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if line and width(trial, pt, bold) > max_w:
            lines.append(line)
            line = word
        else:
            line = trial
    return lines + ([line] if line else [])


def _data(path: Path) -> str:
    kind = {".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp"}[path.suffix.lower()]
    return f"data:image/{kind};base64," + base64.b64encode(path.read_bytes()).decode()


def _piece(brand: Path, ref: str | None) -> dict | None:
    pool = brand / "imagery" / "catalog.json"
    if not ref or not pool.exists():
        return None
    pieces = json.loads(pool.read_text(encoding="utf-8"))["pieces"]
    return pieces[0] if ref == "@first" else next((p for p in pieces if p["id"] == ref), None)


def _lockup(brand: Path, background: str) -> dict:
    files = _tokens(brand)["$extensions"]["com.intellectualfrontiers.logo"]["lockup"]["files"]
    return max((f for f in files if f["background"] == background and f["file"].endswith(".png")), key=lambda f: f["width"])


def layout(job: dict, brand: Path) -> dict:
    fmt = FORMATS[job["format"]]
    tokens = _tokens(brand)
    tone = job.get("tone", "light")
    ink = {k: color(v, tokens) for k, v in TONES[tone].items()}
    tw, th = fmt["trim"]
    b, m = fmt["bleed"], fmt["safe"]
    W, H = tw + 2 * b, th + 2 * b
    ppi = DATA["min_ppi"]
    els = [f'<rect width="{W:g}" height="{H:g}" fill="{ink["background"]}"/>']
    boxes, problems, ppis = [], [], []

    def text(s: str, x: float, y: float, pt: float, bold: bool, fill: str, what: str) -> None:
        els.append(f'<text x="{x + b:g}" y="{y + b:g}" font-family="Inter" font-size="{pt:g}" font-weight="{700 if bold else 400}" fill="{fill}">{html.escape(s)}</text>')
        boxes.append((what, x, y - pt * 0.78, x + width(s, pt, bold), y + pt * 0.22))

    # The lockup, top left: as wide as a third of the trim, or a badge's half, never below the print resolution.
    f = _lockup(brand, "dark" if tone == "dark" else "light")
    lw = min(tw * (0.5 if job["format"] == "event-badge" else 0.33), f["width"] / ppi * 72)
    lh = lw * f["height"] / f["width"]
    els.append(f'<image href="{_data(brand / f["file"])}" x="{m + b:g}" y="{m + b:g}" width="{lw:g}" height="{lh:g}"/>')
    boxes.append(("lockup", m, m, m + lw, m + lh))
    ppis.append(("lockup", f["width"] / (lw / 72)))

    bottom = th - m - fmt.get("keep_clear_bottom", 0)
    max_w = tw - 2 * m
    px = fmt["title_pt"][1]
    lines = wrap(job.get("title", ""), px, True, max_w)
    while px > fmt["title_pt"][0] and (len(lines) > fmt["max_lines"] or any(width(l, px, True) > max_w for l in lines)):
        px -= 2
        lines = wrap(job.get("title", ""), px, True, max_w)
    if len(lines) > fmt["max_lines"] or any(width(l, px, True) > max_w for l in lines):
        problems.append(f"the title does not fit {fmt['max_lines']} lines at {fmt['title_pt'][0]}pt or more; shorten it (FR-008)")
    lead = px * 1.08
    dpt, kpt = fmt.get("details_pt", 0), fmt.get("kicker_pt", 0)
    details = job.get("details", [])
    details_h = (dpt * 1.25 + (len(details) - 1) * dpt * 1.45 + dpt * 0.22) if details else 0
    block = len(lines) * lead + details_h + (kpt * 1.6 if job.get("kicker") else 0)
    y = bottom - block + (kpt * 1.6 if job.get("kicker") else 0)
    if job.get("kicker") and kpt:
        text(job["kicker"], m, y - kpt * 0.6, kpt, True, ink["kicker"], "kicker")
    for i, line in enumerate(lines):
        text(line, m, y + px * 0.8 + i * lead, px, True, ink["text"], "title")
    for i, d in enumerate(details):
        if width(d, dpt, False) > max_w:
            problems.append(f"the detail {d!r} is wider than the sign at {dpt}pt; shorten it (FR-008)")
        text(d, m, y + len(lines) * lead + dpt * 1.25 + i * dpt * 1.45, dpt, False, ink["details"], "details")

    piece = _piece(brand, job.get("imagery")) if fmt["imagery"] else None
    if fmt["imagery"] and job.get("imagery") and not piece:
        problems.append(f"{brand.name} has no imagery piece {job['imagery']!r} (FR-007)")
    if piece:
        top = m + lh + m * 0.5
        text_top = min(bx[2] for bx in boxes if bx[0] in ("title", "kicker"))
        region = (m, top, tw - m, text_top - m * 0.5)
        pw, ph = piece["pixel_size"]
        most = pw / ppi * 72 / pw  # points per pixel at the minimum resolution
        scale = min((region[2] - region[0]) / pw, (region[3] - region[1]) / ph, most)
        if scale <= 0:
            problems.append("no room for the imagery above the text; shorten the title (FR-007)")
        else:
            iw, ih = pw * scale, ph * scale
            ix, iy = region[0] + (region[2] - region[0] - iw) / 2, region[1] + (region[3] - region[1] - ih) / 2
            els.insert(1, f'<image href="{_data(brand / "imagery" / piece["file"])}" x="{ix + b:g}" y="{iy + b:g}" width="{iw:g}" height="{ih:g}"/>')
            boxes.append(("imagery", ix, iy, ix + iw, iy + ih))
            ppis.append(("imagery", pw / (iw / 72)))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W / 72:g}in" height="{H / 72:g}in" viewBox="0 0 {W:g} {H:g}">\n'
           + "\n".join(els) + "\n</svg>\n")
    return {"svg": svg, "boxes": boxes, "problems": problems, "ink": ink, "pt": px, "ppis": ppis, "trim": (tw, th),
            "safe": m, "bottom": bottom, "size": (W, H)}


def render(job: dict, brand: Path, out: Path) -> dict:
    lay = layout(job, brand)
    with tempfile.TemporaryDirectory() as tmp:
        conf = Path(tmp) / "fonts.conf"
        conf.write_text(f'<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>{FONTS}</dir>'
                        f"<cachedir>{tmp}/cache</cachedir></fontconfig>", encoding="utf-8")
        src = Path(tmp) / "sign.svg"
        src.write_text(lay["svg"], encoding="utf-8")
        subprocess.run(["rsvg-convert", "--unlimited", "-f", "pdf", "-o", str(out), str(src)], check=True,
                       env={**os.environ, "FONTCONFIG_FILE": str(conf)})
    return lay


def _voice():
    path = SYSTEMS / "frontiers-written-voice" / "sweep.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("written_voice_sweep", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _a(name: str) -> str:
    return ("an " if name[0] in "aeiou" else "a ") + name


def check(job: dict, brand: Path) -> list[str]:
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
        problems.append(f"a title of {words} words, over the {fmt['max_title_words']} {_a(fmt['name'])} holds (FR-008)")
    if len(job.get("details", [])) > fmt["max_details"]:
        problems.append(f"{len(job['details'])} details, over the {fmt['max_details']} {_a(fmt['name'])} holds (FR-008)")
    if job.get("kicker") and not fmt.get("kicker_pt"):
        problems.append(f"{_a(fmt['name'])} carries no kicker (FR-005)")
    if job.get("imagery") and not fmt["imagery"]:
        problems.append(f"{_a(fmt['name'])} carries no imagery (FR-007)")
    lay = layout(job, brand)
    problems += lay["problems"]
    tw, th = lay["trim"]
    m = lay["safe"]
    for what, x0, y0, x1, y1 in lay["boxes"]:
        if x0 < m - 0.5 or y0 < m - 0.5 or x1 > tw - m + 0.5 or y1 > th - m + 0.5:
            problems.append(f"the {what} runs outside the safe area (FR-005)")
        if what != "imagery" and y1 > lay["bottom"] + 0.5:
            problems.append(f"the {what} runs into the band the banner's stand hides (FR-005)")
    for what, ppi in lay["ppis"]:
        if ppi < DATA["min_ppi"] - 0.5:
            problems.append(f"the {what} prints at {ppi:.0f} pixels per inch, below {DATA['min_ppi']} (FR-007)")
    for role in ("text", "kicker", "details"):
        r = contrast(lay["ink"][role], lay["ink"]["background"])
        if r < DATA["min_contrast"]:
            problems.append(f"the {role} is {r:.2f}:1 on the {job.get('tone', 'light')} background (FR-006)")
    for pt in (lay["pt"], fmt.get("details_pt") or 99, fmt.get("kicker_pt") or 99):
        if pt < DATA["min_text_pt"]:
            problems.append(f"text at {pt}pt, below {DATA['min_text_pt']}pt (FR-008)")
    voice = _voice()
    if voice:
        patterns = voice.load([SYSTEMS / "frontiers-written-voice" / "patterns.json"])
        terms = voice.load_terms([SYSTEMS / "frontiers-written-voice" / "terms.json"])
        fails, _ = voice.sweep("\n\n".join([job.get("kicker", ""), job.get("title", ""), *job.get("details", [])]), patterns, terms=terms)
        problems += [f"{f} (FR-009)" for f in fails]
    return problems


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("cmd", choices=("render", "check"))
    ap.add_argument("jobs", nargs="+", type=Path)
    ap.add_argument("-o", "--out", type=Path)
    ap.add_argument("--brand", default="frontiers-brand")
    args = ap.parse_args(argv)
    brand = SYSTEMS / args.brand
    if args.cmd == "render":
        for path in args.jobs:
            render(json.loads(path.read_text(encoding="utf-8")), brand, args.out or path.with_suffix(".pdf"))
        return 0
    failed = False
    for path in args.jobs:
        for p in check(json.loads(path.read_text(encoding="utf-8")), brand):
            print(f"FAIL {path}: {p}")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
