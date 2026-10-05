"""The toolchain lock's commands: `toolchain list|show|add`, `system list|add`, and the `toolchain` check section
(0041-command-line FR-066 to FR-069; 0042-agora FR-013, FR-030; 0025-tooling-environment FR-015 to FR-021).

Thin: the machinery is agora.core.toolchain and agora.core.system, the section's rules agora.lib.toolchain_rules. Standard
library only. `system add` is the only command in this command line that runs `sudo`.
"""
from __future__ import annotations

import subprocess
import sys
import time
from typing import Any, Callable

from agora.core import (AgoraError, Arg, Ctx, Dynamic, Finding, Link, Call, Opt, Resource, SectionResult, command,
                        next_command, section)
from agora.core import system, toolchain
from agora.core.resource import FAILED, MISSING, OK, USAGE
from agora.lib import toolchain_rules

ENTRY = Dynamic("ENTRY", "a toolchain entry, as `toolchain list` names them: tinytex, chromium, ...",
                lambda c: list(c.toolchain().entries))

# What `system add` runs commands with and asks the person with: replaced by the tests, never by a command.
RUN: Callable[..., Any] = subprocess.run
ASK: Callable[[str], str] = input
INTERACTIVE: Callable[[], bool] = lambda: sys.stdin.isatty()


def _mb(n: int) -> str:
    return f"{n / 1e6:.1f} MB" if n else "-"


def _row(tc: toolchain.Toolchain, e: toolchain.Entry) -> dict[str, Any]:
    archives = e.archives(tc.platform)
    return {"name": e.name, "version": e.version, "state": tc.state(e), "size": _mb(sum(a.size for a in archives)),
            "platforms": sorted(e.platforms), "variable": e.variable, "summary": e.summary}


def _consumer(tc: toolchain.Toolchain, e: toolchain.Entry) -> dict[str, Any]:
    """What a repository that builds on this one needs to use an entry as it stands (0025 FR-027): where it is installed, the
    environment to set, the programs it provides (absolute) and its version. `path` is null while the entry is not in the cache."""
    r = tc.resolve([e.name])
    base: dict[str, Any] = {"version": e.version, "state": tc.state(e), "path": None, "env": {}, "provides": {}}
    if not r.has_entry(e.name):
        return base
    path = r.entry_path(e.name)
    env = {k: str(v) for k, v in (e.env(r, path, tc.platform).items() if e.env else [])}
    provides = {}
    for prog in e.provides(tc.platform):
        try:
            provides[prog] = str(r.path_of(prog))
        except AgoraError:
            pass
    return {**base, "path": str(path), "env": env, "provides": provides}


def _pins(ctx: Ctx) -> dict[str, Any]:
    """The pinned Python packages across every group, and the node version, so another repository can check it uses the same pins."""
    packages: dict[str, str] = {}
    for g in ctx.registry.groups.values():
        for name, version in g.packages.items():
            packages[name] = version
    return {"packages": dict(sorted(packages.items())), "node": packages.get("nodejs-wheel-binaries")}


# toolchain list | show ---------------------------------------------------------------------------------------------
@command("toolchain list", category="read", help="List the toolchain entries: version, platforms and whether the cache holds each")
def toolchain_list(ctx: Ctx) -> Resource:
    tc = ctx.toolchain()
    rows = [{**_row(tc, e), **_consumer(tc, e)} for e in tc.entries.values()]
    pins = _pins(ctx)
    res = Resource("toolchain-list", "all", {"platform": tc.platform, "cache": str(tc.cache), "count": len(rows), "entries": rows,
                                             **pins},
                   links=[Link("entry", Call("toolchain show", {"entry": r["name"]})) for r in rows],
                   actions=[next_command("fetch every entry", "toolchain add")])
    res.columns["entries"] = ["name", "version", "state", "size", "platforms"]
    return res


@command("toolchain show", category="read", help="Show one entry: version, addresses and checksums per platform, what it provides, and the cache",
         args=[Arg("entry", "ENTRY", "the entry")])
def toolchain_show(ctx: Ctx, entry: str) -> Resource:
    tc = ctx.toolchain()
    e = tc.get(entry)
    platforms = [{"platform": p, "url": a.url, "sha256": a.sha256 if a.form != "npm-lock" else f"{a.sha256} (package-lock.json)",
                  "form": a.form, "size": _mb(a.size)} for p, archives in e.platforms.items() for a in archives]
    libs = list(e.needs_system(tc.platform)) if e.needs_system else []
    data = {"name": e.name, "version": e.version, "summary": e.summary, "host platform": tc.platform, "state": tc.describe(e),
            "programs": dict(e.provides(tc.platform)) if e.archives(tc.platform) else {}, "needs": list(e.needs),
            "override": f"{e.variable}={e.override_hint or 'a program of your own'}", **_consumer(tc, e),
            "system libraries": libs or "none", "platforms": platforms}
    res = Resource("toolchain-entry", e.name, data, actions=[next_command(f"fetch {e.name}", "toolchain add", entries=[e.name])])
    res.columns["platforms"] = ["platform", "form", "size", "url", "sha256"]
    return res


# toolchain add -----------------------------------------------------------------------------------------------------
@command("toolchain add", category="setup", surfaces=("editor",),  # widened to the editor (0041 FR-022): Home offers to fetch an entry
         help="Fetch, verify and unpack the entries (every one the host's platform has, when none is named) into the cache, and run each one's functional check",
         args=[Arg("entries", "ENTRY", "the entries; every one with a build for this platform when none is named", many=True)])
def toolchain_add(ctx: Ctx, entries: list[str]) -> Resource:
    tc = ctx.toolchain()
    names = entries or [n for n, e in tc.entries.items() if e.archives(tc.platform)]
    wanted = tc.expand(names)
    if ctx.offline:
        raise AgoraError("offline", "toolchain add downloads, so it cannot run offline; run it without --offline", exit=MISSING,
                         actions=[next_command("fetch online", "toolchain add", entries=entries)])
    rows: list[dict[str, Any]] = []
    status = OK
    for name in wanted:
        e = tc.get(name)
        before = tc.state(e)
        row: dict[str, Any] = {"entry": name, "version": e.version, "platform": tc.platform, "before": before, "did": "", "bytes": 0,
                               "seconds": 0.0, "check": ""}
        rows.append(row)
        if before == "no build":
            row.update(did="no build", check=f"{e.variable} names a program of your own")
            status = max(status, MISSING)
            continue
        if before == "override":  # a program of the person's own stands in: the locked one is neither fetched nor checked
            row.update(did="override", check=f"not run: {e.variable}={tc.override_path(e)} stands in for it")
            continue
        if ctx.dry_run:
            row["did"] = "would fetch" if before != "ready" else "already in the cache"
            row["bytes"] = sum(a.size for a in e.archives(tc.platform))
            continue
        if not tc.cached(e):
            start = time.monotonic()
            tc.fetch(e)
            m = tc.marker(e)
            row.update(did="fetched", bytes=m.get("bytes", 0), seconds=round(time.monotonic() - start, 1))
        else:
            row["did"] = "already in the cache"
    if not ctx.dry_run:
        for row in rows:
            if row["did"] in ("no build", "override"):
                continue
            e = tc.get(row["entry"])
            try:
                gone = tc.libraries_missing([row["entry"]], system.loads)
                if gone:
                    row["check"] = (f"not run: needs system libraries this host lacks ({', '.join(sorted(gone[row['entry']]))}); "
                                    "run `agora system add`")
                    status = max(status, MISSING)
                elif e.check is None:
                    row["check"] = "no check"
                else:
                    row["check"] = "passed: " + e.check(tc.resolve([row["entry"]]))
            except AgoraError as err:
                row["check"] = f"FAILED: {err.message}"
                status = max(status, FAILED)
    for row in rows:  # where each now is and the environment a consumer sets (0025 FR-027)
        row.update({k: v for k, v in _consumer(tc, tc.get(row["entry"])).items() if k not in ("version", "state")})
    res = Resource("toolchain-add", " ".join(entries) or "all", {"platform": tc.platform, "cache": str(tc.cache),
                                                                 "dry_run": ctx.dry_run, "entries": rows}, exit=status)
    res.columns["entries"] = ["entry", "version", "before", "did", "bytes", "seconds", "check"]
    if any("system libraries" in r["check"] for r in rows):
        res.actions.append(next_command("install the browser's system libraries", "system add"))
    return res


# system list | add -------------------------------------------------------------------------------------------------
def _needed(tc: toolchain.Toolchain) -> tuple[system.Family, tuple[str, ...]]:
    return system.family(), system.needed(tc.entries, tc.platform)


def _system_add_text(res: Resource) -> str:
    """The commands one to a line, exactly as they are run, so that what a person is asked about is what they read."""
    d = res.data
    out = [f"distribution: {d['distribution']}", f"dry_run: {'yes' if d['dry_run'] else 'no'}"]
    if d.get("missing"):
        out.append("missing:")
        out += [f"  {m['library']}  ({m['package']})" for m in d["missing"]]
    out.append("commands:" if d.get("commands") else "commands: (none)")
    out += [f"  {c}" for c in d.get("commands", [])]
    out.append(f"ran: {'yes' if d.get('ran') else 'no'}")
    if d.get("still_missing"):
        out.append(f"still missing: {', '.join(d['still_missing'])}")
    out.append(f"message: {d['message']}")
    return "\n".join(out)


@command("system list", category="read", help="List the shared libraries a browser and VS Code link and the display server VS Code's tests start under, the package that holds each on this host's distribution, and which are present")
def system_list(ctx: Ctx) -> Resource:
    tc = ctx.toolchain()
    fam, libs = _needed(tc)
    gone = {lib for lib, _ in system.missing(libs, fam)}
    rows = [{"library": lib, "package": fam.packages.get(lib, "") or "(no list for this distribution)", "present": lib not in gone}
            for lib in libs]
    res = Resource("system-list", "all", {"distribution": fam.label, "pinned list": fam.name if fam.packages else "none",
                                          "missing": len(gone), "libraries": rows},
                   actions=[next_command("install the missing libraries", "system add")] if gone else [])
    res.columns["libraries"] = ["library", "package", "present"]
    return res


@command("system add", category="setup",
         help="Install the missing shared libraries and the display server with the host's package manager through sudo: prints what it runs, asks first, never runs by itself",
         options=[Opt("--yes", None, "do not ask: for a person who has read what --dry-run prints, and for CI")])
def system_add(ctx: Ctx, yes: bool) -> Resource:
    if ctx.surface == "mcp":
        raise AgoraError("refused", "system add runs sudo and is never run over MCP (0041-command-line FR-069)", exit=USAGE)
    tc = ctx.toolchain()
    fam, libs = _needed(tc)
    gone = system.missing(libs, fam)
    base = {"distribution": fam.label, "dry_run": ctx.dry_run}
    if not gone:
        return Resource("system-add", "nothing", {**base, "missing": [], "commands": [], "ran": False,
                                                  "message": "every shared library the browser links is present; nothing to install"},
                        text=_system_add_text)
    names = [{"library": lib, "package": pkg or "(no list)"} for lib, pkg in gone]
    if not fam.packages:
        raise AgoraError("no-list", f"agora pins no package list for {fam.label}; install the packages that provide these "
                         f"libraries with its package manager: {', '.join(lib for lib, _ in gone)}", exit=MISSING,
                         detail={"distribution": fam.label, "libraries": [lib for lib, _ in gone]})
    cmds = system.commands(gone, fam)
    shown = [" ".join(c) for c in cmds]
    res = Resource("system-add", "install", {**base, "missing": names, "commands": shown, "ran": False,
                                             "message": "these commands install them" + ("" if system.uses_sudo(cmds) else
                                                                                         " (you are root: no sudo is needed)")},
                    text=_system_add_text)
    if ctx.dry_run:
        res.data["message"] += "; --dry-run runs nothing"
        return res
    if not yes:
        if not INTERACTIVE():
            raise AgoraError("not-confirmed", "system add asks before it runs sudo and there is no terminal to ask on; read "
                             "`system add --dry-run`, then run `system add --yes`", exit=USAGE, detail={"commands": shown},
                             actions=[next_command("see what it would run", "system add", dry_run=True)])
        print("system add will run:\n" + "\n".join(f"  {line}" for line in shown), file=sys.stderr)
        if ASK("run these commands? [y/N] ").strip().lower() not in ("y", "yes"):
            res.data["message"] = "not confirmed; nothing was run"
            res.exit = USAGE
            return res
    for argv in cmds:
        print(f"+ {' '.join(argv)}", file=sys.stderr, flush=True)
        code = RUN(argv).returncode
        if code != 0:
            raise AgoraError("install-failed", f"`{' '.join(argv)}` exited {code}", exit=FAILED, detail={"commands": shown})
    still = system.missing(libs, fam)
    res.data.update(ran=True, still_missing=[lib for lib, _ in still])
    res.data["message"] = "installed" if not still else f"installed, but these still do not load: {', '.join(lib for lib, _ in still)}"
    res.exit = FAILED if still else OK
    return res


# check toolchain ---------------------------------------------------------------------------------------------------
@section("toolchain")
def check_toolchain(ctx: Ctx, scope: str | None) -> SectionResult:
    tc = ctx.toolchain()
    findings = toolchain_rules.entry_findings(tc.entries, ctx.registry)
    findings += toolchain_rules.lock_findings(ctx.home, ctx.registry)
    findings += toolchain_rules.workflow_findings(ctx.home)
    findings += toolchain_rules.code_findings(ctx.home)
    notes = [f"toolchain: {len(tc.entries)} entries ({', '.join(tc.entries)}), each with linux-x86_64, an https address, a SHA-256 "
             "and a functional check"]
    return SectionResult.from_findings("toolchain", findings, notes, {"entries": sorted(tc.entries)})
