"""The items group: build what the item design systems' scripts build, and the item checks (0042-agora FR-006, FR-013, FR-017).

`deck`, `email`, `course`, `media`, `sign` and `figure` build; the check sections `figures`, `voice`, `slides`, `email`,
`course`, `media`, `signage` and `merchandise` take `--scope PATH` to the work they check. Thin: the scripts stay in
`design-systems/<slug>/` (0014-design-systems FR-005) and agora.lib.items loads them from where they stand. Runs in this
group's locked environment: Pillow measures text for figures, media and signs, fontTools embeds the brand's sans.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from agora.core import (AgoraError, Arg, ArgType, Choice, Ctx, Dynamic, Finding, Opt, Resource, SectionResult, command,
                        next_command, section)
from agora.core import files
from agora.lib import assurance, items
from agora.lib.items import DEFAULT_BRAND, ScriptProblem


def _brands(ctx: Ctx) -> list[str]:
    return assurance.brands(ctx.root)


# The same type the assurance group declares, with the same meaning (0041 FR-013).
BRAND = Dynamic("BRAND", "a brand's slug: a design system with a brand.css (0014-design-systems FR-028)", _brands)
VARIANT = Dynamic("VARIANT", "a figure color variant of frontiers-figures: default, on-dark or grayscale",
                  lambda ctx: items.figure_variants(ctx.root))
COURSE_TARGET = Choice("COURSE_TARGET", ("web", "olx", "cmi5"), "what a course is built to: a static site, an Open edX export or a cmi5 package")


class _Path(ArgType):
    name = "PATH"
    doc = "a path to a file or directory that exists, relative to where the command runs"

    def validate(self, ctx: Any, value: str) -> str:
        if not Path(value).exists():
            raise ValueError(f"{value!r} does not exist")
        return value

    def examples(self, ctx: Any) -> list[str]:
        return ["design-systems/frontiers-slides/assurance/fixtures/pass/deck.md"]


PATH = _Path()


def _refused(e: ScriptProblem) -> AgoraError:
    return AgoraError("refused", str(e), exit=1)


def _brand_of(ctx: Ctx, brand: str | None) -> str:
    return brand or DEFAULT_BRAND


def _built(ctx: Ctx, kind: str, path: str, made: dict[Path, Any], extra: dict[str, Any], next_: list | None = None) -> Resource:
    changes = files.apply(ctx, made)
    res = Resource(kind, path, {"path": path, "dry_run": ctx.dry_run, **extra,
                                "files": sum(1 for v in made.values() if v is not None),
                                "changes": changes})
    res.actions = next_ or []
    return res


def _out(given: str | None, source: Path, suffix: str) -> Path:
    return Path(given) if given else source.with_suffix(suffix)


# deck, email -------------------------------------------------------------------------------------------------------
@command("deck build", category="build", help="Build a slide deck from its Markdown into one HTML page (frontiers-slides FR-010)",
         args=[Arg("path", "PATH", "the deck's Markdown file")],
         options=[Opt("--out", "TEXT", "the HTML file to write; the deck's name with .html beside it by default", alias="-o"),
                  Opt("--brand", "BRAND", f"the brand that themes it ({DEFAULT_BRAND} by default)"),
                  Opt("--inline", None, "embed the stylesheet, script, fonts and images, so the one file stands alone")])
def deck_build(ctx: Ctx, path: str, out: str | None, brand: str | None, inline: bool) -> Resource:
    src, target, b = Path(path), None, _brand_of(ctx, brand)
    target = _out(out, src, ".html")
    try:
        made = items.build_deck(ctx.root, src, target, b, inline)
    except ScriptProblem as e:
        raise _refused(e) from None
    return _built(ctx, "deck", path, made, {"brand": b, "inline": inline, "out": str(target)},
                  [next_command("check the deck", "check", sections=["slides"], scope=[path], brand=b)])


@command("email build", category="build",
         help="Build an email from its Markdown: 600px table-laid HTML with every style inline, and its plain-text alternative (frontiers-email FR-005)",
         args=[Arg("path", "PATH", "the message's Markdown file")],
         options=[Opt("--out", "TEXT", "the HTML file to write, and its .txt beside it; the message's name with .html by default", alias="-o"),
                  Opt("--assets", "TEXT", "the public https URL the brand's files (its logos/) are served from", required=True),
                  Opt("--brand", "BRAND", f"the brand that themes it ({DEFAULT_BRAND} by default)")])
def email_build(ctx: Ctx, path: str, out: str | None, assets: str, brand: str | None) -> Resource:
    if not assets.startswith("https://"):
        raise AgoraError("invalid-argument", "--assets is the https URL the brand's files are served from", exit=2)
    src, b = Path(path), _brand_of(ctx, brand)
    target = _out(out, src, ".html")
    try:
        made = items.build_email(ctx.root, src, target, b, assets)
    except ScriptProblem as e:
        raise _refused(e) from None
    return _built(ctx, "email", path, made, {"brand": b, "assets": assets, "out": str(target)},
                  [next_command("check the message", "check", sections=["email"], scope=[path], brand=b)])


# course ------------------------------------------------------------------------------------------------------------
@command("course show", category="read",
         help="Show a course as frontiers-course reads it: its outcomes, units and steps, and the model every target is built from",
         args=[Arg("path", "PATH", "the course's directory (named for its id, holding course.adoc)")])
def course_show(ctx: Ctx, path: str) -> Resource:
    try:
        model = items.course_model(ctx.root, Path(path))
    except ScriptProblem as e:
        raise _refused(e) from None
    except (OSError, KeyError, ValueError) as e:
        raise AgoraError("refused", f"{path} is not a course frontiers-course can read: {type(e).__name__}: {e}", exit=1) from None
    rows = [{"slug": u["slug"], "title": u["title"], "week": u["week"], "steps": len(u["steps"]),
             "minutes": sum(s["minutes"] for s in u["steps"])} for u in model["units"]]
    res = Resource("course", path, {"path": path, "id": model["id"], "title": model["title"], "code": model["code"],
                                    "run": model["run"], "format": model["format"], "language": model["language"],
                                    "hours_per_week": model["hours_per_week"], "outcomes": model["outcomes"], "units": rows,
                                    "model": model})
    res.columns["outcomes"] = ["id", "text"]
    res.columns["units"] = ["slug", "title", "week", "steps", "minutes"]
    res.actions = [next_command("check the course", "check", sections=["course"], scope=[path]),
                   next_command("build its web edition", "course build", path=path, target="web", out=f"{model['id']}-web")]
    return res


@command("course build", category="build",
         help="Build a course to a delivery target: a static site, an Open edX export (OLX) or a cmi5 package (frontiers-course FR-013)",
         args=[Arg("path", "PATH", "the course's directory")],
         options=[Opt("--target", "COURSE_TARGET", "web, olx or cmi5", required=True),
                  Opt("--out", "TEXT", "web: the directory; olx: the .tar.gz; cmi5: the .zip", alias="-o", required=True),
                  Opt("--brand", "BRAND", f"the brand that themes it ({DEFAULT_BRAND} by default)"),
                  Opt("--org", "TEXT", "olx: the Open edX organization code"),
                  Opt("--iri", "TEXT", "cmi5: the https IRI every cmi5 id is under"),
                  Opt("--publisher", "TEXT", "web, cmi5: the lockup's alternative text (Intellectual Frontiers by default)")])
def course_build(ctx: Ctx, path: str, target: str, out: str, brand: str | None, org: str | None, iri: str | None,
                 publisher: str | None) -> Resource:
    if target == "olx" and (why := items.org_problem(org)):
        raise AgoraError("invalid-argument", why, exit=2)
    if target == "cmi5" and not (iri or "").startswith("https://"):
        raise AgoraError("invalid-argument", "--iri must be an https IRI the house controls (frontiers-course FR-016)", exit=2)
    b = _brand_of(ctx, brand)
    try:
        made = items.build_course(ctx.root, Path(path), Path(out), target, b, org, iri, publisher or "Intellectual Frontiers")
    except ScriptProblem as e:
        raise _refused(e) from None
    return _built(ctx, "course", path, made, {"target": target, "brand": b, "out": out},
                  [next_command("show the course", "course show", path=path)])


# media, sign -------------------------------------------------------------------------------------------------------
@command("media build", category="build",
         help="Render a media asset's job to a PNG: podcast and episode art, a thumbnail, title card, lower third or social card (frontiers-media FR-009)",
         args=[Arg("job", "PATH", "the job's JSON file")],
         options=[Opt("--out", "TEXT", "the PNG to write; the job's name with .png beside it by default", alias="-o"),
                  Opt("--svg", "TEXT", "also write the SVG the PNG is rendered from"),
                  Opt("--brand", "BRAND", f"the brand that themes it ({DEFAULT_BRAND} by default)")])
def media_build(ctx: Ctx, job: str, out: str | None, svg: str | None, brand: str | None) -> Resource:
    src, b = Path(job), _brand_of(ctx, brand)
    target = _out(out, src, ".png")
    try:
        made = items.build_media(ctx.root, src, target, b, Path(svg) if svg else None)
    except ScriptProblem as e:
        raise _refused(e) from None
    return _built(ctx, "media", job, made, {"brand": b, "out": str(target)},
                  [next_command("check the job", "check", sections=["media"], scope=[job], brand=b)])


@command("sign build", category="build",
         help="Render a sign's job to a vector PDF at its trim size plus bleed: a poster, roll-up banner or event badge (frontiers-signage-print FR-009)",
         args=[Arg("job", "PATH", "the job's JSON file")],
         options=[Opt("--out", "TEXT", "the PDF to write; the job's name with .pdf beside it by default", alias="-o"),
                  Opt("--brand", "BRAND", f"the brand that themes it ({DEFAULT_BRAND} by default)")])
def sign_build(ctx: Ctx, job: str, out: str | None, brand: str | None) -> Resource:
    src, b = Path(job), _brand_of(ctx, brand)
    target = _out(out, src, ".pdf")
    try:
        made = items.build_sign(ctx.root, src, target, b)
    except ScriptProblem as e:
        raise _refused(e) from None
    return _built(ctx, "sign", job, made, {"brand": b, "out": str(target)},
                  [next_command("check the job", "check", sections=["signage"], scope=[job], brand=b)])


# figure ------------------------------------------------------------------------------------------------------------
@command("figure build", category="build",
         help="Theme a figure's semantic SVG with a brand: its colors by role and its type in the brand's sans (frontiers-figures FR-004)",
         args=[Arg("path", "PATH", "the figure's SVG source")],
         options=[Opt("--brand", "BRAND", f"the brand that themes it ({DEFAULT_BRAND} by default)"),
                  Opt("--variant", "VARIANT", "default, on-dark or grayscale (default by default)"),
                  Opt("--embed-fonts", None, "embed the sans, cut to the letters the figure uses, for a page that shows it as an image"),
                  Opt("--out", "TEXT", "the SVG to write; without it the themed SVG is the command's output and nothing is written", alias="-o")])
def figure_build(ctx: Ctx, path: str, brand: str | None, variant: str | None, embed_fonts: bool, out: str | None) -> Resource:
    b, v = _brand_of(ctx, brand), variant or "default"
    try:
        svg = items.build_figure(ctx.root, Path(path), b, v, embed_fonts)
    except ScriptProblem as e:
        raise _refused(e) from None
    nxt = [next_command("check the source", "check", sections=["figures"], scope=[path], brand=b)]
    if not out:
        res = Resource("figure", path, {"path": path, "brand": b, "variant": v, "embed_fonts": embed_fonts, "svg": svg},
                       text=lambda r: r.data["svg"].rstrip("\n"))
        res.actions = nxt
        return res
    return _built(ctx, "figure", path, {Path(out): svg}, {"brand": b, "variant": v, "embed_fonts": embed_fonts, "out": out}, nxt)


# check sections ----------------------------------------------------------------------------------------------------
def _scope(scope: list[str] | None) -> list[str]:
    return [scope] if isinstance(scope, str) else list(scope or [])


def _report(name: str, ctx: Ctx, problems: items.Problems, checked: int, unit: str, how: str, notes: list[str] | None = None,
           extra_findings: list[Finding] | None = None) -> SectionResult:
    findings = list(extra_findings or []) + [Finding(level, where, msg) for level, where, msg in problems]
    errors = sum(1 for f in findings if f.level == "error")
    lines = [f"{name}: {checked} {unit}{'' if checked == 1 else 's'} checked, {errors} problem{'' if errors == 1 else 's'}; {how}"]
    return SectionResult.from_findings(name, findings, lines + (notes or []), {"checked": checked, "problems": errors, "scope": how})


def _paths(ctx: Ctx, scope: list[str] | None, suffixes: tuple[str, ...], default: list[Path], none_why: str
           ) -> tuple[list[Path] | None, list[Finding], str, SectionResult | None]:
    """The files to check, any findings about the scope itself, and how they were chosen. With no scope, the design
    system's own passing fixtures: what its script is meant to accept (0042 FR-013)."""
    given = _scope(scope)
    if given:
        found, bad = items.expand(given, suffixes)
        return found, [Finding("error", p.split(":")[0], p) for p in bad], f"--scope {', '.join(items.rel(ctx.root, Path(g)) for g in given)}", None
    if not default:
        return None, [], "", SectionResult("", "skipped", reason=none_why)
    return default, [], "no --scope: the design system's own passing fixtures", None


def _brand_checked(ctx: Ctx, brand: str) -> list[Finding]:
    why = items.brand_problem(ctx.root, brand)
    return [Finding("error", f"design-systems/{brand}", why)] if why else []


def _skipped(name: str, r: SectionResult) -> SectionResult:
    r.name = name
    return r


@section("figures")
def check_figures(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    brand = ctx.section_options.get("brand")
    paths, bad, how, skip = _paths(ctx, scope, (".svg",), items.figure_fixtures(ctx.root),
                                   "no design system holds a passing figure fixture")
    if skip:
        return _skipped("figures", skip)
    pre = bad + (_brand_checked(ctx, brand) if brand else [])
    if pre:
        return _report("figures", ctx, [], len(paths or []), "figure", how, extra_findings=pre)
    problems = items.check_figures(ctx.root, paths or [], brand)
    return _report("figures", ctx, problems, len(paths or []), "figure", how + (f"; measured in {brand}'s sans" if brand else "; measured in Inter"))


@section("voice")
def check_voice(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    o = ctx.section_options
    spoken, mode, draft = bool(o.get("spoken")), o.get("mode"), bool(o.get("draft"))
    slug = "frontiers-spoken-voice" if spoken else "frontiers-written-voice"
    suffixes = (".md", ".adoc", ".txt")
    paths, bad, how, skip = _paths(ctx, scope, suffixes, items.fixtures(ctx.root, slug, *suffixes), f"{slug} holds no passing fixture")
    if skip:
        return _skipped("voice", skip)
    if bad:
        return _report("voice", ctx, [], 0, "file", how, extra_findings=bad)
    problems = items.sweep_voice(ctx.root, paths or [], mode, draft, spoken, fixtures_only=not _scope(scope))
    voice = "the spoken voice" if spoken else "the written voice"
    how += f"; {voice}, {mode or ('prose, a fixture named procedure-* as a procedure' if not _scope(scope) else 'prose')}{', draft' if draft else ''}"
    return _report("voice", ctx, problems, len(paths or []), "file", how)


CONTENT = "content"


@section("content")
def check_content(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    """Every page of the website held under content/ (the Journal's articles and the registers' pages) against the written
    voice: prose and headings, an announcement or a heading that names a topic instead of stating its claim among them
    (frontiers-written-voice FR-009, FR-017; 0044-public-website FR-010), and an image whose alt text names only the kind
    of picture, a warning (0044-public-website FR-079). A page this website shows is this website's writing, whichever
    website first published it."""
    draft = bool(ctx.section_options.get("draft"))
    given = _scope(scope)
    if given:
        paths, bad = items.expand(given, (".html", ".md", ".adoc"))
        how = f"--scope {', '.join(items.rel(ctx.root, Path(g)) for g in given)}"
    else:
        paths, bad = items.expand([ctx.root / CONTENT], (".html",)) if (ctx.root / CONTENT).is_dir() else ([], [])
        how = f"no --scope: every page under {CONTENT}/"
    findings = [Finding("error", p.split(":")[0], p) for p in bad]
    if findings:
        return _report("content", ctx, [], 0, "page", how, extra_findings=findings)
    problems = items.sweep_voice(ctx.root, paths, None, draft, False, fixtures_only=False) + items.sweep_alts(ctx.root, paths)
    return _report("content", ctx, problems, len(paths), "page", how + ("; draft" if draft else ""))


@section("slides")
def check_slides(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    brand = ctx.section_options.get("brand") or DEFAULT_BRAND
    paths, bad, how, skip = _paths(ctx, scope, (".md",), items.fixtures(ctx.root, "frontiers-slides", ".md"),
                                   "frontiers-slides holds no passing deck")
    if skip:
        return _skipped("slides", skip)
    pre = bad + _brand_checked(ctx, brand)
    if pre:
        return _report("slides", ctx, [], 0, "deck", how, extra_findings=pre)
    return _report("slides", ctx, items.check_decks(ctx.root, paths or [], brand), len(paths or []), "deck", f"{how}; under {brand}")


@section("email")
def check_email(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    brand = ctx.section_options.get("brand") or DEFAULT_BRAND
    paths, bad, how, skip = _paths(ctx, scope, (".md",), items.fixtures(ctx.root, "frontiers-email", ".md"),
                                   "frontiers-email holds no passing message")
    if skip:
        return _skipped("email", skip)
    pre = bad + _brand_checked(ctx, brand)
    if pre:
        return _report("email", ctx, [], 0, "message", how, extra_findings=pre)
    return _report("email", ctx, items.check_emails(ctx.root, paths or [], brand), len(paths or []), "message", f"{how}; under {brand}")


@section("course")
def check_course(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    given = _scope(scope)
    if given:
        found, bad = items.courses_in(given)
        how = f"--scope {', '.join(items.rel(ctx.root, Path(g)) for g in given)}"
        pre = [Finding("error", p.split(":")[0], p) for p in bad]
    else:
        found, pre, how = items.course_fixtures(ctx.root), [], "no --scope: the design system's own passing fixtures"
        if not found:
            return SectionResult("course", "skipped", reason="frontiers-course holds no passing course")
    if pre:
        return _report("course", ctx, [], 0, "course", how, extra_findings=pre)
    return _report("course", ctx, items.check_courses(ctx.root, found), len(found), "course", how)


@section("media")
def check_media(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    brand = ctx.section_options.get("brand") or DEFAULT_BRAND
    paths, bad, how, skip = _paths(ctx, scope, (".json",), items.fixtures(ctx.root, "frontiers-media", ".json"),
                                   "frontiers-media holds no passing job")
    if skip:
        return _skipped("media", skip)
    pre = bad + _brand_checked(ctx, brand)
    if pre:
        return _report("media", ctx, [], 0, "job", how, extra_findings=pre)
    return _report("media", ctx, items.check_media(ctx.root, paths or [], brand), len(paths or []), "job", f"{how}; under {brand}")


@section("signage")
def check_signage(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    brand = ctx.section_options.get("brand") or DEFAULT_BRAND
    paths, bad, how, skip = _paths(ctx, scope, (".json",), items.fixtures(ctx.root, "frontiers-signage-print", ".json"),
                                   "frontiers-signage-print holds no passing job")
    if skip:
        return _skipped("signage", skip)
    pre = bad + _brand_checked(ctx, brand)
    if pre:
        return _report("signage", ctx, [], 0, "job", how, extra_findings=pre)
    return _report("signage", ctx, items.check_signs(ctx.root, paths or [], brand), len(paths or []), "job", f"{how}; under {brand}")


@section("merchandise")
def check_merchandise(ctx: Ctx, scope: list[str] | None) -> SectionResult:
    brand = ctx.section_options.get("brand") or DEFAULT_BRAND
    paths, bad, how, skip = _paths(ctx, scope, (".json",), items.fixtures(ctx.root, "frontiers-merchandise", ".json"),
                                   "frontiers-merchandise holds no passing job")
    if skip:
        return _skipped("merchandise", skip)
    pre = bad + _brand_checked(ctx, brand)
    if pre:
        return _report("merchandise", ctx, [], 0, "job", how, extra_findings=pre)
    problems, notes = items.check_merchandise(ctx.root, paths or [], brand, fixtures_only=not _scope(scope))
    beyond = f"; {len(notes)} beyond the brand's kit, noted and not held to it (frontiers-merchandise FR-010)" if notes else ""
    return _report("merchandise", ctx, problems, len(paths or []) - len(notes), "job", f"{how}; under {brand}{beyond}", notes)
