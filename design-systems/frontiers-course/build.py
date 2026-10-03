#!/usr/bin/env python3
"""Compile a course to its delivery targets (frontiers-course spec FR-013 to FR-017).

    python3 build.py web   COURSE_DIR -o OUT_DIR  [--brand SLUG]
    python3 build.py olx   COURSE_DIR -o OUT.tar.gz --org ORG [--brand SLUG]
    python3 build.py cmi5  COURSE_DIR -o OUT.zip --iri https://... [--brand SLUG]

Every target is built from course.py's model of a course that passes course.py check, and refused otherwise.

  web   a static site: a home page, one page a lesson or assessment, the brand's stylesheet and lockup, the course
        stylesheet themed by web.json, and quiz.js, which grades items in the browser.
  olx   an Open edX course export (OLX) as a tarball Studio imports: a chapter a unit, a subsection a lesson or
        assessment, html, video, problem and discussion components, the course's files in static/, and a grading
        policy for its graded assessments.
  cmi5  a cmi5 course package: cmi5.xml (a block a unit, an assignable unit a lesson or assessment, the outcomes as
        objectives, every id under --iri) and the web edition, whose pages report to the LMS through cmi5.js.

Figures are themed by the brand with frontiers-figures (fonts embedded when fontTools is installed). Standard
library only otherwise.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import html
import importlib.util
import io
import json
import re
import shutil
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path
from xml.sax.saxutils import quoteattr

HERE = Path(__file__).resolve().parent
SYSTEMS = HERE.parent
sys.path.insert(0, str(HERE))
import course as reader  # noqa: E402

WEB = json.loads((HERE / "web.json").read_text(encoding="utf-8"))
EPOCH = (1980, 1, 1, 0, 0, 0)


class BuildError(ValueError):
    pass


def _theme():
    path = SYSTEMS / "frontiers-figures" / "theme.py"
    spec = importlib.util.spec_from_file_location("figures_theme", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load(src: Path) -> dict:
    problems = reader.check(src)
    if problems:
        raise BuildError(f"{src} does not pass course.py check:\n  " + "\n  ".join(problems))
    return reader.model(src)


# ── Markdown ─────────────────────────────────────────────────────────────────────────────────────────────────────


def inline(text: str, asset) -> str:
    out, pos = [], 0
    for m in re.finditer(r"!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)", text):
        out.append(_marks(text[pos:m.start()]))
        if m.group(2) is not None:
            out.append(f'<img src="{html.escape(asset(m.group(2)))}" alt="{html.escape(m.group(1))}">')
        else:
            out.append(f'<a href="{html.escape(m.group(4))}">{_marks(m.group(3))}</a>')
        pos = m.end()
    out.append(_marks(text[pos:]))
    return "".join(out)


def _marks(text: str) -> str:
    t = html.escape(text, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    return re.sub(r"(?<![*\w])\*([^*]+)\*(?![*\w])", r"<em>\1</em>", t)


def markdown(body: str, asset, shift: int = 0) -> str:
    """The Markdown a course is written in, as HTML: headings, paragraphs, lists, quotations, figures."""
    out, para, lst, quote = [], [], None, []

    def flush():
        nonlocal lst
        if para:
            text = " ".join(para)
            if re.fullmatch(r"!\[[^\]]*\]\([^)\s]+\)", text):
                out.append(f"<figure>{inline(text, asset)}</figure>")
            else:
                out.append(f"<p>{inline(text, asset)}</p>")
            para.clear()
        if lst:
            tag, items = lst
            out.append(f"<{tag}>" + "".join(f"<li>{inline(i, asset)}</li>" for i in items) + f"</{tag}>")
            lst = None
        if quote:
            out.append(f"<blockquote><p>{inline(' '.join(quote), asset)}</p></blockquote>")
            quote.clear()
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            flush()
        elif m := re.match(r"^(#{2,6}) (.+)$", line):
            flush()
            n = min(len(m.group(1)) + shift, 6)
            out.append(f"<h{n}>{inline(m.group(2), asset)}</h{n}>")
        elif m := re.match(r"^(?:[-*]|(\d+)\.) (.+)$", line):
            tag = "ol" if m.group(1) else "ul"
            if para or quote or (lst and lst[0] != tag):
                flush()
            lst = lst or (tag, [])
            lst[1].append(m.group(2))
        elif line.startswith("> "):
            if para or lst:
                flush()
            quote.append(line[2:])
        elif lst and raw.startswith("  "):
            lst[1][-1] += " " + line
        else:
            if lst or quote:
                flush()
            para.append(line)
    flush()
    return "\n".join(out)


# ── files a course carries ───────────────────────────────────────────────────────────────────────────────────────


def asset_name(unit: str, ref: str) -> str:
    return f"{unit}-{ref.replace('/', '-')}"


def media(src: Path, model: dict, brand: Path) -> dict[str, bytes]:
    """Every file a lesson names (figures themed by the brand, captions), under a flat name."""
    theme = _theme()
    try:
        import fontTools  # noqa: F401
        embed = True
    except ImportError:
        embed = False
    files: dict[str, bytes] = {}
    for unit in model["units"]:
        udir = src / "units" / unit["slug"]
        for s in unit["steps"]:
            if s["kind"] != "lesson":
                continue
            refs = re.findall(r"!\[[^\]]*\]\(([^)\s]+)\)", s["body"])
            refs += [s["captions"]] if "captions" in s else []
            for ref in refs:
                if ref.startswith("https://"):
                    continue
                data = (udir / ref).read_bytes()
                if ref.endswith(".svg"):
                    data = theme.apply(data.decode("utf-8"), brand, embed_fonts=embed).encode("utf-8")
                files[asset_name(unit["slug"], ref)] = data
    return files


def vtt_to_srt(text: str) -> str:
    cues, n = [], 0
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [ln for ln in block.splitlines() if ln.strip()]
        timing = next((i for i, ln in enumerate(lines) if "-->" in ln), None)
        if timing is None:
            continue
        n += 1
        start, end = (t.strip().split(" ")[0] for t in lines[timing].split("-->"))
        fix = lambda t: (t if t.count(":") == 2 else "00:" + t).replace(".", ",")  # noqa: E731
        cues.append(f"{n}\n{fix(start)} --> {fix(end)}\n" + "\n".join(lines[timing + 1:]))
    return "\n\n".join(cues) + "\n"


def item_key(item: dict) -> dict:
    key = {"type": item["type"]}
    if "choices" in item:
        key["choices"] = [{"correct": c["correct"], "feedback": c["feedback"]} for c in item["choices"]]
    for k in ("answer", "tolerance", "answers", "feedback"):
        if k in item:
            key[k] = item[k]
    return key


def steps(model: dict):
    flat = [(u, s) for u in model["units"] for s in u["steps"]]
    for i, (u, s) in enumerate(flat):
        yield u, s, (flat[i - 1] if i else None), (flat[i + 1] if i + 1 < len(flat) else None)


LABELS = {"reading": "Reading", "video": "Video", "exercise": "Exercise", "discussion": "Discussion"}


def kicker(s: dict) -> str:
    what = LABELS[s["type"]] if s["kind"] == "lesson" else ("Graded assessment" if s["graded"] else "Practice assessment")
    return f"{what} · {s['minutes']} minutes"


# ── web ──────────────────────────────────────────────────────────────────────────────────────────────────────────


def theme_css(brand: Path) -> str:
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    sans = tokens["role"].get("font-sans", {}).get("$value", "Inter")
    lines = ["/* Written by build.py from web.json: every course role as a brand role or a mix of two. */", ":root {"]
    for role, expr in WEB["roles"].items():
        if "!" in expr:
            a, pct, b = expr.split("!")
            lines.append(f"  --course-{role}: color-mix(in srgb, var(--brand-{a}) {pct}%, var(--brand-{b}));")
        else:
            lines.append(f"  --course-{role}: var(--brand-{expr});")
    lines.append(f'  --course-sans: var(--brand-font-sans, "{sans}"), {WEB["fallback_sans"]};')
    lines.append("}")
    return "\n".join(lines) + "\n"


def lockup(brand: Path) -> tuple[Path, int, int]:
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    files = tokens["$extensions"]["com.intellectualfrontiers.logo"]["lockup"]["files"]
    w = WEB["lockup_width"]
    f = min((f for f in files if f["background"] == "light" and f["file"].endswith(".png") and f["width"] >= 2 * w), key=lambda f: f["width"])
    return brand / f["file"], w, round(w * f["height"] / f["width"])


def page(model: dict, title: str, body: str, depth: int, toc: str, attrs: str = "", scripts: tuple[str, ...] = ()) -> str:
    up = "../" * depth
    logo_w, logo_h = WEB["lockup_width"], WEB["_lockup_h"]
    js = "".join(f'\n  <script src="{up}assets/{s}" defer></script>' for s in scripts)
    return f"""<!doctype html>
<html lang="{model['language']}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <link rel="stylesheet" href="{up}assets/brand.css">
  <link rel="stylesheet" href="{up}assets/theme.css">
  <link rel="stylesheet" href="{up}assets/course.css">{js}
</head>
<body{attrs}>
<a class="skip" href="#main">Skip to the lesson</a>
<header class="site">
  <a href="{up}index.html"><img src="{up}assets/lockup.png" width="{logo_w}" height="{logo_h}" alt="{html.escape(WEB['_brand_name'])}"></a>
  <a class="course-title" href="{up}index.html">{html.escape(model['title'])}</a>
</header>
<div class="layout">
<nav class="toc" aria-label="Course contents">
{toc}
</nav>
<main id="main">
{body}
</main>
</div>
</body>
</html>
"""


def toc(model: dict, current: str | None, depth: int) -> str:
    up = "../" * depth
    out = []
    for u in model["units"]:
        here = any(f"{u['slug']}/{s['slug']}" == current for s in u["steps"])
        items = []
        for s in u["steps"]:
            path = f"{u['slug']}/{s['slug']}"
            cur = ' aria-current="page"' if path == current else ""
            items.append(f'<li><a href="{up}{path}.html"{cur}>{html.escape(s["title"])} <span class="meta">{kicker(s)}</span></a></li>')
        out.append(f'<details{" open" if here or current is None else ""}><summary>Week {u["week"]}: {html.escape(u["title"])}</summary><ol>{"".join(items)}</ol></details>')
    return "\n".join(out)


def item_html(item: dict, n: int) -> str:
    iid = f"item-{item['id']}"
    key = html.escape(json.dumps(item_key(item), ensure_ascii=False), quote=True)
    asset = lambda r: r  # noqa: E731
    parts = [f'<fieldset class="item" id="{iid}" data-key="{key}">', f"<legend>{n}. {html.escape(item['title'])}</legend>",
             markdown(item["prompt"], asset)]
    if "choices" in item:
        kind = "radio" if item["type"] == "multiple-choice" else "checkbox"
        if kind == "checkbox":
            parts.append("<p>Choose every answer that applies.</p>")
        for i, c in enumerate(item["choices"]):
            parts.append(f'<label><input type="{kind}" name="{iid}" value="{i}"> <span>{inline(c["text"], asset)}</span></label>')
    else:
        hint = "A number" if item["type"] == "numeric" else "A word or short phrase"
        mode = ' inputmode="decimal"' if item["type"] == "numeric" else ""
        parts.append(f'<label class="answer">Your answer <input type="text" name="{iid}" autocomplete="off"{mode} aria-describedby="{iid}-hint"></label><p class="kicker" id="{iid}-hint">{hint}.</p>')
    parts.append('<button type="button">Check</button>')
    parts.append('<p class="feedback" role="status" aria-live="polite"></p>')
    parts.append("</fieldset>")
    return "\n".join(parts)


def web(src: Path, out: Path, brand: Path, cmi5: bool = False, publisher: str = "Intellectual Frontiers") -> dict:
    model = load(src)
    if out.exists():
        shutil.rmtree(out)
    (out / "assets" / "fonts").mkdir(parents=True)
    (out / "media").mkdir()
    shutil.copy(brand / "brand.css", out / "assets" / "brand.css")
    (out / "assets" / "theme.css").write_text(theme_css(brand), encoding="utf-8")
    for f in ("course.css", "quiz.js", "cmi5.js"):
        if f != "cmi5.js" or cmi5:
            shutil.copy(HERE / "web" / f, out / "assets" / f)
    for f in (HERE / "web" / "fonts").iterdir():
        shutil.copy(f, out / "assets" / "fonts" / f.name)
    logo, _, h = lockup(brand)
    shutil.copy(logo, out / "assets" / "lockup.png")
    WEB["_lockup_h"] = h
    WEB["_brand_name"] = publisher
    for name, data in media(src, model, brand).items():
        (out / "media" / name).write_bytes(data)
    outcomes = "".join(f"<li>{html.escape(o['text'])}</li>" for o in model["outcomes"])
    first = model["units"][0]
    home = (f"<h1>{html.escape(model['title'])}</h1>\n"
            f'<p class="kicker">{len(model["units"])} weeks · about {model["hours_per_week"]:g} hours a week · {model["format"]}</p>\n'
            f"{markdown(model['summary'], lambda r: r)}\n<h2>By the end you will be able to</h2>\n<ol class=\"outcomes\">{outcomes}</ol>\n"
            f'<p><a href="{first["slug"]}/{first["steps"][0]["slug"]}.html">Start with {html.escape(first["steps"][0]["title"])}</a></p>')
    (out / "index.html").write_text(page(model, model["title"], home, 0, toc(model, None, 0)), encoding="utf-8")
    scripts = ("quiz.js", "cmi5.js") if cmi5 else ("quiz.js",)
    for u, s, prev, nxt in steps(model):
        (out / u["slug"]).mkdir(exist_ok=True)
        asset = lambda r, u=u: r if r.startswith("https://") else f"../media/{asset_name(u['slug'], r)}"  # noqa: E731
        body = [f"<h1>{html.escape(s['title'])}</h1>", f'<p class="kicker">Week {u["week"]} · {kicker(s)}</p>']
        if s["kind"] == "lesson" and s["type"] == "video":
            body.append(f'<video controls preload="metadata" src="{html.escape(s["video"])}">'
                        f'<track kind="captions" srclang="{model["language"]}" label="Captions" src="{asset(s["captions"])}" default>'
                        f'<p><a href="{html.escape(s["video"])}">Download the video</a>.</p></video>')
            body.append(f'<section class="transcript" aria-labelledby="transcript"><h2 id="transcript">Transcript</h2>\n{markdown(s["body"], asset, shift=1)}\n</section>')
        elif s["kind"] == "lesson":
            body.append(markdown(s["body"], asset))
        else:
            body += [item_html(it, i + 1) for i, it in enumerate(s["items"])]
            body.append('<p class="score" role="status" aria-live="polite"></p>')
        nav = ['<nav class="steps" aria-label="Previous and next">']
        if prev:
            nav.append(f'<a class="prev" href="../{prev[0]["slug"]}/{prev[1]["slug"]}.html">Previous: {html.escape(prev[1]["title"])}</a>')
        if nxt:
            nav.append(f'<a class="next" href="../{nxt[0]["slug"]}/{nxt[1]["slug"]}.html">Next: {html.escape(nxt[1]["title"])}</a>')
        nav.append("</nav>")
        body.append("\n".join(nav))
        attrs = f' data-step="{s["kind"]}" data-graded="{str(s.get("graded", False)).lower()}" data-mastery="{WEB["mastery"]}"'
        (out / u["slug"] / f"{s['slug']}.html").write_text(
            page(model, f"{s['title']} · {model['title']}", "\n".join(body), 1, toc(model, f"{u['slug']}/{s['slug']}", 1), attrs, scripts),
            encoding="utf-8")
    return model


# ── OLX ──────────────────────────────────────────────────────────────────────────────────────────────────────────


def _id(*parts: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "-", "-".join(parts))


def problem_xml(item: dict, asset) -> str:
    name = quoteattr(item["title"])
    label = f"<label>{html.escape(' '.join(item['prompt'].split()))}</label>"
    desc = ""
    t = item["type"]
    if t == "multiple-choice":
        choices = "".join(f'<choice correct="{str(c["correct"]).lower()}">{html.escape(c["text"])}<choicehint>{html.escape(c["feedback"])}</choicehint></choice>'
                          for c in item["choices"])
        inner = f'<multiplechoiceresponse>{label}{desc}<choicegroup type="MultipleChoice">{choices}</choicegroup></multiplechoiceresponse>'
    elif t == "multiple-response":
        choices = "".join(f'<choice correct="{str(c["correct"]).lower()}">{html.escape(c["text"])}<choicehint selected="true">{html.escape(c["feedback"])}</choicehint></choice>'
                          for c in item["choices"])
        inner = f"<choiceresponse>{label}{desc}<checkboxgroup>{choices}</checkboxgroup></choiceresponse>"
    elif t == "numeric":
        answer = f"{item['answer']:g}"
        tol = f'<responseparam type="tolerance" default="{item["tolerance"]}"/>' if "tolerance" in item else ""
        inner = (f'<numericalresponse answer="{answer}">{label}{desc}{tol}<formulaequationinput/>'
                 f"<correcthint>{html.escape(item['feedback'])}</correcthint></numericalresponse>")
    else:
        first, *more = item["answers"]
        extra = "".join(f"<additional_answer answer={quoteattr(a)}/>" for a in more)
        inner = (f'<stringresponse answer={quoteattr(first)} type="ci">{label}{desc}{extra}'
                 f"<correcthint>{html.escape(item['feedback'])}</correcthint><textline size=\"30\"/></stringresponse>")
    return f'<problem display_name={name} max_attempts="" showanswer="finished">\n  {inner}\n</problem>\n'


def olx(src: Path, out: Path, brand: Path, org: str) -> dict:
    model = load(src)
    run = model["run"]
    files: dict[str, bytes] = {}

    def put(path: str, text: str) -> None:
        files[f"course/{path}"] = text.encode("utf-8")
    put("course.xml", f'<course url_name="{run}" org={quoteattr(org)} course="{model["code"]}"/>\n')
    chapters = []
    graded = 0
    for u in model["units"]:
        cid = _id(u["slug"])
        chapters.append(cid)
        seqs = []
        for s in u["steps"]:
            sid = _id(u["slug"], s["slug"])
            seqs.append(sid)
            asset = lambda r, u=u: r if r.startswith("https://") else f"/static/{asset_name(u['slug'], r)}"  # noqa: E731
            comps = []
            if s["kind"] == "lesson":
                if s["type"] == "video":
                    srt = asset_name(u["slug"], s["captions"]).removesuffix(".vtt") + f"-{model['language']}.srt"
                    files[f"course/static/{srt}"] = vtt_to_srt((src / "units" / u["slug"] / s["captions"]).read_text(encoding="utf-8")).encode("utf-8")
                    transcripts = html.escape(json.dumps({model["language"]: srt}), quote=True)
                    put(f"video/{sid}.xml", f'<video display_name={quoteattr(s["title"])} youtube_id_1_0="" html5_sources="{html.escape(json.dumps([s["video"]]), quote=True)}" '
                        f'transcripts="{transcripts}" download_track="true" download_video="true" edx_video_id="">\n'
                        f'  <source src={quoteattr(s["video"])}/>\n  <transcript language="{model["language"]}" src="{srt}"/>\n</video>\n')
                    comps.append(("video", sid))
                    put(f"html/{sid}-transcript.xml", f'<html filename="{sid}-transcript" display_name="Transcript"/>\n')
                    put(f"html/{sid}-transcript.html", "<h3>Transcript</h3>\n" + markdown(s["body"], asset, shift=1) + "\n")
                    comps.append(("html", f"{sid}-transcript"))
                else:
                    put(f"html/{sid}.xml", f'<html filename="{sid}" display_name={quoteattr(s["title"])}/>\n')
                    put(f"html/{sid}.html", markdown(s["body"], asset) + "\n")
                    comps.append(("html", sid))
                    if s["type"] == "discussion":
                        did = hashlib.sha1(f"{model['id']}/{run}/{sid}".encode()).hexdigest()[:32]
                        put(f"discussion/{sid}-discussion.xml", f'<discussion display_name={quoteattr(s["title"])} discussion_category={quoteattr(u["title"])} '
                            f'discussion_target={quoteattr(s["title"])} discussion_id="{did}"/>\n')
                        comps.append(("discussion", f"{sid}-discussion"))
            else:
                for it in s["items"]:
                    pid = _id(sid, it["id"])
                    put(f"problem/{pid}.xml", problem_xml(it, asset))
                    comps.append(("problem", pid))
            put(f"vertical/{sid}.xml", f'<vertical display_name={quoteattr(s["title"])}>\n' + "".join(f'  <{k} url_name="{v}"/>\n' for k, v in comps) + "</vertical>\n")
            grading = ' graded="true" format="Assessment"' if s["kind"] == "assessment" and s["graded"] else ""
            graded += bool(grading)
            put(f"sequential/{sid}.xml", f'<sequential display_name={quoteattr(s["title"])}{grading}>\n  <vertical url_name="{sid}"/>\n</sequential>\n')
        chapter_name = quoteattr(f"Week {u['week']}: {u['title']}")
        put(f"chapter/{cid}.xml", f'<chapter display_name={chapter_name}>\n' + "".join(f'  <sequential url_name="{q}"/>\n' for q in seqs) + "</chapter>\n")
    self_paced = "true" if model["format"] == "self-paced" else "false"
    put(f"course/{run}.xml", f'<course display_name={quoteattr(model["title"])} language="{model["language"]}" self_paced="{self_paced}">\n'
        + "".join(f'  <chapter url_name="{c}"/>\n' for c in chapters) + "</course>\n")
    put(f"policies/{run}/policy.json", json.dumps({f"course/{run}": {"display_name": model["title"], "language": model["language"],
                                                                        "self_paced": model["format"] == "self-paced", "tabs": [
        {"type": "courseware", "name": "Course"}, {"type": "course_info", "name": "Home"}, {"type": "discussion", "name": "Discussion"},
        {"type": "progress", "name": "Progress"}]}}, indent=2) + "\n")
    put(f"policies/{run}/grading_policy.json", json.dumps({"GRADER": [{"type": "Assessment", "short_label": "A", "min_count": graded, "drop_count": 0, "weight": 1.0}],
                                                           "GRADE_CUTOFFS": {"Pass": WEB["mastery"]}}, indent=2) + "\n")
    put("policies/assets.json", "{}\n")
    outcomes = "".join(f"<li>{html.escape(o['text'])}</li>" for o in model["outcomes"])
    put("about/overview.html", f"<section class=\"about\"><h2>About this course</h2>\n{markdown(model['summary'], lambda r: r)}\n"
        f"<h2>By the end you will be able to</h2><ol>{outcomes}</ol></section>\n")
    put("about/short_description.html", html.escape(" ".join(model["summary"].split())) + "\n")
    put("about/effort.html", f"{model['hours_per_week']:g} hours a week\n")
    for name, data in media(src, model, brand).items():
        if not name.endswith(".vtt"):
            files[f"course/static/{name}"] = data
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as gz, \
            tarfile.open(fileobj=gz, mode="w", format=tarfile.PAX_FORMAT) as tar:
        dirs = sorted({str(p) for n in files for p in Path(n).parents if str(p) != "."})
        for d in dirs:
            info = tarfile.TarInfo(d)
            info.type, info.mode, info.mtime = tarfile.DIRTYPE, 0o755, 0
            tar.addfile(info)
        for name in sorted(files):
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime = len(files[name]), 0o644, 0
            tar.addfile(info, io.BytesIO(files[name]))
    return model


# ── cmi5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────


def cmi5_xml(model: dict, iri: str) -> str:
    base = iri.rstrip("/")
    lang = model["language"]

    def ls(text: str) -> str:
        return f'<langstring lang="{lang}">{html.escape(text)}</langstring>'
    out = ['<?xml version="1.0" encoding="utf-8"?>',
           '<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">',
           f'  <course id="{base}">', f"    <title>{ls(model['title'])}</title>",
           f"    <description>{ls(' '.join(model['summary'].split()))}</description>", "  </course>", "  <objectives>"]
    for o in model["outcomes"]:
        out.append(f'    <objective id="{base}/outcome/{o["id"]}"><title>{ls(o["id"])}</title><description>{ls(o["text"])}</description></objective>')
    out.append("  </objectives>")
    for u in model["units"]:
        out += [f'  <block id="{base}/unit/{u["slug"]}">', "    <title>" + ls(f"Week {u['week']}: {u['title']}") + "</title>",
                f"    <description>{ls(' '.join(u['overview'].split()))}</description>"]
        for s in u["steps"]:
            if s["kind"] == "assessment":
                refs = sorted({o for it in s["items"] for o in it["assesses"]})
                attrs = f'moveOn="Passed" masteryScore="{WEB["mastery"]}"' if s["graded"] else 'moveOn="Completed"'
            else:
                refs, attrs = s["outcomes"], 'moveOn="Completed"'
            out += [f'    <au id="{base}/unit/{u["slug"]}/{s["slug"]}" {attrs} launchMethod="AnyWindow">',
                    f"      <title>{ls(s['title'])}</title>", f"      <description>{ls(kicker(s))}</description>",
                    "      <objectives>" + "".join(f'<objective idref="{base}/outcome/{o}"/>' for o in refs) + "</objectives>",
                    f"      <url>{u['slug']}/{s['slug']}.html</url>", "    </au>"]
        out.append("  </block>")
    out.append("</courseStructure>")
    return "\n".join(out) + "\n"


def cmi5(src: Path, out: Path, brand: Path, iri: str, publisher: str = "Intellectual Frontiers") -> dict:
    if not iri.startswith("https://"):
        raise BuildError("--iri must be an https IRI the house controls (FR-016)")
    with tempfile.TemporaryDirectory() as tmp:
        site = Path(tmp) / "site"
        model = web(src, site, brand, cmi5=True, publisher=publisher)
        (site / "cmi5.xml").write_text(cmi5_xml(model, iri), encoding="utf-8")
        out.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for p in sorted(site.rglob("*")):
                if p.is_file():
                    info = zipfile.ZipInfo(str(p.relative_to(site)), EPOCH)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    z.writestr(info, p.read_bytes())
    return model


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("target", choices=["web", "olx", "cmi5"])
    ap.add_argument("course", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--brand", default="frontiers-brand")
    ap.add_argument("--org", help="the Open edX organization code (olx)")
    ap.add_argument("--iri", help="the https IRI every cmi5 id is under (cmi5)")
    ap.add_argument("--publisher", default="Intellectual Frontiers", help="the lockup's alternative text (web, cmi5)")
    args = ap.parse_args(argv)
    brand = SYSTEMS / args.brand
    try:
        if args.target == "web":
            web(args.course, args.out, brand, publisher=args.publisher)
        elif args.target == "olx":
            if not args.org or not re.fullmatch(r"[A-Za-z0-9_.-]+", args.org):
                raise BuildError("--org is the Open edX organization code: letters, digits, _ . - (FR-017)")
            olx(args.course, args.out, brand, args.org)
        else:
            cmi5(args.course, args.out, brand, args.iri or "", args.publisher)
    except BuildError as e:
        print(e, file=sys.stderr)
        return 1
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
