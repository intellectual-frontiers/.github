"""The assurance checks: every design system's harness, each brand's imagery, and its Open edX package (0042-agora FR-013,
FR-014, FR-017); and the organization profile's figure, which needs the same locked packages (FR-015).

Thin: the rules live in agora.lib. Standard library only here; the harnesses run in this group's locked environment, as
subprocesses of their own documented command lines.
"""
from __future__ import annotations

import subprocess
import sys

from agora.core import AgoraError, Ctx, Dynamic, Finding, Resource, SectionResult, command, next_command, section
from agora.core import files
from agora.core.generate import Generated
from agora.core.registry import generator
from agora.lib import assurance, imagery, openedx, profile_figure


def _brands(ctx: Ctx) -> list[str]:
    return assurance.brands(ctx.root)


BRAND = Dynamic("BRAND", "a brand's slug: a design system with a brand.css (0014-design-systems FR-028)", _brands)


def _progress(line: str) -> None:
    """The section's per-harness stream: stderr, so --json on stdout stays one document."""
    print(line, file=sys.stderr, flush=True)


def _manifest(ctx: Ctx) -> dict:
    return ctx.registry.groups["assurance"].manifest


def _env(ctx: Ctx) -> dict[str, str]:
    return ctx.env


# design-systems ----------------------------------------------------------------------------------------------------
@section("design-systems")
def check_design_systems(ctx: Ctx, scope: str | None) -> SectionResult:
    opts = ctx.section_options
    if opts.get("runner") in ("node", "vscode"):  # the extension's runners (0042 FR-013)
        return SectionResult("design-systems", "skipped", reason=f"--runner {opts['runner']} is for the extension; this section's runners are browser and python")
    harnesses, missing = assurance.plan(ctx.home, _manifest(ctx), scope, opts.get("brand"), opts.get("runner"))
    findings = [Finding("error", f"design-systems/{slug}", f"{slug} has no assurance harness, assurance/run.mjs or "
                        "assurance/run.py (0014-design-systems FR-015)") for slug in missing]
    if not harnesses and not missing:
        what = f" of kind {opts['runner']}" if opts.get("runner") else ""
        findings.append(Finding("error", f"design-systems/{scope}" if scope else "design-systems",
                                f"no assurance harness{what} to run: nothing was checked"))
    tc = ctx.toolchain()
    outcomes = [assurance.run_one(tc, h, ctx.home, _env(ctx), _progress) for h in harnesses]
    for slug in missing:
        _progress(f"❎ {slug} has no assurance harness, assurance/run.mjs or assurance/run.py (0014-design-systems FR-015)")
    findings += [Finding("error", o.harness.script, assurance.failure_message(o)) for o in outcomes if o.status == "failed"]
    skipped = [o for o in outcomes if o.status == "skipped"]
    ran = [o for o in outcomes if o.status != "skipped"]
    data = {"harnesses": [o.to_dict() for o in outcomes], "missing": missing,
            "summary": {"passed": sum(o.status == "passed" for o in outcomes), "failed": sum(o.status == "failed" for o in outcomes),
                        "skipped": len(skipped)}}
    notes = assurance.summarize(outcomes)
    res = SectionResult.from_findings("design-systems", findings, notes, data)
    if res.status == "passed" and skipped:
        res.status = "skipped"
        res.reason = (f"{len(skipped)} of {len(outcomes)} harness(es) did not run, {len(ran)} passed: "
                      + "; ".join(f"{o.harness.label} {o.reason}" for o in skipped))
    return res


# imagery -----------------------------------------------------------------------------------------------------------
@section("imagery")
def check_imagery(ctx: Ctx, scope: str | None) -> SectionResult:
    known = assurance.brands(ctx.home)
    findings: list[Finding] = []
    notes: list[str] = []
    rows = []
    if scope is not None and scope not in known:
        findings.append(Finding("error", f"design-systems/{scope}", f"{scope} is not a brand: it has no brand.css"))
    for name in [scope] if scope else known:
        if name not in known:
            continue
        brand = ctx.home / "design-systems" / name
        _progress(f"── {name}'s imagery and share card")
        pieces = 0
        try:
            problems = imagery.check(brand)
            pieces = len((imagery.catalog(brand) or {}).get("pieces", []))
        except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as e:
            problems = [f"the check could not run: {type(e).__name__}: {e}"]
        for p in problems:
            _progress(f"PROBLEM {name}: {p}")
            findings.append(Finding("error", f"design-systems/{name}", p))
        line = f"{name}: {pieces} pieces, {len(problems)} problems"
        _progress(line)
        notes.append(f"{'✅' if not problems else '❎'} {line}")
        rows.append({"brand": name, "pieces": pieces, "problems": len(problems)})
    return SectionResult.from_findings("imagery", findings, notes, {"brands": rows})


# openedx -----------------------------------------------------------------------------------------------------------
@section("openedx")
def check_openedx(ctx: Ctx, scope: str | None) -> SectionResult:
    findings: list[Finding] = []
    notes: list[str] = []
    rows = []
    paragon = assurance.paragon_path(ctx.section_options.get("paragon"))
    tc = ctx.toolchain()
    env = tc.clean_env()
    if paragon is not None and not paragon.is_file():
        findings.append(Finding("error", str(paragon), "Paragon's CLI is not a file; --paragon gives the paragon executable "
                                "of your own (without it, agora uses the one its npm lock installs)"))
        paragon = None
    elif paragon is None:
        try:
            resolved = tc.use(["npm-packages"])
        except AgoraError as e:
            return SectionResult("openedx", "skipped", reason=e.message)
        paragon, env = resolved.path_of("paragon"), resolved.env()
        for entry, path in tc.overridden_in(["npm-packages"]):
            _progress(f"   · {entry.name} is {path}, named by {entry.variable}, not the locked entry")
    with_package = assurance.openedx_brands(ctx.home)
    if scope is not None and scope not in with_package:
        findings.append(Finding("error", f"design-systems/{scope}", f"{scope} has no Open edX package: no openedx/ directory"))
    outcomes = []
    for name in [scope] if scope else with_package:
        if name not in with_package:
            continue
        script = ctx.home / "design-systems" / name / "assurance" / "run.py"
        if not script.is_file():
            findings.append(Finding("error", f"design-systems/{name}/assurance", f"{name} has an Open edX package and no "
                                    "assurance/run.py to check it (frontiers-brand FR-020)"))
            continue
        o = assurance.run_openedx(name, ctx.home, env, paragon, _progress)
        outcomes.append(o)
        rows.append(o.to_dict())
        if o.status == "failed":
            findings.append(Finding("error", o.harness.script, assurance.failure_message(o)))
    notes += assurance.summarize(outcomes)
    if not outcomes and not findings:
        findings.append(Finding("error", "design-systems", "no brand has an Open edX package: nothing was checked"))
    res = SectionResult.from_findings("openedx", findings, notes, {"paragon": str(paragon) if paragon else None, "brands": rows})
    skipped = [o for o in outcomes if o.status == "skipped"]
    if res.status == "passed" and skipped:
        res.status = "skipped"
        res.reason = "; ".join(f"{o.harness.slug}: {o.reason}" for o in skipped)
    return res


# the profile's figure ----------------------------------------------------------------------------------------------
def _figure(ctx: Ctx) -> dict:
    try:
        return profile_figure.render(ctx.root)
    except profile_figure.FigureProblem as e:
        raise AgoraError("figcheck", f"frontiers-figures rejects the profile's figure: {e}", exit=1) from None
    except FileNotFoundError as e:
        raise AgoraError("invalid-argument", f"the profile's figure needs {e.filename}, which this repository lacks", exit=1) from None


@generator("profile-figure")
def gen_profile_figure(ctx: Ctx, scope: str | None) -> Generated:
    return Generated(files=_figure(ctx))


@command("figure generate", category="generate",
         help="Write the organization profile's figure: its semantic source and the themed default and on-dark images")
def figure_generate(ctx: Ctx) -> Resource:
    changes = files.apply(ctx, _figure(ctx))
    return Resource("figure", "profile", {"dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("prove it current", "fresh", generators=["profile-figure"])])
