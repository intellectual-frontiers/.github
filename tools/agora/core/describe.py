"""A command described as data: for `command list|show`, help, an editor's forms and an MCP tool's schema."""
from __future__ import annotations

from typing import Any

from .registry import WRITES, Command, Registry


MAX_CHOICES = 30  # a type with more values than this is listed by its noun's `list` command, not inline (0043 OQ-1)


def choices_of(reg: Registry, ctx: Any, type_name: str | None) -> list[str] | None:
    """Every value a type can list, where it can and the set is small enough to offer; else None (0041 FR-064)."""
    t = reg.types.get(type_name) if type_name else None
    if t is None or ctx is None:
        return None
    try:
        values = t.choices(ctx)
    except Exception:
        return None
    return values if values and len(values) <= MAX_CHOICES else None


def command_data(reg: Registry, c: Command, ctx: Any = None) -> dict[str, Any]:
    """One command: noun, verb, category, arguments (with the choices of a type that can list them), options, surfaces,
    dependency group and programs (0041 FR-012, FR-064)."""
    def with_choices(d: dict[str, Any], type_name: str | None) -> dict[str, Any]:
        found = choices_of(reg, ctx, type_name)
        return {**d, "choices": found} if found else d

    args = [with_choices({"name": a.name, "type": a.type, "help": a.help, "required": a.required and not a.many, "words": a.words, "many": a.many},
                         a.type) for a in c.args]
    opts = [with_choices({"flag": o.flag, "type": o.type or "flag", "help": o.help, "multiple": o.multiple, "required": o.required,
                          **({"alias": o.alias} if o.alias else {})}, o.type) for o in c.options]
    if c.category in WRITES:
        opts.append({"flag": "--dry-run", "type": "flag", "help": "validate, write nothing, show the change", "multiple": False,
                     "required": False})
    usage = " ".join([reg.name, *c.words] + [(a.type + "..." if a.many else a.type if a.required else f"[{a.type}]") if not a.many else f"[{a.type}...]" for a in c.args]
                     + [f"[{o.flag}{'|' + o.alias if o.alias else ''}{' ' + o.type if o.type else ''}]" if not o.required else f"{o.flag} {o.type}"
                        for o in c.options])
    from .presentation import of_command

    return {
        **of_command(reg, c.id),
        "id": c.id, "noun": c.noun, "verb": c.verb, "category": c.category, "help": c.help, "group": c.group or None,
        "arguments": args, "options": opts, "usage": usage,
        "surfaces": ["terminal", *reg.surfaces_of(c)], "programs": list(c.toolchain), "toolchain": list(c.toolchain), "isolated": c.isolated,
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
