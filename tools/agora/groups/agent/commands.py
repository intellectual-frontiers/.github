"""Proposals and the agent skill (0041-command-line FR-037, FR-039; 0042-agora FR-028, FR-029).

Thin: the rules live in agora.lib. Standard library only.
"""
from __future__ import annotations

import dataclasses
from typing import Any

from agora.core import (AgoraError, Arg, Call, Choice, Ctx, Dynamic, Link, Opt, Resource, command, execute, files, next_command)
from agora.core import cli
from agora.core.generate import Generated
from agora.core.registry import context_for, generator
from agora.core.resource import FAILED
from agora.lib import proposals, skill

PROPOSAL = Dynamic("PROPOSAL", "a proposal as NNNN-slug, as `proposal list` shows them", lambda c: proposals.ids(c))
PROPOSAL_STATUS = Choice("PROPOSAL_STATUS", proposals.STATUSES, "whether a proposal is open or accepted")


def _row(ctx: Ctx, pid: str) -> dict[str, Any]:
    p = proposals.load(ctx, pid)
    return {"id": pid, "status": p["status"], "resource": p["resource"], "command": p["action"]["command"], "reason": p["reason"]}


def _call_line(ctx: Ctx, action: dict[str, Any]) -> str:
    return Call(action["command"], dict(action["fields"])).cli(ctx.registry, ctx.name)


# proposal ----------------------------------------------------------------------------------------------------------
@command("proposal list", category="read", help="List proposals: open or accepted, the resource each concerns and what it proposes",
         options=[Opt("--status", "PROPOSAL_STATUS", "only open or only accepted proposals")])
def proposal_list(ctx: Ctx, status: str | None) -> Resource:
    rows = [r for r in (_row(ctx, i) for i in proposals.ids(ctx)) if not status or r["status"] == status]
    res = Resource("proposal-list", status or "all", {"count": len(rows), "status": status, "proposals": rows},
                   links=[Link("proposal", Call("proposal show", {"proposal": r["id"]})) for r in rows])
    res.columns["proposals"] = ["id", "status", "resource", "command"]
    return res


@command("proposal show", category="read", help="Show one proposal: its reason and the action it proposes, as a command line",
         args=[Arg("proposal", "PROPOSAL", "the proposal")])
def proposal_show(ctx: Ctx, proposal: str) -> Resource:
    p = proposals.load(ctx, proposal)
    data = {**p, "command line": _call_line(ctx, p["action"]), "file": f"{ctx.registry.root_manifest.get('proposals', '.agora/proposals')}/{proposal}.json"}
    res = Resource("proposal", proposal, data, links=[Link("resource", Call("context", {"resource": p["resource"]}))])
    if ctx.registry.find(p["action"]["command"]):
        res.links.append(Link("command", Call("command show", {"command": p["action"]["command"]})))
    if p["status"] == "open":
        res.actions = [next_command("accept it and replay its action (a person decides)", "proposal advance", proposal=proposal)]
    return res


@command("proposal new", category="record", help="Draft a change for a person to decide: a tracked proposal that names a command and its fields",
         args=[Arg("resource", "RESOURCE", "the resource it concerns, as kind:id")],
         options=[Opt("--reason", "TEXT", "why the change is proposed", required=True),
                  Opt("--run", "COMMAND", "the record, generate or decision command to replay, as `command list` shows it", required=True),
                  Opt("--field", "TEXT", "a field of that command as NAME=VALUE, once for each; a name given twice is a list", multiple=True)])
def proposal_new(ctx: Ctx, resource: str, reason: str, run: str, field: list[str]) -> Resource:
    cmd = ctx.registry.find(run)
    why = proposals.proposable(cmd)
    if why:
        raise AgoraError("proposal", f"{run!r} {why}", exit=2, actions=[next_command("list the commands", "command list")])
    if not reason.strip():
        raise AgoraError("usage", "--reason says why the change is proposed; it must not be empty", exit=2)
    fields = proposals.fields_from_pairs(field)
    known = {a.name for a in cmd.args} | {o.dest for o in cmd.options}
    extra = sorted(set(fields) - known)
    if extra:
        raise AgoraError("usage", f"{cmd.id} takes no field {', '.join(extra)}; it takes {', '.join(sorted(known)) or 'none'}", exit=2,
                         actions=[next_command("see how it is used", "command show", command=cmd.id)])
    cli.values_from_raw(ctx, cmd, fields)  # the command's own types validate the fields now, as they will at replay
    pid = proposals.next_id(ctx, cmd.id, resource)
    doc = {"id": pid, "status": "open", "resource": resource, "reason": reason.strip(),
           "action": {"command": cmd.id, "fields": fields}}
    path = proposals.path_of(ctx, pid)
    changes = files.apply(ctx, {path: proposals.dump(doc)})
    return Resource("proposal", pid, {**doc, "command line": _call_line(ctx, doc["action"]), "dry_run": ctx.dry_run, "changes": changes,
                                      "next": "commit the file; a person decides it with `proposal advance`"},
                    actions=[next_command("a person accepts it", "proposal advance", proposal=pid),
                             next_command("see it", "proposal show", proposal=pid)])


@command("proposal advance", category="decision", help="Accept a proposal: show its dry run, replay its action and mark it accepted",
         args=[Arg("proposal", "PROPOSAL", "the open proposal")])
def proposal_advance(ctx: Ctx, proposal: str) -> Resource:
    p = proposals.load(ctx, proposal)
    if p["status"] != "open":
        raise AgoraError("accepted", f"{proposal} is already {p['status']}", exit=FAILED,
                         actions=[next_command("see the open proposals", "proposal list", status="open")])
    cmd, values = proposals.action_values(ctx, p["action"])
    dump = lambda rs: [r.to_dict(ctx.registry, ctx.audience, ctx.name) for r in rs]
    sub = dataclasses.replace(ctx, dry_run=True, no_log=True, on_section=None)
    preview = list(execute.execute(sub, cmd, values))  # the dry run is shown first (0041 FR-015)
    if any(r.kind == "error" or r.exit for r in preview):
        bad = next(r for r in preview if r.kind == "error" or r.exit)
        raise AgoraError("replay", f"the dry run of {_call_line(ctx, p['action'])} fails, so {proposal} stays open: "
                         + str(bad.data.get("message", f"exit {bad.exit}")), exit=FAILED,
                         detail={"preview": dump(preview)}, actions=[next_command("see the proposal", "proposal show", proposal=proposal)])
    data: dict[str, Any] = {"proposal": proposal, "command line": _call_line(ctx, p["action"]), "dry_run": ctx.dry_run, "preview": dump(preview)}
    if ctx.dry_run:
        data["status"] = "open"
        data["next"] = f"run `proposal advance {proposal}` without --dry-run to replay it and mark it accepted"
        return Resource("proposal", proposal, data)
    real = dataclasses.replace(ctx, dry_run=False, no_log=True, on_section=None)
    done = list(execute.execute(real, cmd, values))
    data["result"] = dump(done)
    if any(r.kind == "error" or r.exit for r in done):
        bad = next(r for r in done if r.kind == "error" or r.exit)
        raise AgoraError("replay", f"{_call_line(ctx, p['action'])} failed, so {proposal} stays open: "
                         + str(bad.data.get("message", f"exit {bad.exit}")), exit=FAILED, detail={"result": data["result"]})
    changes = files.apply(ctx, {proposals.path_of(ctx, proposal): proposals.dump({**p, "status": "accepted"})})
    data.update(status="accepted", changes=changes, next="commit what the action wrote and the proposal's file")
    return Resource("proposal", proposal, data, actions=[next_command("see it", "proposal show", proposal=proposal)])


@context_for("proposal", "PROPOSAL")
def context_proposal(ctx: Ctx, ident: str) -> dict[str, Any]:
    d = proposal_show(ctx, ident)
    return {"resource": d.data, "specs": [], "requirements": [],
            "files": [d.data["file"]], "links": d.links, "actions": d.actions}


# skill -------------------------------------------------------------------------------------------------------------
@generator("agent-skill")
def gen_skill(ctx: Ctx, scope: str | None) -> Generated:
    gd = Generated()
    path = ctx.root / skill.PATH
    gd.files[path] = skill.text(ctx.registry)
    return gd


@command("skill generate", category="generate", help="Write the agent skill from the registry: .claude/skills/agora/SKILL.md")
def skill_generate(ctx: Ctx) -> Resource:
    gd = gen_skill(ctx, None)
    changes = files.apply(ctx, gd.files)
    return Resource("skill", ctx.name, {"path": str(skill.PATH), "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("prove it current", "fresh", generators=[skill.GENERATOR])])
