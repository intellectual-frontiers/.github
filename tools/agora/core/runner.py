"""`check [SECTION...] [--scope ID] [--suite SUITE] [--changed]` (0041-command-line FR-031 to FR-033)."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import worker
from .checks import SectionResult, changed_paths, section_changed
from .ctx import Ctx
from .registry import Section
from .resource import FAILED, MISSING, OK, USAGE, Action, AgoraError, Call, Resource, next_command


def scopes_of(scope: str | list[str] | None) -> list[str]:
    """`--scope` as a list: it may be given more than once for a section that takes many (0042 FR-013)."""
    return [] if scope is None else [scope] if isinstance(scope, str) else list(scope)


def validate_selection(ctx: Ctx, sections: list[str], suite: str | None, scope: str | list[str] | None, runner: str | None = None,
                       brand: str | None = None, paragon: str | None = None, root_ctx: Ctx | None = None,
                       mode: str | None = None, draft: bool = False, spoken: bool = False) -> list[str]:
    """The section names `check` would run for these arguments, or an error resource (exit 2). Names are in
    declaration order, suite first."""
    reg = ctx.registry
    names: list[str] = []
    if suite:
        if suite not in reg.suites:
            raise AgoraError("invalid-argument", f"--suite {suite!r} is not a suite; the suites are {', '.join(reg.suites)}",
                             exit=USAGE, actions=[next_command("list the suites", "command show", command="check")])
        names += reg.suites[suite]["sections"]
        for flag, value in (("runner", runner), ("brand", brand), ("paragon", paragon)):
            fixed = reg.suites[suite].get("options", {}).get(flag)
            if fixed and value is not None and value != fixed:
                raise AgoraError("usage", f"--{flag} {value} conflicts with suite {suite}, which runs --{flag} {fixed}", exit=USAGE)
    names += [s for s in sections if s not in names]
    chosen = [reg.sections[n] for n in names]
    scopes = scopes_of(scope)
    if scopes:
        takers = [s for s in chosen if s.scope]
        if not takers:
            raise AgoraError("usage", "--scope applies to a section that supports it; none selected does", exit=USAGE)
        if len(scopes) > 1 and not all(s.many for s in takers):
            one = [s.name for s in takers if not s.many]
            raise AgoraError("usage", f"--scope was given {len(scopes)} times; section {', '.join(one)} takes one", exit=USAGE)
        t = reg.types.get(takers[0].scope or "")
        for one_scope in scopes if t is not None else ():
            try:
                t.validate(root_ctx or ctx, one_scope)
            except ValueError as e:
                raise AgoraError("invalid-argument", f"--scope: {e}. A {t.name} is {t.doc}", exit=USAGE,
                                 detail={"type": t.name, "value": one_scope}) from None
    for flag, value in (("--runner", runner), ("--brand", brand), ("--paragon", paragon), ("--mode", mode),
                        ("--draft", draft or None), ("--spoken", spoken or None)):
        if value is not None and not any(flag in s.options for s in chosen):
            raise AgoraError("usage", f"{flag} applies to a section that declares it; none selected does", exit=USAGE)
    return names


def run_check(ctx: Ctx, sections: list[str], suite: str | None, scope: str | list[str] | None, changed: bool, since: str | None,
              runner: str | None = None, brand: str | None = None, paragon: str | None = None, mode: str | None = None,
              draft: bool = False, spoken: bool = False) -> Resource:
    reg = ctx.registry
    explicit = bool(sections or suite)
    names = validate_selection(ctx, sections, suite, scope, runner, brand, paragon, mode=mode, draft=draft, spoken=spoken)
    scopes = scopes_of(scope)
    if suite:  # a suite may fix an option of its sections, such as the harness kind (0042 FR-014)
        fixed = reg.suites[suite].get("options", {})
        runner, brand, paragon = (v or fixed.get(k) for k, v in (("runner", runner), ("brand", brand), ("paragon", paragon)))
    ctx.section_options = {k: v for k, v in (("runner", runner), ("brand", brand), ("paragon", paragon), ("mode", mode),
                                             ("draft", draft), ("spoken", spoken)) if v}
    if not explicit:
        names = list(reg.sections)
    if explicit and not names:
        raise AgoraError("empty", f"suite {suite} names no section; it ran nothing", exit=FAILED,
                         actions=[next_command("run a suite that has sections", "check", suite="spec")])
    chosen: list[Section] = [reg.sections[n] for n in names]
    if ctx.relocated:
        bad = [s.name for s in chosen if not s.relocatable]
        if bad:
            raise AgoraError("usage", f"--root: section {', '.join(bad)} is not relocatable (0041 FR-040)", exit=USAGE)
    skipped_unchanged: list[dict[str, str]] = []
    if changed:
        paths = changed_paths(ctx, since)
        keep = []
        for s in chosen:
            run, why = section_changed(s.watch, paths)
            (keep if run else skipped_unchanged).append(s if run else {"name": s.name, "reason": why})
        chosen = keep
    results: list[SectionResult] = []
    tell = ctx.on_section or (lambda event, name, result: None)  # a surface that streams hears of each section
    for s in chosen:
        tell("start", s.name, None)
        lacking = _toolchain_problem(ctx, s)
        if lacking:
            results.append(SectionResult(s.name, "skipped", reason=lacking))
        else:
            mine = _scope_for(s, scopes)
            if worker.needs_worker(ctx, s):
                results.append(worker.run_section(ctx, s, mine))
            else:
                results.append(s.fn(ctx, mine))
        tell("done", s.name, results[-1])
    failed = [r for r in results if r.status == "failed"]
    skipped = [r for r in results if r.status == "skipped"]
    status = "failed" if failed else "skipped" if skipped else "passed"
    label = suite or (" ".join(sections) if sections else "all")
    data: dict[str, Any] = {
        "suite": suite, "scope": scopes[0] if len(scopes) == 1 else scopes or None, "changed": changed, "status": status,
        "summary": {"run": len(results), "passed": len(results) - len(failed) - len(skipped), "failed": len(failed),
                    "skipped": len(skipped)},
        "sections": [r.to_dict() for r in results],
        "skipped_unchanged": skipped_unchanged,
    }
    res = Resource("check", label, data, text=_text, exit=FAILED if failed else MISSING if skipped else OK)
    res.actions = [next_command(f"run {r.name} again", "check", sections=[r.name]) for r in failed + skipped]
    return res


def _toolchain_problem(ctx: Ctx, s: Section) -> str:
    """Why a section whose toolchain entries cannot be had does not run (it is skipped, exit 3), or an empty string; an entry
    the cache lacks is fetched here, on first use, unless offline (0025-tooling-environment FR-017, FR-018)."""
    if not s.toolchain or (s.toolchain_unless and ctx.section_options.get(s.toolchain_unless)):
        return ""
    try:
        ctx.toolchain().use(s.toolchain)
    except AgoraError as e:
        return e.message
    return ""


def _scope_for(s: Section, scopes: list[str]) -> Any:
    """What a section's function receives as `scope`: nothing, one value, or for a section that takes many a list, whose
    paths are made absolute here, since a worker runs in another directory."""
    if not s.scope or not scopes:
        return None
    if s.many:
        return [str(Path(v).resolve()) for v in scopes] if s.scope == "PATH" else list(scopes)
    return scopes[0]


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
    m = d["summary"]
    out.append(f"check {res.id}: {d['status']}: {m['run']} section(s) run, {m['failed']} failed, {m['skipped']} skipped")
    return "\n".join(out)
