"""Proposals: tracked, replayable changes an agent drafts for a person to decide (0041-command-line FR-039; 0042-agora FR-029).

A proposal is the JSON file `<id>.json` in the directory the root manifest names. Its action is a command's words and its
fields by name, as a link or an action names them; replaying it validates the fields as the command would.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from agora.core import cli
from agora.core.ctx import Ctx
from agora.core.registry import Command
from agora.core.resource import AgoraError

ID = re.compile(r"\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*")
STATUSES = ("open", "accepted")
PROPOSABLE = ("record", "generate", "decision")  # 0041 FR-039
FIELDS = ("id", "status", "resource", "reason", "action")


def directory(ctx: Ctx) -> Path:
    return ctx.home / ctx.registry.root_manifest.get("proposals", ".agora/proposals")


def ids(ctx: Ctx) -> list[str]:
    d = directory(ctx)
    return sorted(p.stem for p in d.glob("*.json")) if d.is_dir() else []


def path_of(ctx: Ctx, pid: str) -> Path:
    return directory(ctx) / f"{pid}.json"


def load(ctx: Ctx, pid: str) -> dict[str, Any]:
    return json.loads(path_of(ctx, pid).read_text(encoding="utf-8"))


def dump(p: dict[str, Any]) -> str:
    return json.dumps({k: p[k] for k in FIELDS}, indent=2, ensure_ascii=False) + "\n"


def next_id(ctx: Ctx, command: str, resource: str) -> str:
    last = max((int(i[:4]) for i in ids(ctx)), default=0)
    slug = re.sub(r"[^a-z0-9]+", "-", f"{command} {resource.split(':', 1)[-1]}".lower()).strip("-")[:48].strip("-")
    return f"{last + 1:04d}-{slug}"


def fields_from_pairs(pairs: list[str]) -> dict[str, Any]:
    """`name=value` words: a name given twice is a list; a flag takes `true`."""
    out: dict[str, Any] = {}
    for w in pairs:
        name, eq, value = w.partition("=")
        if not eq or not name:
            raise AgoraError("invalid-argument", f"--field {w!r} is not NAME=VALUE", exit=2)
        name = name.strip().replace("-", "_")
        if name in out:
            out[name] = [*(out[name] if isinstance(out[name], list) else [out[name]]), value]
        else:
            out[name] = value
    return out


def proposable(cmd: Command | None) -> str | None:
    """Why a command cannot be proposed, or None."""
    if cmd is None:
        return "names no command"
    if cmd.noun == "proposal":
        return "is a proposal command: a proposal is never about proposals (0041 FR-039)"
    if cmd.category not in PROPOSABLE:
        return f"is a {cmd.category} command: only {', '.join(PROPOSABLE)} commands can be proposed (0041 FR-039)"
    return None


def action_values(ctx: Ctx, action: dict[str, Any]) -> tuple[Command, dict[str, Any]]:
    """The command an action names and its values, validated by the command's own types."""
    cmd = ctx.registry.find(action.get("command", ""))
    why = proposable(cmd)
    if why:
        raise AgoraError("proposal", f"{action.get('command')!r} {why}", exit=2)
    return cmd, cli.values_from_raw(ctx, cmd, action.get("fields", {}))


def problems(ctx: Ctx, pid: str) -> list[str]:
    """What is wrong with a proposal file, as findings."""
    p = path_of(ctx, pid)
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return [f"is not a JSON document: {e}"]
    if not isinstance(doc, dict):
        return ["is not a JSON object"]
    out = []
    if set(doc) != set(FIELDS):
        out.append(f"has fields {sorted(doc)}; a proposal has exactly {list(FIELDS)} (0042 FR-029)")
        return out
    if doc["id"] != pid or not ID.fullmatch(pid):
        out.append(f"its id {doc['id']!r} must be the file's name, NNNN-slug (0042 FR-029)")
    if doc["status"] not in STATUSES:
        out.append(f"its status {doc['status']!r} is not {' or '.join(STATUSES)} (0041 FR-039)")
    if not isinstance(doc["reason"], str) or not doc["reason"].strip():
        out.append("has no reason (0041 FR-039)")
    act = doc["action"]
    if not isinstance(act, dict) or set(act) != {"command", "fields"}:
        out.append("its action is not {command, fields} (0041 FR-039)")
        return out
    cmd = ctx.registry.find(str(act["command"]))
    why = proposable(cmd)
    if why:
        out.append(f"its action {act['command']!r} {why}")
    elif doc["status"] == "open":  # an accepted proposal is history; an open one must still replay
        try:
            cli.values_from_raw(ctx, cmd, act["fields"])
        except AgoraError as e:
            out.append(f"its action no longer validates: {e.message}")
        try:
            kind = str(doc["resource"]).split(":", 1)[0]
        except Exception:
            kind = ""
        if kind not in ctx.registry.contexts:
            out.append(f"its resource {doc['resource']!r} is not of a kind `context` serves (0042 FR-029)")
    return out
