"""`check [SECTION...] [--scope ID] [--suite SUITE] [--changed]` (0041-command-line FR-031 to FR-033)."""
from __future__ import annotations

from typing import Any

from . import worker
from .checks import SectionResult, changed_paths, program_missing, section_changed
from .ctx import Ctx
from .registry import Section
from .resource import FAILED, MISSING, OK, USAGE, Action, AgoraError, Call, Resource, next_command


def validate_selection(ctx: Ctx, sections: list[str], suite: str | None, scope: str | None, runner: str | None = None,
                       brand: str | None = None, root_ctx: Ctx | None = None) -> list[str]:
    """The section names `check` would run for these arguments, or an error resource (exit 2). Names are in
    declaration order, suite first."""
    reg = ctx.registry
    names: list[str] = []
    if suite:
        if suite not in reg.suites:
            raise AgoraError("invalid-argument", f"--suite {suite!r} is not a suite; the suites are {', '.join(reg.suites)}",
                             exit=USAGE, actions=[next_command("list the suites", "command show", command="check")])
        names += reg.suites[suite]["sections"]
    names += [s for s in sections if s not in names]
    chosen = [reg.sections[n] for n in names]
    if scope is not None:
        takers = [s for s in chosen if s.scope]
        if not takers:
            raise AgoraError("usage", "--scope applies to a section that supports it; none selected does", exit=USAGE)
        t = reg.types.get(takers[0].scope or "")
        if t is not None:
            try:
                t.validate(root_ctx or ctx, scope)
            except ValueError as e:
                raise AgoraError("invalid-argument", f"--scope: {e}. A {t.name} is {t.doc}", exit=USAGE,
                                 detail={"type": t.name, "value": scope}) from None
    for flag, value in (("--runner", runner), ("--brand", brand)):
        if value is not None and not any(flag in s.options for s in chosen):
            raise AgoraError("usage", f"{flag} applies to a section that declares it; none selected does", exit=USAGE)
    return names


def run_check(ctx: Ctx, sections: list[str], suite: str | None, scope: str | None, changed: bool, since: str | None,
              runner: str | None = None, brand: str | None = None) -> Resource:
    reg = ctx.registry
    explicit = bool(sections or suite)
    names = validate_selection(ctx, sections, suite, scope, runner, brand)
    planned_rows: list[dict[str, str]] = []
    if not explicit:
        names = [n for n, s in reg.sections.items() if s.status == "implemented"]
        planned_rows = [{"name": n, "reason": "planned: not implemented yet"} for n, s in reg.sections.items() if s.status == "planned"]
    elif suite:
        planned_rows = [{"name": p, "reason": "planned: not implemented yet"} for p in reg.suites[suite]["planned"]]
    unrunnable = [n for n in names if reg.sections[n].status == "planned"]
    if unrunnable:
        raise AgoraError("not-implemented", f"section {', '.join(unrunnable)} is declared but not implemented yet; it ran nothing",
                         exit=FAILED, actions=[next_command("run what is implemented", "check")])
    if explicit and not names:
        raise AgoraError("not-implemented", f"suite {suite} has no implemented section yet (planned: "
                         f"{', '.join(reg.suites[suite]['planned']) or 'none'}); it ran nothing", exit=FAILED,
                         actions=[next_command("run what is implemented", "check", suite="spec")])
    chosen: list[Section] = [reg.sections[n] for n in names]
    if ctx.relocated:
        bad = [s.name for s in chosen if not s.relocatable]
        if bad:
            raise AgoraError("usage", f"--root: section {', '.join(bad)} is not relocatable (0041 FR-040)", exit=USAGE)
    skipped_unchanged: list[dict[str, str]] = []
    if changed:
        paths = changed_paths(ctx.root, since)
        keep = []
        for s in chosen:
            run, why = section_changed(s.watch, paths)
            (keep if run else skipped_unchanged).append(s if run else {"name": s.name, "reason": why})
        chosen = keep
    results: list[SectionResult] = []
    for s in chosen:
        missing = program_missing(ctx, s.programs)
        if missing:
            hints = "; ".join(f"{m}: {reg.program(m).get('hint', 'install it on the host')}" for m in missing)
            results.append(SectionResult(s.name, "skipped", reason=f"needs {', '.join(missing)}, which is not on PATH ({hints})"))
        elif worker.needs_worker(ctx, s):
            results.append(worker.run_section(ctx, s, scope if s.scope else None))
        else:
            r = s.fn(ctx, scope if s.scope else None)
            results.append(r)
    failed = [r for r in results if r.status == "failed"]
    skipped = [r for r in results if r.status == "skipped"]
    status = "failed" if failed else "skipped" if skipped else "passed"
    label = suite or (" ".join(sections) if sections else "all")
    data: dict[str, Any] = {
        "suite": suite, "scope": scope, "changed": changed, "status": status,
        "summary": {"run": len(results), "passed": len(results) - len(failed) - len(skipped), "failed": len(failed),
                    "skipped": len(skipped)},
        "sections": [r.to_dict() for r in results],
        "skipped_unchanged": skipped_unchanged, "planned": planned_rows,
    }
    res = Resource("check", label, data, text=_text, exit=FAILED if failed else MISSING if skipped else OK)
    res.actions = [next_command(f"run {r.name} again", "check", sections=[r.name]) for r in failed + skipped]
    return res


def _text(res: Resource) -> str:
    d = res.data
    out: list[str] = []
    for s in d["sections"]:
        errors = sum(1 for f in s["findings"] if f["level"] == "error")
        for f in s["findings"]:
            out.append(f"{'❎' if f['level'] == 'error' else '🟡'} {f['where']}: {f['message']}")
        out += s["notes"]
        if s["status"] == "skipped":
            out.append(f"⏭️  {s['name']}: skipped, {s['reason']}")
        else:
            out.append(f"✅ {s['name']}" if s["status"] == "passed" else f"❎ {s['name']}: {errors} error(s)")
    for s in d["skipped_unchanged"]:
        out.append(f"⏭️  {s['name']}: not run ({s['reason']})")
    if d["planned"]:
        out.append("⏳ planned, not implemented yet, so not run: " + ", ".join(s["name"] for s in d["planned"]))
    m = d["summary"]
    out.append(f"check {res.id}: {d['status']}: {m['run']} section(s) run, {m['failed']} failed, {m['skipped']} skipped")
    return "\n".join(out)
