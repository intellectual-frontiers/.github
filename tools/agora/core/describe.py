"""A command described as data: for `command list|show`, help, a web UI's forms and an MCP tool's schema."""
from __future__ import annotations

from typing import Any

from .registry import WRITES, Command, Registry


def command_data(reg: Registry, c: Command) -> dict[str, Any]:
    """One command: noun, verb, category, arguments, surfaces, dependency group and programs (0041 FR-012)."""
    args = [{"name": a.name, "type": a.type, "help": a.help, "required": a.required, "words": a.words, "many": a.many} for a in c.args]
    opts = [{"flag": o.flag, "type": o.type or "flag", "help": o.help, "multiple": o.multiple, "required": o.required,
             **({"alias": o.alias} if o.alias else {})} for o in c.options]
    if c.category in WRITES:
        opts.append({"flag": "--dry-run", "type": "flag", "help": "validate, write nothing, show the change", "multiple": False,
                     "required": False})
    usage = " ".join([reg.name, *c.words] + [(a.type + "..." if a.many else a.type if a.required else f"[{a.type}]") if not a.many else f"[{a.type}...]" for a in c.args]
                     + [f"[{o.flag}{'|' + o.alias if o.alias else ''}{' ' + o.type if o.type else ''}]" if not o.required else f"{o.flag} {o.type}"
                        for o in c.options])
    return {
        "id": c.id, "noun": c.noun, "verb": c.verb, "category": c.category, "help": c.help, "group": c.group or None,
        "arguments": args, "options": opts, "usage": usage,
        "surfaces": ["terminal", *reg.surfaces_of(c)], "programs": list(c.programs), "isolated": c.isolated,
        "relocatable": c.relocatable,
    }


def tool_schema(reg: Registry, ctx: Any, c: Command) -> dict[str, Any]:
    """JSON Schema of a command's input, from its typed arguments (0041 FR-027)."""
    props: dict[str, Any] = {}
    for a in c.args:
        t = reg.types.get(a.type)
        props[a.name] = t.schema(ctx) if t else {"type": "string"}
        if a.help:
            props[a.name] = {**props[a.name], "description": f"{a.help} ({props[a.name].get('description', a.type)})"}
        if a.many:
            props[a.name] = {"type": "array", "items": props[a.name]}
    for o in c.options:
        t = reg.types.get(o.type) if o.type else None
        s = {"type": "boolean"} if o.type is None else t.schema(ctx) if t else {"type": "string"}
        s = {**s, "description": o.help} if o.help and "description" not in s else s
        props[o.dest] = {"type": "array", "items": s} if o.multiple else s
    if c.category in WRITES:
        props["dry_run"] = {"type": "boolean", "default": True}
    return {"type": "object", "properties": props,
            "required": [a.name for a in c.args if a.required] + [o.dest for o in c.options if o.required]}
