"""The repository-wide commands: check, test, doctor, lock, context, and `command list|show` (0042-agora FR-005).

Thin: each calls library code (0041-command-line FR-024). Standard library only.
"""
from __future__ import annotations

import json
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from agora.core import (Arg, Action, AgoraError, Call, Choice, Ctx, Dynamic, Finding, Link, Opt, Pattern, Resource,
                        SectionResult, command, next_command, section)
from agora.core import generate, plan, presentation, toolchain
from agora.core.checks import changed_paths, section_changed
from agora.core import runner as checkrun
from agora.core.describe import command_data
from agora.core.mcp import Server
from agora.core.registry import CATEGORIES, VERBS, WRITES, context_for
from agora.core.resource import FAILED, MISSING, OK
from agora.core.types import COMMIT  # noqa: F401  (declared here, once, for every group)
from agora.lib import layout, node, ontology, testrun

SECTION = Dynamic("SECTION", "a check section, as `command show check` lists them", lambda c: list(c.registry.sections))
SUITE = Dynamic("SUITE", "a named set of check sections", lambda c: list(c.registry.suites))
GROUP = Dynamic("GROUP", "a command group", lambda c: list(c.registry.groups))
COMMAND = Dynamic("COMMAND", "a command's words, as `command list` shows them", lambda c: list(c.registry.commands))
CATEGORY = Choice("CATEGORY", CATEGORIES, "a command category")
GENERATOR = Dynamic("GENERATOR", "a generator, as `fresh` proves it: brand-theme, brand-specimen, ...", lambda c: list(c.registry.generators))
VOICE_MODE = Choice("VOICE_MODE", ("prose", "procedure"), "how the voice sweep reads a text: as prose or as a procedure's steps")
RUNNER = Choice("RUNNER", ("browser", "python"), "which harness: browser or python for design-systems")


class _Resource(Dynamic):
    """RESOURCE: `kind:id`, or a bare id the kinds can tell apart (0041 FR-038)."""

    def __init__(self):
        super().__init__("RESOURCE", "a resource as kind:id, such as spec:0020 or requirement:0020/FR-013",
                         lambda c: [f"{k}:" for k in c.registry.contexts])

    def validate(self, ctx: Ctx, value: str) -> str:
        reg = ctx.registry
        kinds = reg.contexts
        if ":" in value and value.split(":", 1)[0] in kinds:
            kind, ident = value.split(":", 1)
            return f"{kind}:{reg.types[kinds[kind][0]].validate(ctx, ident)}"
        for kind, (tname, _) in kinds.items():
            try:
                return f"{kind}:{reg.types[tname].validate(ctx, value)}"
            except ValueError:
                continue
        raise ValueError(f"{value!r} names no resource of kind {', '.join(kinds)}")

    def examples(self, ctx: Ctx) -> list[str]:
        return ["spec:0020", "requirement:0020/FR-013"]

    def complete(self, ctx: Ctx, prefix: str) -> list[str]:
        out = [f"{k}:" for k in ctx.registry.contexts if f"{k}:".startswith(prefix)]
        if ":" in prefix:
            kind, rest = prefix.split(":", 1)
            if kind in ctx.registry.contexts:
                t = ctx.registry.types[ctx.registry.contexts[kind][0]]
                out += [f"{kind}:{v}" for v in t.complete(ctx, rest)]
        return out


RESOURCE = _Resource()


# command list | show ---------------------------------------------------------------------------------------------
@command("command list", category="read", help="List the registry's commands", relocatable=True,
         options=[Opt("--category", "CATEGORY", "only this category")])
def command_list(ctx: Ctx, category: str | None) -> Resource:
    reg = ctx.registry
    rows = []
    for c in sorted(reg.commands.values(), key=lambda c: c.id):
        if category and c.category != category:
            continue
        rows.append({"id": c.id, "noun": c.noun, "verb": c.verb, "category": c.category, "group": c.group or None, "surfaces": ["terminal", *reg.surfaces_of(c)],
                     "help": c.help, **presentation.of_command(reg, c.id)})
    res = Resource("command-list", "all", {"count": len(rows), "commands": rows, "presentation": presentation.emit(reg)},
                   links=[Link("command", Call("command show", {"command": r["id"]})) for r in rows])
    res.columns["commands"] = ["id", "category", "group", "surfaces"]
    return res


@command("command show", category="read", help="Show one command: arguments, surfaces, group and programs", relocatable=True,
         args=[Arg("command", "COMMAND", "the command's words", words=True)])
def command_show(ctx: Ctx, command: str) -> Resource:
    reg = ctx.registry
    c = reg.commands[command]
    d = command_data(reg, c, ctx)
    res = Resource("command", c.id, d)
    res.columns["arguments"] = ["name", "type", "required", "help", "choices"]
    res.columns["options"] = ["flag", "type", "help", "choices"]
    res.links = [Link("noun", Call("command list", {"category": c.category}))]
    return res


@context_for("command", "COMMAND")
def context_command(ctx: Ctx, ident: str) -> dict[str, Any]:
    d = command_show(ctx, ident)
    c = ctx.registry.commands[ident]
    mod = f"tools/agora/groups/{c.group}/commands.py" if c.group else ""
    return {"resource": d.data, "specs": [{"name": "0041-command-line", "status": "see spec show"}, {"name": "0042-agora", "status": "see spec show"}],
            "requirements": [], "files": [f for f in (mod, f"tools/agora/groups/{c.group}/agora.toml" if c.group else "",
                                                       "ontology/ifcore.ttl") if f],
            "links": d.links, "actions": d.actions}


# check -------------------------------------------------------------------------------------------------------------
@command("check", category="check", help="Run checks: sections, a suite, one scope, or only what changed", relocatable=True,
         args=[Arg("sections", "SECTION", "the sections to run; every section when none and no suite is named", many=True)],
         options=[Opt("--scope", "TEXT", "limit a section that supports it to one resource; the item checks take it more than once", multiple=True),
                  Opt("--suite", "SUITE", "run a named set of sections"),
                  Opt("--changed", None, "run only sections whose watched paths changed"),
                  Opt("--since", "TEXT", "with --changed, also what differs from this Git commit"),
                  Opt("--runner", "RUNNER", "design-systems: browser or python"),
                  Opt("--brand", "BRAND", "design-systems: one brand"),
                  Opt("--paragon", "TEXT", "openedx: Paragon's CLI, to rebuild dist/ (PARAGON in the environment otherwise)"),
                  Opt("--mode", "VOICE_MODE", "voice: sweep as prose or as a procedure (prose by default)"),
                  Opt("--draft", None, "voice: report every failure as a warning"),
                  Opt("--spoken", None, "voice: sweep as a script to be spoken, with the spoken voice's patterns too")])
def check(ctx: Ctx, sections: list[str], scope: list[str], suite: str | None, changed: bool, since: str | None,
          runner: str | None, brand: str | None, paragon: str | None, mode: str | None, draft: bool, spoken: bool) -> Resource:
    return checkrun.run_check(ctx, sections, suite, scope, changed, since, runner, brand, paragon, mode, draft, spoken)


# fresh -------------------------------------------------------------------------------------------------------------
@command("fresh", category="check", help="Prove every generator's tracked output current, writing nothing", relocatable=False,
         args=[Arg("generators", "GENERATOR", "the generators to prove; every one when none is named", many=True)],
         options=[Opt("--changed", None, "prove only generators whose sources or outputs changed")])
def fresh(ctx: Ctx, generators: list[str], changed: bool) -> Resource:
    reg = ctx.registry
    names = generators or list(reg.generators)
    skipped_unchanged: list[dict[str, str]] = []
    if changed:
        paths = changed_paths(ctx, None)
        keep = []
        for n in names:
            run, why = section_changed(reg.generators[n].watch, paths)
            (keep.append(n) if run else skipped_unchanged.append({"name": n, "reason": why}))
        names = keep
    rows = [generate.prove(ctx, reg.generators[n]) for n in names]
    stale = [r for r in rows if r["status"] == "stale"]
    skipped = [r for r in rows if r["status"] == "skipped"]
    status = "stale" if stale else "skipped" if skipped else "fresh"
    data = {"status": status, "generators": rows, "skipped_unchanged": skipped_unchanged,
            "summary": {"run": len(rows), "fresh": sum(r["status"] == "fresh" for r in rows), "stale": len(stale),
                        "skipped": len(skipped)}}
    res = Resource("fresh", " ".join(generators) or "all", data, text=_fresh_text,
                   exit=FAILED if stale else MISSING if skipped else OK)
    res.columns["generators"] = ["name", "status", "files"]
    seen: set[str] = set()
    for r in stale:
        for f in r["stale"]:
            c = f.get("call")
            key = json.dumps(c, sort_keys=True)
            if c and key not in seen:
                seen.add(key)
                res.actions.append(next_command(f"rewrite what {r['name']} writes", c["command"], **c["fields"]))
    res.actions += [next_command(f"prove {r['name']} again", "fresh", generators=[r["name"]]) for r in stale + skipped]
    return res


def _fresh_text(res: Resource) -> str:
    d = res.data
    out: list[str] = []
    for r in d["generators"]:
        if r["status"] == "skipped":
            out.append(f"⏭️  {r['name']}: skipped, {r['reason']}")
        elif r["status"] == "stale":
            for f in r["stale"]:
                out.append(f"❎ {r['name']}: {f['path']} {f['why']}" + (f"; run `{f['rewrite']}`" if f["rewrite"] else ""))
            out.append(f"❎ {r['name']}: {len(r['stale'])} stale of {r['files']} file(s)")
        else:
            out.append(f"✅ {r['name']}: {r['files']} file(s) current")
    for s in d["skipped_unchanged"]:
        out.append(f"⏭️  {s['name']}: not proved ({s['reason']})")
    m = d["summary"]
    out.append(f"fresh: {d['status']}: {m['run']} generator(s) proved, {m['stale']} stale, {m['skipped']} skipped")
    return "\n".join(out)


# test --------------------------------------------------------------------------------------------------------------
@command("test", category="check", help="Run agora's own tests with the standard library's runner, under the selftest group's locked packages")
def test(ctx: Ctx) -> Resource:
    tests = ctx.home / "tools" / "agora" / "tests"
    env = {**ctx.env, "PYTHONPATH": str(ctx.home / "tools"), "PYTHONDONTWRITEBYTECODE": "1", "AGORA_TESTING": "1"}
    py = plan.prepare(ctx.registry, "selftest", offline=ctx.offline, command="test")
    p = subprocess.run([str(py), "-m", "unittest", "discover", "-s", str(tests), "-t", str(ctx.home / "tools")],
                       capture_output=True, text=True, env=env, cwd=ctx.home)
    data = testrun.summarize(p.returncode, p.stderr)
    failed = data["status"] == "failed"
    res = Resource("test", "agora", data, exit=FAILED if failed else OK)
    if failed:
        res.actions = [next_command("run the tests again", "test")]
    return res


# doctor ------------------------------------------------------------------------------------------------------------
@command("doctor", category="check", help="Report what agora needs and what is present; fail on registry conflicts")
def doctor(ctx: Ctx) -> Resource:
    reg = ctx.registry
    rm = reg.root_manifest
    missing: list[str] = []
    prereq = []
    for name, spec in rm.get("prerequisites", {}).items():
        path = shutil.which(name)
        ver = ""
        if path and name == "uv":
            ver = subprocess.run([path, "--version"], capture_output=True, text=True).stdout.strip()
        if name == "python3":
            ok = sys.version_info >= (3, 11)
            ver = platform.python_version()
            path = path or sys.executable
            if not ok:
                path = None
        prereq.append({"name": name, "present": bool(path), "version": ver, "path": path or "", "hint": spec.get("hint", "")})
        if not path:
            missing.append(name)
    groups = []
    problems = list(reg.validate()) + reg.plan_conflicts()
    cache = plan.uv_cache_dir()
    for g in reg.groups.values():
        lp = plan.lock_problems(g)
        problems += lp
        in_cache = ""
        if g.packages:
            in_cache = "yes" if cache and (cache / "agora").is_dir() and any((cache / "agora").glob(f"{g.name}-*/.agora-ready")) else "no"
        groups.append({"group": g.name, "packages": [f"{k}=={v}" for k, v in sorted(g.packages.items())] or "none",
                       "lock": ("ok" if g.packages and not lp else "problem" if lp else "none needed"),
                       "in cache": in_cache or "n/a", "plan": plan.plan_for(reg, g.name).describe()})
    # The toolchain (0025 FR-015): each entry's state as ws-host says it and the commands that need it. An entry not yet installed is not a
    # fault: a command that needs it has ws-host install it on first use.
    tc = ctx.toolchain()
    needed_by: dict[str, list[str]] = {}
    for c in reg.commands.values():
        for n in c.toolchain:
            needed_by.setdefault(n, []).append(c.id)
        for n in c.toolchain_optional:
            needed_by.setdefault(n, []).append(f"{c.id} (for one edition)")
    for sec in reg.sections.values():
        for n in sec.toolchain:
            needed_by.setdefault(n, []).append(f"check {sec.name}")
        for n in sec.toolchain_optional:
            needed_by.setdefault(n, []).append(f"check {sec.name} (when it can)")
    for g in reg.groups.values():
        for kind, label in (("runners", "check design-systems --runner"), ("harnesses", "check design-systems")):
            for key, spec in g.manifest.get(kind, {}).items():
                for n in spec.get("toolchain", []):
                    needed_by.setdefault(n, []).append(f"{label} {key.replace(':', ' ')}" if kind == "harnesses" else f"{label} {key}")
    for gen in reg.generators.values():
        for n in gen.toolchain:
            needed_by.setdefault(n, []).append(f"fresh {gen.name}")
    toolchain_rows = []
    try:
        entries = tc.entries
    except toolchain.ToolchainError as e:
        entries = {}
        missing.append("ws-host's answer about this provider")
        problems_note = e.message
    else:
        problems_note = ""
    for e in entries.values():
        toolchain_rows.append({"entry": e.name, "version": e.version, "platform": toolchain.platform_name(),
                               "cache": "ready" if e.state == "ready" else "not installed",
                               "needed by": sorted(needed_by.get(e.name, [])),
                               "hint": "" if e.state == "ready" else (f"installed on first use, or `ws-host toolchain ensure {e.name} --provider agora`")})
    status = "failed" if problems else "missing" if missing else "ok"
    data = {"status": status, "prerequisites": prereq, "groups": groups, "toolchain": toolchain_rows,
            "conflicts": problems, "missing": missing, "offline": ctx.offline, **({"note": problems_note} if problems_note else {}),
            "commands": len(reg.commands)}
    res = Resource("doctor", reg.name, data, exit=FAILED if problems else MISSING if missing else OK)
    res.columns["prerequisites"] = ["name", "present", "version", "hint"]
    res.columns["toolchain"] = ["entry", "version", "cache", "needed by", "hint"]
    res.columns["groups"] = ["group", "packages", "lock", "in cache", "plan"]
    if problems or missing:
        res.actions = [next_command("run the doctor again", "doctor")]
    return res


# lock --------------------------------------------------------------------------------------------------------------
@command("lock", category="setup", help="Write a group's hashed lock from the packages its manifest pins, through uv",
         args=[Arg("group", "GROUP", "the group; every group that pins packages when none is named", required=False)])
def lock(ctx: Ctx, group: str | None) -> Resource:
    reg = ctx.registry
    if ctx.offline:
        raise AgoraError("offline", "lock resolves packages and must run online; run it without --offline", exit=MISSING,
                         actions=[next_command("lock online", "lock", group=group)])
    targets = [reg.groups[group]] if group else list(reg.groups.values())
    pinned = [g for g in targets if g.packages]
    if not pinned:
        return Resource("lock", group or "all", {"locked": [], "message": "no group pins packages; there is nothing to lock",
                                                 "dry_run": ctx.dry_run})
    uv = shutil.which("uv")
    if not uv:
        raise AgoraError("missing-program", "lock needs uv", exit=MISSING,
                         detail={"program": "uv", "hint": reg.root_manifest["prerequisites"]["uv"]["hint"]})
    changes = []
    for g in pinned:
        with tempfile.TemporaryDirectory() as d:
            inp, out = Path(d, "in.txt"), Path(d, "out.txt")
            inp.write_text("".join(f"{k}=={v}\n" for k, v in sorted(g.packages.items())), encoding="utf-8")
            p = subprocess.run([uv, "pip", "compile", "--generate-hashes", "--no-header", "--no-annotate", "--quiet", "--python-version", "3.11", "-o", str(out),
                                str(inp)], capture_output=True, text=True)
            if p.returncode != 0:
                raise AgoraError("lock", f"uv could not lock group {g.name}: {p.stderr.strip()[-400:]}", exit=FAILED)
            text = f"{plan.STAMP}{plan.pins_stamp(g.packages)}\n" + out.read_text(encoding="utf-8")
        old = g.lock.read_text(encoding="utf-8") if g.lock.is_file() else None
        changes.append({"group": g.name, "lock": str(g.lock.relative_to(ctx.home)), "change": "unchanged" if old == text else "create" if old is None else "modify"})
        if not ctx.dry_run and old != text:
            g.lock.write_text(text, encoding="utf-8")
    return Resource("lock", group or "all", {"locked": changes, "dry_run": ctx.dry_run})


# mcp ---------------------------------------------------------------------------------------------------------------
@command("mcp serve", category="setup", help="Serve MCP over standard input and output until the client closes it: for AI agents")
def mcp_serve(ctx: Ctx):
    """The protocol owns standard output: this command returns no resource of its own (0041 FR-027)."""
    Server(ctx.registry, ctx.home, ctx.env).serve(sys.stdin, sys.stdout)
    yield from ()


# context -----------------------------------------------------------------------------------------------------------
MAX_ITEMS = 60  # a context is bounded; it says what it left out (0041 FR-038)


@command("context", category="read", help="Return what an agent needs to work on one resource", relocatable=True,
         args=[Arg("resource", "RESOURCE", "kind:id, such as spec:0020 or requirement:0020/FR-013")])
def context(ctx: Ctx, resource: str) -> Resource:
    kind, ident = resource.split(":", 1)
    got = ctx.registry.contexts[kind][1](ctx, ident)
    omitted = list(got.get("omitted", []))
    data: dict[str, Any] = {"resource": got["resource"]}
    for key in ("specs", "requirements", "files"):
        items = got.get(key, [])
        if len(items) > MAX_ITEMS:
            omitted.append(f"{len(items) - MAX_ITEMS} of {len(items)} {key} (use the links to fetch them)")
        data[key] = items[:MAX_ITEMS]
    data["omitted"] = omitted
    res = Resource("context", resource, data, links=got.get("links", []), actions=got.get("actions", []))
    res.columns["requirements"] = ["id", "mechanism", "text"]
    return res


# the commands section ----------------------------------------------------------------------------------------------
@section("commands")
def check_commands(ctx: Ctx, scope: str | None) -> SectionResult:
    """0042-agora FR-004: registry and ontology agree; plus the registry's own grammar (0041 FR-008 to FR-014, FR-022)."""
    reg = ctx.registry
    findings = [Finding("error", "tools/agora", p) for p in reg.validate()]
    findings += layout.check_layout(ctx.home, reg)
    findings += layout.check_workflows(ctx.home)
    findings += layout.check_scripts(ctx.home)
    findings += layout.check_removed_scripts(ctx.home)
    findings += layout.check_boundaries(ctx.home, reg.root_manifest.get("register_name"))
    findings += layout.check_watched(reg)
    findings += layout.check_readme(ctx.home, reg)
    findings += layout.check_guide_files(ctx.home)
    findings += layout.check_proposals(ctx)
    findings += [Finding("error", "tools/agora", p) for p in presentation.data_problems(ctx)]
    ttl_path = ctx.home / "ontology" / "ifcore.ttl"
    onto = ontology.command_individuals(ttl_path.read_text(encoding="utf-8")) if ttl_path.is_file() else {}
    for cid, c in sorted(reg.commands.items()):
        ind = onto.get(cid)
        if ind is None:
            findings.append(Finding("error", "ontology/ifcore.ttl", f"command {cid!r} is in the registry and has no ifcore:Command individual (0042 FR-004)"))
            continue
        want = {"noun": c.noun, "verb": c.verb if c.verb in VERBS else None, "category": c.category}
        for k, v in want.items():
            if ind[k] != v:
                findings.append(Finding("error", f"ontology/ifcore.ttl: {ind['iri']}", f"{k} is {ind[k]!r}; the registry says {v!r} (0042 FR-004)"))
    for cid, ind in sorted(onto.items()):
        if cid not in reg.commands:
            findings.append(Finding("error", f"ontology/ifcore.ttl: {ind['iri']}", f"declares command {cid!r}, which the registry does not (0042 FR-004)"))
    decisions = sorted(c.id for c in reg.commands.values() if c.category == "decision")
    notes = [f"commands: {len(reg.commands)} in the registry, "
             f"{len(onto)} in the ontology; decisions: {', '.join(decisions)}"]
    return SectionResult.from_findings("commands", findings, notes,
                                       {"registry": len(reg.commands), "ontology": len(onto), "decisions": decisions})
