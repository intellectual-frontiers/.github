"""The item design systems' own scripts, called by path (0042-agora FR-017; 0014-design-systems FR-005).

A script stays in `design-systems/<slug>/`: this module loads it with importlib from where it stands, calls the
functions it exposes and reads what it returns. The builds write what the script writes into a scratch place first, so
that `--dry-run` shows the change and `files.apply` writes it. The checks take the scripts' own problem lists.
Standard library only here; the scripts import Pillow and fontTools in the group's locked environment.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import warnings
from pathlib import Path
from typing import Any, Callable, Iterable

DEFAULT_BRAND = "frontiers-brand"  # the brand every item script themes by when none is named
ASSETS_PLACEHOLDER = "https://assets.invalid/brand"  # what mail.py checks with when no --assets is given

_loaded: dict[str, Any] = {}


class ScriptProblem(Exception):
    """A script refused its input in its own words (it raised, or it exited with a message)."""


def system(root: Path, slug: str) -> Path:
    return root / "design-systems" / slug


def load(root: Path, slug: str, filename: str) -> Any:
    """A design system's script as a module, loaded from where it stands (0042 FR-017), once per process. Its own
    directory is on `sys.path` while it loads, as the script puts it there itself when it runs on its own."""
    path = system(root, slug) / filename
    key = str(path.resolve())
    if key in _loaded:
        return _loaded[key]
    name = f"_agora_{slug.replace('-', '_')}_{path.stem}"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise FileNotFoundError(path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    sys.path.insert(0, str(path.parent))
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", ResourceWarning)  # a script leaves its data files to be closed at exit
            spec.loader.exec_module(mod)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    finally:
        sys.path.remove(str(path.parent))
    _loaded[key] = mod
    return mod


def call(fn: Callable[..., Any], *args: Any, **kw: Any) -> Any:
    """Call a script's function, reading its refusals (a `SystemExit` carrying a message, a bad value) as problems."""
    try:
        return fn(*args, **kw)
    except SystemExit as e:
        raise ScriptProblem(str(e.code) if e.code not in (None, 0, 1) else f"{fn.__name__} refused it") from None


# paths -------------------------------------------------------------------------------------------------------------
def rel(root: Path, p: Path) -> str:
    try:
        return str(p.resolve().relative_to(root.resolve()))
    except ValueError:
        return str(p)


def expand(paths: Iterable[str | Path], suffixes: tuple[str, ...]) -> tuple[list[Path], list[str]]:
    """The files a scope names: a file as it is, a directory as every file under it with one of the suffixes, sorted.
    Returns (files, problems): a path that does not exist, or a directory that holds none, is a problem."""
    out: list[Path] = []
    problems: list[str] = []
    for raw in paths:
        p = Path(raw)
        if p.is_file():
            out.append(p)
        elif p.is_dir():
            found = sorted(f for f in p.rglob("*") if f.is_file() and f.suffix in suffixes)
            if found:
                out += found
            else:
                problems.append(f"{raw}: no {' or '.join(suffixes)} file under it")
        else:
            problems.append(f"{raw}: no such file or directory")
    return out, problems


def courses_in(paths: Iterable[str | Path]) -> tuple[list[Path], list[str]]:
    """A course is a directory holding course.adoc; a scope is such a directory or one that holds them."""
    out: list[Path] = []
    problems: list[str] = []
    for raw in paths:
        p = Path(raw)
        if (p / "course.adoc").is_file():
            out.append(p)
        elif p.is_dir():
            found = sorted(f.parent for f in p.rglob("course.adoc"))
            if found:
                out += found
            else:
                problems.append(f"{raw}: no course.adoc under it, so it is not a course")
        else:
            problems.append(f"{raw}: not a course directory")
    return out, problems


def fixtures(root: Path, slug: str, *kinds: str) -> list[Path]:
    """What a design system's script is meant to accept: the files of `assurance/fixtures/pass`, sorted."""
    d = system(root, slug) / "assurance" / "fixtures" / "pass"
    return sorted(p for p in d.iterdir() if p.is_file() and (not kinds or p.suffix in kinds)) if d.is_dir() else []


def course_fixtures(root: Path) -> list[Path]:
    d = system(root, "frontiers-course") / "assurance" / "fixtures" / "pass"
    return sorted(p.parent for p in d.rglob("course.adoc")) if d.is_dir() else []


def figure_fixtures(root: Path) -> list[Path]:
    """The semantic figures the design systems' passing fixtures carry."""
    return sorted(p for p in (root / "design-systems").glob("*/assurance/fixtures/pass/**/*.svg") if p.is_file())


# staged writes -----------------------------------------------------------------------------------------------------
class Staged(type(Path())):  # type: ignore[misc]
    """A path whose writes are held, not made, so a script that writes its output beside a given path (and writes links
    relative to it) can run under `--dry-run`: what it wrote is in `Staged.held`."""

    held: dict[str, str | bytes] = {}

    def write_text(self, data: str, encoding: str | None = None, errors: str | None = None, newline: str | None = None) -> int:
        Staged.held[str(self)] = data
        return len(data)

    def write_bytes(self, data: bytes) -> int:
        Staged.held[str(self)] = bytes(data)
        return len(data)


def staged(path: Path) -> Staged:
    Staged.held = {}
    return Staged(path)


# builds ------------------------------------------------------------------------------------------------------------
def build_deck(root: Path, deck: Path, out: Path, brand: str, inline: bool) -> dict[Path, str]:
    mod = load(root, "frontiers-slides", "deck.py")
    target = staged(out)
    call(mod.build, deck, target, brand, inline)
    return {Path(k): v for k, v in Staged.held.items()}


def build_email(root: Path, message: Path, out: Path, brand: str, assets: str) -> dict[Path, str]:
    mod = load(root, "frontiers-email", "mail.py")
    target = staged(out)
    call(mod.build, message, target, brand, assets)
    return {Path(k): v for k, v in Staged.held.items()}


def build_figure(root: Path, svg: Path, brand: str, variant: str, embed: bool) -> str:
    mod = load(root, "frontiers-figures", "theme.py")
    return call(mod.apply, svg.read_text(encoding="utf-8"), system(root, brand), variant, embed)


def figure_variants(root: Path) -> list[str]:
    roles = json.loads((system(root, "frontiers-figures") / "roles.json").read_text(encoding="utf-8"))
    return list(roles["variants"])


def build_media(root: Path, job: Path, out: Path, brand: str, svg_out: Path | None) -> dict[Path, str | bytes]:
    """Render in a scratch directory, and return what it made."""
    mod = load(root, "frontiers-media", "media.py")
    made: dict[Path, str | bytes] = {}
    with tempfile.TemporaryDirectory() as tmp:
        png, svg = Path(tmp) / out.name, Path(tmp) / "job.svg"
        call(mod.render, json.loads(job.read_text(encoding="utf-8")), system(root, brand), png, svg if svg_out else None)
        made[out] = png.read_bytes()
        if svg_out:
            made[svg_out] = svg.read_text(encoding="utf-8")
    return made


def build_sign(root: Path, job: Path, out: Path, brand: str) -> dict[Path, str | bytes]:
    mod = load(root, "frontiers-signage-print", "signage.py")
    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / out.name
        call(mod.render, json.loads(job.read_text(encoding="utf-8")), system(root, brand), pdf)
        return {out: pdf.read_bytes()}


def course_model(root: Path, course: Path) -> dict:
    return call(load(root, "frontiers-course", "course.py").model, course)


def course_problems(root: Path, course: Path) -> list[str]:
    return call(load(root, "frontiers-course", "course.py").check, course)


def build_course(root: Path, course: Path, out: Path, target: str, brand: str, org: str | None, iri: str | None,
                 publisher: str) -> dict[Path, str | bytes | None]:
    """Build a course target in a scratch directory and return what it made, at `out`. A web build replaces its directory
    as the script does: a file of a previous build that it no longer makes is deleted."""
    mod = load(root, "frontiers-course", "build.py")
    b = system(root, brand)
    with tempfile.TemporaryDirectory() as tmp:
        made = Path(tmp) / ("site" if target == "web" else "package")
        try:
            if target == "web":
                mod.web(course, made, b, publisher=publisher)
            elif target == "olx":
                mod.olx(course, made, b, org or "")
            else:
                mod.cmi5(course, made, b, iri or "", publisher)
        except mod.BuildError as e:
            raise ScriptProblem(str(e)) from None
        if target != "web":
            return {out: made.read_bytes()}
        files: dict[Path, str | bytes | None] = {out / p.relative_to(made): p.read_bytes() for p in sorted(made.rglob("*")) if p.is_file()}
    if out.is_dir():
        previous = [p for p in out.rglob("*") if p.is_file()]
        if previous and not (out / "assets" / "brand.css").is_file():
            raise ScriptProblem(f"{out} holds files and is not a previous web build (it has no assets/brand.css); "
                                "name an empty or new directory")
        files.update({p: None for p in previous if p not in files})
    return files


def org_problem(org: str | None) -> str | None:
    import re
    if not org or not re.fullmatch(r"[A-Za-z0-9_.-]+", org):
        return "--org is the Open edX organization code: letters, digits, _ . - (frontiers-course FR-017)"
    return None


# checks ------------------------------------------------------------------------------------------------------------
Problems = list[tuple[str, str, str]]  # (level, where, message)


def _guard(where: str, fn: Callable[[], list[str]]) -> Problems:
    try:
        return [("error", where, p) for p in fn()]
    except ScriptProblem as e:
        return [("error", where, str(e))]
    except (OSError, ValueError, KeyError, TypeError, AttributeError, IndexError, json.JSONDecodeError) as e:
        return [("error", where, f"the check could not run: {type(e).__name__}: {e}")]


def brand_problem(root: Path, brand: str) -> str | None:
    return None if (system(root, brand) / "brand.css").is_file() else f"{brand} is not a brand: it has no brand.css"


def check_figures(root: Path, paths: list[Path], brand: str | None) -> Problems:
    mod = load(root, "frontiers-figures", "figcheck.py")
    kit = load(root, "frontiers-figures", "svgkit.py")
    out: Problems = []
    if brand:
        kit.use_brand(system(root, brand))
    for p in paths:
        out += _guard(rel(root, p), lambda p=p: call(mod.check, str(p)))
    return out


def check_decks(root: Path, paths: list[Path], brand: str) -> Problems:
    mod = load(root, "frontiers-slides", "deck.py")
    return [x for p in paths for x in _guard(rel(root, p), lambda p=p: call(mod.check, p, brand))]


def check_emails(root: Path, paths: list[Path], brand: str) -> Problems:
    mod = load(root, "frontiers-email", "mail.py")
    return [x for p in paths for x in _guard(rel(root, p), lambda p=p: call(mod.check, p, brand, ASSETS_PLACEHOLDER))]


def check_courses(root: Path, paths: list[Path]) -> Problems:
    return [x for p in paths for x in _guard(rel(root, p), lambda p=p: course_problems(root, p))]


def _jobs(root: Path, paths: list[Path], fn: Callable[[dict], list[str]]) -> Problems:
    out: Problems = []
    for p in paths:
        out += _guard(rel(root, p), lambda p=p: fn(json.loads(p.read_text(encoding="utf-8"))))
    return out


def check_media(root: Path, paths: list[Path], brand: str) -> Problems:
    mod = load(root, "frontiers-media", "media.py")
    return _jobs(root, paths, lambda job: call(mod.check, job, system(root, brand)))


def check_signs(root: Path, paths: list[Path], brand: str) -> Problems:
    mod = load(root, "frontiers-signage-print", "signage.py")
    return _jobs(root, paths, lambda job: call(mod.check, job, system(root, brand)))


UNREACHABLE = ("at any size", "decoration kit has no")  # the brand's own limit, not the job's fault (merchandise run.py)


def check_merchandise(root: Path, paths: list[Path], brand: str, fixtures_only: bool) -> tuple[Problems, list[str]]:
    """Each job against the brand's decoration kit. A fixture the brand's kit fits at no size is the brand's limit: a
    note, never a pass and never a failure (frontiers-merchandise FR-010); a job a person names is held to the brand."""
    mod = load(root, "frontiers-merchandise", "decoration.py")
    b = mod.Brand(system(root, brand))
    if b.kit is None:
        return [("error", f"design-systems/{brand}", f"{brand} has no decoration kit: it cannot theme frontiers-merchandise "
                 "(0014-design-systems FR-047)")], []
    out: Problems = []
    notes: list[str] = []
    for p in paths:
        where = rel(root, p)
        try:
            job = json.loads(p.read_text(encoding="utf-8"))
            if job.get("artwork") == "imagery:@first" and b.pieces:
                job = {**job, "artwork": "imagery:" + next(iter(b.pieces))}
            problems = mod.check(job, b)
        except (OSError, ValueError, KeyError, TypeError) as e:
            out.append(("error", where, f"the check could not run: {type(e).__name__}: {e}"))
            continue
        beyond = [x for x in problems if any(u in x for u in UNREACHABLE)]
        if beyond and fixtures_only:
            notes.append(f"{where} is beyond {brand}'s kit: {beyond[0]}")
            continue
        out += [("error", where, x) for x in problems]
    return out, notes


def voice_modules(root: Path) -> tuple[Any, Any]:
    return load(root, "frontiers-written-voice", "sweep.py"), load(root, "frontiers-spoken-voice", "sweep.py")


def sweep_voice(root: Path, paths: list[Path], mode: str | None, draft: bool, spoken: bool, fixtures_only: bool = False) -> Problems:
    """The written voice's mechanical sweep (or, with `spoken`, the spoken voice's patterns and terms), as sweep.py runs it
    over a file: the file's prose, every failure a warning under `draft`. `mode` is prose or procedure; among the design
    system's own fixtures, one named procedure-* is a procedure when no mode is given, as its harness reads them."""
    written, spoke = voice_modules(root)
    if spoken:
        patterns, terms = spoke.patterns(), spoke.terms()
    else:
        sysdir = system(root, "frontiers-written-voice")
        patterns, terms = written.load([sysdir / "patterns.json"]), written.load_terms([sysdir / "terms.json"])
    out: Problems = []
    for p in paths:
        where = rel(root, p)
        m = mode or ("procedure" if fixtures_only and p.name.startswith("procedure-") else "prose")

        def one(p: Path = p, m: str = m, where: str = where) -> Problems:
            text = written.prose(p.read_text(encoding="utf-8"), p.suffix)
            fails, warns = written.sweep(text, patterns, mode=m, terms=terms)
            if draft:
                fails, warns = [], fails + warns
            return [("error", where, f) for f in fails] + [("warning", where, w) for w in warns]
        try:
            out += one()
        except (OSError, ValueError, KeyError, UnicodeDecodeError) as e:
            out.append(("error", where, f"the check could not run: {type(e).__name__}: {e}"))
    return out
