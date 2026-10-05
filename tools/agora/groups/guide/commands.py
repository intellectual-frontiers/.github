"""Help topics and the guide: `help`, `docs generate`, `docs build` and the `help` check section (0042-agora FR-033 to FR-035).

Thin: the rules are agora.core.help, agora.lib.helps and agora.lib.guide. Standard library only.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from agora.core import (AgoraError, Arg, Call, Ctx, Dynamic, Finding, Link, Opt, Resource, SectionResult, command, files, next_command,
                        section)
from agora.core.generate import Generated
from agora.core.registry import generator
from agora.core.resource import FAILED, MISSING, OK
from agora.lib import guide, helps

TOPIC = Dynamic("TOPIC", "a help topic, as `help` lists them: start, check, specs, ...", lambda c: [k for k in c.registry.topics if "#" not in k])


def _text(res: Resource) -> str:
    d = res.data
    if "topics" in d:
        w = max(len(t["topic"]) for t in d["topics"])
        return "\n".join(["Ask for one with `help TOPIC`.", "", *(f"{t['topic'].ljust(w)}  {t['summary']}" for t in d["topics"])])
    out = [d["summary"], "", d["plain"], ""]
    for heading, text in d["sections"].items():
        out += [f"## {heading}", "", text, ""]
    out.append("Steps (also under next:):")
    out += [f"  {i}. {s['label']}" + (f" ({s['note']})" if s.get("note") else "") for i, s in enumerate(d["steps"], 1)]
    return "\n".join(out)


@command("help", category="read", relocatable=True,
         help="Explain the daily work: the topics, or one topic with its sections and steps, each step a command you can run",
         args=[Arg("topic", "TOPIC", "the topic; the topics are listed when none is named", required=False)])
def help_(ctx: Ctx, topic: str | None) -> Resource:
    reg = ctx.registry
    topics = {k: t for k, t in reg.topics.items() if "#" not in k}
    if topic is None:
        rows = [{"topic": n, "summary": t.summary} for n, t in sorted(topics.items())]
        return Resource("help-list", "all", {"count": len(rows), "topics": rows}, text=_text,
                        links=[Link("topic", Call("help", {"topic": r["topic"]})) for r in rows])
    t = topics[topic]
    body = t.body()
    steps = [{"label": s.label, "command": s.command, "line": Call(s.command, dict(s.fields)).cli(reg, ctx.name), "note": s.note} for s in body["steps"]]
    data = {"topic": topic, "summary": t.summary, "plain": body["plain"], "sections": {h: x for h, x in body["sections"]}, "steps": steps}
    res = Resource("help", topic, data, text=_text, links=[Link("topics", Call("help", {}))],
                   actions=[next_command(s.label, s.command, **dict(s.fields)) for s in body["steps"]])
    res.columns["steps"] = ["label", "line", "note"]
    return res


# the check section ---------------------------------------------------------------------------------------------------
@section("help")
def check_help(ctx: Ctx, scope: str | None) -> SectionResult:
    reg = ctx.registry
    found = helps.findings(reg, ctx.home, ctx)
    topics = [k for k in reg.topics if "#" not in k]
    return SectionResult.from_findings("help", found, [f"help: {len(topics)} topics ({', '.join(sorted(topics))}), each with sections and steps"],
                                       {"topics": sorted(topics)})


# the reference chapters ----------------------------------------------------------------------------------------------
@generator(guide.GENERATOR)
def gen_reference(ctx: Ctx, scope: str | None) -> Generated:
    gd = Generated()
    for path, text in guide.reference_files(ctx.registry, ctx.home, ctx.toolchain().entries).items():
        gd.files[path] = text
    return gd


@command("docs generate", category="generate", help="Write the guide's reference chapters from the registry, the help topics, the toolchain, the checks and the design systems")
def docs_generate(ctx: Ctx) -> Resource:
    gd = gen_reference(ctx, None)
    changes = files.apply(ctx, gd.files)
    return Resource("docs", "generate", {"chapters": len(gd.files), "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("prove them current", "fresh", generators=[guide.GENERATOR])])


# the build ------------------------------------------------------------------------------------------------------------
@command("docs build", category="build", toolchain=("jre", "asciidoctor"), toolchain_optional=("asciidoctor-pdf",),
         help="Build the guide into a folder: the multi-page site, the single page, the PDF and the EPUB, with the toolchain's converters",
         options=[Opt("--out", "TEXT", "the folder to write; build/docs in this clone when none is named", alias="-o")])
def docs_build(ctx: Ctx, out: str | None) -> Resource:
    target = Path(out).expanduser() if out else ctx.home / "build" / "docs"
    target = target if target.is_absolute() else (Path.cwd() / target)
    planned = [{"edition": e, "status": "planned"} for e in guide.EDITIONS]
    shown = str(target.relative_to(ctx.home)) if target.is_relative_to(ctx.home) else str(target)
    changes = [{"path": f"{shown}/{f}", "change": "modify" if (target / f).exists() else "create", "added": 0, "removed": 0, "diff": []}
               for f in ("index.html", "guide/index.html", "guide.html", "guide.pdf", "guide.epub")]
    if ctx.dry_run:
        return Resource("docs", "build", {"out": shown, "dry_run": True, "editions": planned, "changes": changes})
    rows = guide.build_all(ctx.home, target, ctx.toolchain(), ctx.name, ctx.offline)
    built = {r["edition"] for r in rows if r["status"] == "built"}
    absent = {"guide.pdf": "PDF", "guide.epub": "EPUB", "guide.html": "single-page HTML"}
    problems = [p for p in guide.site_links(target) if not any(f in p and absent[f] not in built for f in absent)]
    failed = [r for r in rows if r["status"] == "failed"]
    skipped = [r for r in rows if r["status"] == "skipped"]
    data: dict[str, Any] = {"out": shown, "dry_run": False, "editions": rows, "broken links": problems}
    res = Resource("docs", "build", data, exit=FAILED if failed or problems else MISSING if skipped else OK)
    res.columns["editions"] = ["edition", "status", "file", "seconds", "reason"]
    if problems:
        res.actions = [next_command("see the guide's chapters", "help", topic="guide")]
    return res
