#!/usr/bin/env python3
"""Build and check a slide deck (frontiers-slides spec FR-010 to FR-013).

    python3 deck.py build DECK.md [-o DECK.html] [--brand SLUG] [--inline]
    python3 deck.py check DECK.md [...] [--brand SLUG]

A deck is Markdown: front matter, then slides separated by a line holding only `---`.

    ---
    title: We stop when the evidence says stop
    short: Stopping rules
    author: A. Speaker
    date: 2026-10-03
    ---
    [statement]
    # Most pilots never had a way to fail.
    ---
    [figure dark]
    # Three signals end a pilot
    ![The stop signals](figures/stop-signals.svg)
    Source: Our 2025 pilot reviews.
    Notes:
    Walk through the three, left to right.

A slide's first line may name its layout and tone in brackets: title, section, statement, content (the default),
figure, two-column, quote or end, then `dark` for the dark tone. `#` is the headline, `-` a point, `>` a quoted line
and `^` its attribution, `![alt](file)` a figure, `Source:` its source, `|||` the break between two columns, and
everything after `Notes:` the speaker notes. Text is escaped; **bold**, *emphasis* and `code` are the only markup.

`build` writes HTML linking the brand's brand.css and this design system's stylesheet and viewer, found beside this
design system (as a consumer vendors them); `--inline` writes one self-contained file instead. A figure that is
frontiers-figures' semantic SVG is themed by the brand (its on-dark variant on a dark slide) and inlined, so it is set
in the deck's own type. `check` reports every rule a deck breaks and exits non-zero on any. Standard library only;
frontiers-figures and the house voice are used when they are beside it.
"""
from __future__ import annotations

import argparse
import base64
import html
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEMS = HERE.parent
LAYOUTS = ("title", "section", "statement", "content", "figure", "two-column", "quote", "end")
DARK_BY_DEFAULT = {"section"}
NEEDS_HEADLINE = {"title", "section", "statement", "content", "figure", "two-column", "end"}
LIMITS = json.loads((HERE / "limits.json").read_text(encoding="utf-8"))
COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(")


def _module(name: str, path: Path):
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def parse(text: str) -> tuple[dict, list[dict]]:
    """The deck's front matter and its slides, each {layout, tone, headline, subtitle, points, paras, quote,
    attribution, figure, alt, source, columns, notes, words}."""
    meta: dict = {}
    body = text
    if text.startswith("---\n"):
        end = text.index("\n---\n", 4)
        for line in text[4:end].splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = text[end + 5:]
    slides = []
    for n, chunk in enumerate(re.split(r"^---\s*$", body, flags=re.M)):
        lines = [l.rstrip() for l in chunk.strip("\n").splitlines()]
        if not any(l.strip() for l in lines):
            continue
        s = {"layout": "title" if not slides else "content", "tone": "", "headline": "", "subtitle": "", "points": [],
             "paras": [], "quote": [], "attribution": "", "figure": "", "alt": "", "source": "", "columns": [[]],
             "notes": []}
        if lines and (m := re.match(r"^\[([\w-]+)(?:\s+(dark|light))?\]$", lines[0].strip())):
            s["layout"], s["tone"] = m.group(1), m.group(2) or ""
            lines = lines[1:]
        in_notes = False
        for line in lines:
            st = line.strip()
            if in_notes:
                s["notes"].append(st)
            elif st == "Notes:":
                in_notes = True
            elif st == "|||":
                s["columns"].append([])
            elif st.startswith("# "):
                s["headline"] = st[2:].strip()
            elif st.startswith("## "):
                s["subtitle"] = st[3:].strip()
            elif st.startswith("- "):
                s["points"].append(st[2:].strip())
                s["columns"][-1].append(("li", st[2:].strip()))
            elif st.startswith("> "):
                s["quote"].append(st[2:].strip())
            elif st.startswith("^ "):
                s["attribution"] = st[2:].strip()
            elif m := re.match(r"^!\[(.*)\]\((.+)\)$", st):
                s["alt"], s["figure"] = m.group(1), m.group(2)
            elif st.startswith("Source:"):
                s["source"] = st[7:].strip()
            elif st:
                s["paras"].append(st)
                s["columns"][-1].append(("p", st))
        if not s["tone"]:
            s["tone"] = "dark" if s["layout"] in DARK_BY_DEFAULT else "light"
        text_words = " ".join(s["points"] + s["paras"] + s["quote"])
        s["words"] = len(text_words.split())
        slides.append(s)
    return meta, slides


def inline(text: str) -> str:
    t = html.escape(text, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    return re.sub(r"\*([^*]+)\*", r"<em>\1</em>", t)


def _figure(src: Path, brand: Path, dark: bool, fid: str) -> str:
    """A frontiers-figures figure themed by the brand and inlined, its stylesheet scoped to this figure alone."""
    svg = src.read_text(encoding="utf-8")
    theme = _module("figures_theme", SYSTEMS / "frontiers-figures" / "theme.py")
    if theme and re.search(r'class="[^"]*\b[fsc]-[a-z-]+', svg):
        svg = theme.apply(svg, brand, "on-dark" if dark else "default")
        svg = re.sub(r"<style([^>]*)>(.*?)</style>",
                     lambda m: f"<style{m.group(1)}>" + re.sub(r"(^|})\s*([^{}@]+?)\s*{",
                                                                  lambda r: r.group(1) + ", ".join(f"#{fid} {sel.strip()}" for sel in r.group(2).split(",")) + " {",
                                                                  m.group(2)) + "</style>", svg, flags=re.S)
    svg = re.sub(r"<\?xml[^>]*>\s*", "", svg)
    return re.sub(r"<svg\b", f'<svg id="{fid}" role="img"', svg, count=1)


def _lockup(brand: Path, background: str) -> str:
    files = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))["$extensions"]["com.intellectualfrontiers.logo"]["lockup"]["files"]
    pngs = sorted((f for f in files if f["background"] == background and f["file"].endswith(".png")), key=lambda f: f["width"])
    return next((f for f in pngs if f["width"] >= 650), pngs[-1])["file"]


def build(deck: Path, out: Path, brand_slug: str, single: bool) -> str:
    meta, slides = parse(deck.read_text(encoding="utf-8"))
    brand = SYSTEMS / brand_slug
    rel = lambda p: os.path.relpath(p, out.parent).replace(os.sep, "/")  # noqa: E731
    short = meta.get("short") or meta.get("title", "")
    parts = []
    for n, s in enumerate(slides, 1):
        dark = s["tone"] == "dark"
        attrs = f' data-layout="{s["layout"]}"' + (' data-tone="dark"' if dark else "")
        inner = []
        if s["layout"] in ("title", "end"):
            logo = brand / _lockup(brand, "dark" if dark else "light")
            src = "data:image/png;base64," + base64.b64encode(logo.read_bytes()).decode() if single else rel(logo)
            inner.append(f'<img class="lockup" src="{src}" alt="{html.escape(meta.get("brand-name", "Intellectual Frontiers"))}" '
                         f'data-theme-logo="{"dark" if dark else "light"}" data-width="326">')
        if s["layout"] == "section":
            inner.append(f'<p class="section-number">{inline(s["subtitle"] or f"Part {n}")}</p>')
        if s["headline"]:
            inner.append(f"<h1>{inline(s['headline'])}</h1>")
        if s["layout"] == "title":
            who = " · ".join(x for x in (meta.get("author", ""), meta.get("date", "")) if x)
            if s["subtitle"]:
                inner.append(f'<p class="deck-meta">{inline(s["subtitle"])}</p>')
            if who:
                inner.append(f'<p class="deck-meta">{inline(who)}</p>')
        elif s["layout"] == "quote":
            inner.append("<blockquote>" + "".join(f"<p>{inline(q)}</p>" for q in s["quote"]) + "</blockquote>")
            if s["attribution"]:
                inner.append(f'<p class="attribution">{inline(s["attribution"])}</p>')
        elif s["layout"] == "two-column":
            cols = []
            for col in s["columns"]:
                items, ul = [], []
                for kind, txt in col + [("end", "")]:
                    if kind == "li":
                        ul.append(f"<li>{inline(txt)}</li>")
                        continue
                    if ul:
                        items.append("<ul>" + "".join(ul) + "</ul>")
                        ul = []
                    if kind == "p":
                        items.append(f"<p>{inline(txt)}</p>")
                cols.append("<div>" + "".join(items) + "</div>")
            inner.append('<div class="columns">' + "".join(cols) + "</div>")
        elif s["layout"] != "end" or s["paras"] or s["points"]:
            inner += [f"<p>{inline(p)}</p>" for p in s["paras"]]
            if s["points"]:
                inner.append("<ul>" + "".join(f"<li>{inline(p)}</li>" for p in s["points"]) + "</ul>")
        if s["figure"]:
            src = (deck.parent / s["figure"]).resolve()
            if src.suffix == ".svg":
                fig = _figure(src, brand, dark, f"fig-{n}")
                if s["alt"]:
                    fig = re.sub(r"<svg\b", f'<svg aria-label="{html.escape(s["alt"])}"', fig, count=1)
            else:
                url = f"data:image/{src.suffix[1:]};base64," + base64.b64encode(src.read_bytes()).decode() if single else rel(src)
                fig = f'<img src="{url}" alt="{html.escape(s["alt"])}">'
            inner.append(f'<div class="figure">{fig}</div>')
        if s["source"]:
            inner.append(f'<p class="source">Source: {inline(s["source"])}</p>')
        inner.append(f'<div class="footer"><span>{inline(short)}</span><span>{n}</span></div>')
        if s["notes"]:
            paras = " ".join(x if x else "\n" for x in s["notes"]).split("\n")
            inner.append('<div class="notes">' + "".join(f"<p>{inline(x.strip())}</p>" for x in paras if x.strip()) + "</div>")
        parts.append(f'<section class="slide"{attrs} aria-label="Slide {n}">\n' + "\n".join(inner) + "\n</section>")

    if single:
        def embed_css(path: Path) -> str:
            css = path.read_text(encoding="utf-8")
            return re.sub(r'url\("(\.\./fonts/[^"]+)"\)', lambda m: 'url("data:font/woff2;base64,'
                          + base64.b64encode((path.parent / m.group(1)).read_bytes()).decode() + '")', css)
        head = (f"<style data-theme=\"{brand_slug}\">{(brand / 'brand.css').read_text(encoding='utf-8')}</style>\n"
                f"<style>{embed_css(HERE / 'css' / 'slides.css')}</style>\n"
                f"<script defer>{(HERE / 'js' / 'deck.js').read_text(encoding='utf-8')}</script>")
    else:
        head = (f'<link rel="stylesheet" data-theme="{brand_slug}" href="{rel(brand / "brand.css")}">\n'
                f'<link rel="stylesheet" href="{rel(HERE / "css" / "slides.css")}">\n'
                f'<script src="{rel(HERE / "js" / "deck.js")}" defer></script>')
    page = (f'<!doctype html>\n<html lang="{meta.get("lang", "en")}">\n<head>\n<meta charset="utf-8">\n'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{html.escape(meta.get("title", deck.stem))}</title>\n'
            f"{head}\n</head>\n<body>\n" + "\n".join(parts) + "\n</body>\n</html>\n")
    out.write_text(page, encoding="utf-8")
    return page


def check(deck: Path, brand_slug: str) -> list[str]:
    """Every rule the deck breaks, as a sentence naming its requirement."""
    text = deck.read_text(encoding="utf-8")
    meta, slides = parse(text)
    problems = []
    if not meta.get("title"):
        problems.append("the deck has no title in its front matter (FR-010)")
    if not slides or slides[0]["layout"] != "title":
        problems.append("the first slide is not the title slide (FR-005)")
    if len(slides) > LIMITS["max_slides"]:
        problems.append(f"{len(slides)} slides, more than {LIMITS['max_slides']} (FR-011)")
    written = _module("written_voice_sweep", SYSTEMS / "frontiers-written-voice" / "sweep.py")
    spoken = _module("spoken_voice_sweep", SYSTEMS / "frontiers-spoken-voice" / "sweep.py")
    for n, s in enumerate(slides, 1):
        at = f"slide {n} ({s['layout']})"
        if s["layout"] not in LAYOUTS:
            problems.append(f"{at}: no layout called {s['layout']!r}; use one of {', '.join(LAYOUTS)} (FR-005)")
            continue
        if s["layout"] in NEEDS_HEADLINE and not s["headline"]:
            problems.append(f"{at}: no headline; every {s['layout']} slide states its claim (FR-006)")
        words = len(s["headline"].split())
        most = LIMITS["headline_words"].get(s["layout"], LIMITS["headline_words"]["default"])
        if words > most:
            problems.append(f"{at}: a headline of {words} words, over {most} (FR-006)")
        most = LIMITS["body_words"].get(s["layout"], LIMITS["body_words"]["default"])
        if s["words"] > most:
            problems.append(f"{at}: {s['words']} words of body text, over {most} (FR-011)")
        if len(s["points"]) > LIMITS["max_points"]:
            problems.append(f"{at}: {len(s['points'])} points, over {LIMITS['max_points']} (FR-011)")
        for p in s["points"]:
            if len(p.split()) > LIMITS["point_words"]:
                problems.append(f"{at}: a point of {len(p.split())} words, over {LIMITS['point_words']}: {p[:60]!r} (FR-011)")
        if s["layout"] == "figure" and not s["figure"]:
            problems.append(f"{at}: a figure slide with no figure (FR-007)")
        if s["figure"]:
            src = deck.parent / s["figure"]
            if not src.exists():
                problems.append(f"{at}: the figure {s['figure']} does not exist (FR-007)")
            elif src.suffix == ".svg" and (COLOR.search(re.sub(r"<style.*?</style>", "", src.read_text(encoding="utf-8"), flags=re.S))
                                           or not re.search(r'class="[^"]*\b[fsc]-', src.read_text(encoding="utf-8"))):
                problems.append(f"{at}: {s['figure']} is not frontiers-figures' semantic SVG; draw it with the figure kit (FR-007)")
            if not s["alt"]:
                problems.append(f"{at}: the figure has no alternative text (FR-009)")
        if s["layout"] == "quote" and not s["attribution"]:
            problems.append(f"{at}: a quotation with no attribution (FR-005)")
        if s["layout"] in ("content", "figure", "two-column") and not s["notes"]:
            problems.append(f"{at}: no speaker notes; say what the slide does not (FR-012)")
        if COLOR.search(" ".join([s["headline"], *s["points"], *s["paras"]])):
            problems.append(f"{at}: a color in the slide's text; colors come from the theme (FR-004)")
        if written:
            on_slide = "\n\n".join([s["headline"], s["subtitle"], *s["points"], *s["paras"], *s["quote"], s["source"]])
            patterns = written.load([SYSTEMS / "frontiers-written-voice" / "patterns.json"])
            terms = written.load_terms([SYSTEMS / "frontiers-written-voice" / "terms.json"])
            fails, _ = written.sweep(on_slide, {**patterns, "max_seesaws": 99}, terms=terms)
            problems += [f"{at}: {f} (FR-013)" for f in fails]
        if spoken and s["notes"]:
            fails, _ = spoken.sweep(" ".join(s["notes"]))
            problems += [f"{at} notes: {f} (FR-013)" for f in fails]
    return problems


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("cmd", choices=("build", "check"))
    ap.add_argument("decks", nargs="+", type=Path)
    ap.add_argument("-o", "--out", type=Path)
    ap.add_argument("--brand", default="frontiers-brand")
    ap.add_argument("--inline", action="store_true")
    args = ap.parse_args(argv)
    if args.cmd == "build":
        for deck in args.decks:
            build(deck, args.out or deck.with_suffix(".html"), args.brand, args.inline)
        return 0
    failed = False
    for deck in args.decks:
        for p in check(deck, args.brand):
            print(f"FAIL {deck}: {p}")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
