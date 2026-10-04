"""Resources, links, actions and errors (0041-command-line FR-016 to FR-021).

Every command returns a Resource. Text, JSON and HTML are three views of it
(render.py); nothing appears in one that the resource does not carry.
"""
from __future__ import annotations

import shlex
from dataclasses import dataclass, field
from typing import Any, Callable

# Exit statuses (0041 FR-021).
OK, FAILED, USAGE, MISSING = 0, 1, 2, 3


@dataclass
class Call:
    """A library call with typed fields: a command (its words) and the values of its arguments and options by name.

    The displayed command line is generated from it (0041 FR-017), never written by hand."""

    command: str
    fields: dict[str, Any] = field(default_factory=dict)

    def cli(self, registry: Any = None, program: str = "agora") -> str:
        words = self.command.split()
        cmd = registry.find(self.command) if registry is not None else None
        out = [program, *words]
        if cmd is None:
            for k, v in self.fields.items():
                out += _opt(f"--{k.replace('_', '-')}", v)
            return " ".join(shlex.quote(w) for w in out)
        rest: list[str] = []
        for a in cmd.args:
            v = self.fields.get(a.name)
            if v is not None:
                rest += [str(x) for x in v] if isinstance(v, (list, tuple)) else [str(v)]
        for o in cmd.options:
            if o.dest in self.fields and self.fields[o.dest] not in (None, False):
                rest += _opt(o.flag, self.fields[o.dest])
        return " ".join(shlex.quote(w) for w in out + rest)


def _opt(flag: str, v: Any) -> list[str]:
    if v is True:
        return [flag]
    if isinstance(v, (list, tuple)):
        return [x for item in v for x in (flag, str(item))]
    return [flag, str(v)]


@dataclass
class Link:
    """A related resource: the relation, and the call that fetches it (0041 FR-017)."""

    rel: str
    call: Call


@dataclass
class Action:
    """What can be done next: a call, its category and surfaces (taken from the registry), and whether it can run now."""

    label: str
    call: Call
    enabled: bool = True
    reason: str = ""


@dataclass
class Resource:
    kind: str
    id: str
    data: dict[str, Any] = field(default_factory=dict)
    links: list[Link] = field(default_factory=list)
    actions: list[Action] = field(default_factory=list)
    # Not serialized: the exit status, and hints that shape a view without adding to it.
    exit: int = OK
    text: Callable[["Resource"], str] | None = None  # a kind-specific text view built only from `data`
    columns: dict[str, list[str]] = field(default_factory=dict)  # table columns by dotted data path
    version: int = 1

    def __post_init__(self) -> None:
        if isinstance(self.data.get("changes"), list):  # a write's change: text shows what changed, JSON the diff too
            self.columns.setdefault("changes", ["path", "change", "added", "removed"])

    @classmethod
    def from_dict(cls, d: dict[str, Any], exit: int = OK) -> "Resource":
        """A resource read back from its JSON document, as a parent reads an isolated worker's (0041 FR-028)."""
        return cls(d["kind"], d["id"], d["data"],
                   [Link(l["rel"], Call(l["command"], l["fields"])) for l in d.get("links", [])],
                   [Action(a["label"], Call(a["command"], a["fields"]), a.get("enabled", True), a.get("reason", ""))
                    for a in d.get("actions", [])], exit=exit, version=int(str(d.get("schema", "@1")).rsplit("@", 1)[-1]))

    def to_dict(self, registry: Any = None, audience: str = "public", name: str = "agora") -> dict[str, Any]:
        """The one JSON document (0041 FR-019)."""
        return {
            "schema": f"{name}/{self.kind}@{self.version}",
            "audience": audience,
            "kind": self.kind,
            "id": self.id,
            "data": self.data,
            "links": [
                {"rel": l.rel, "command": l.call.command, "fields": l.call.fields, "cli": l.call.cli(registry, name)}
                for l in self.links
            ],
            "actions": [_action_dict(a, registry, name) for a in self.actions],
        }


def _action_dict(a: Action, registry: Any, name: str) -> dict[str, Any]:
    cmd = registry.find(a.call.command) if registry is not None else None
    d: dict[str, Any] = {
        "label": a.label,
        "command": a.call.command,
        "fields": a.call.fields,
        "category": cmd.category if cmd else None,
        "surfaces": list(registry.surfaces_of(cmd)) if cmd else [],
        "cli": a.call.cli(registry, name),
        "enabled": a.enabled,
    }
    if cmd is not None:  # a value only a person can give: no pasteable line, and the names that are missing (0041 FR-064)
        needs = [x.name for x in cmd.args if x.required and not x.many and a.call.fields.get(x.name) in (None, "", [])]
        needs += [o.dest for o in cmd.options if o.required and a.call.fields.get(o.dest) in (None, "", [], False)]
        if needs:
            d["cli"], d["needs"] = None, needs
    if a.reason:
        d["reason"] = a.reason
    return d


class AgoraError(Exception):
    """A failure that becomes an error resource (0041 FR-020). `code` is stable."""

    def __init__(self, code: str, message: str, *, exit: int = USAGE, actions: list[Action] | None = None,
                 detail: dict[str, Any] | None = None):
        super().__init__(message)
        self.code, self.message, self.exit = code, message, exit
        self.actions = actions or []
        self.detail = detail or {}

    def resource(self) -> Resource:
        data: dict[str, Any] = {"code": self.code, "message": self.message}
        data.update(self.detail)
        return Resource("error", self.code, data, actions=self.actions, exit=self.exit)


def next_command(label: str, command: str, /, **fields: Any) -> Action:
    """An action that says what to run next."""
    return Action(label, Call(command, fields))
