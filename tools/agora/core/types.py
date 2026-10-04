"""Typed arguments (0041-command-line FR-013).

A type defines how to validate a value, how to resolve it to a resource, and how to complete it. The parser,
completion, a web UI's forms and an MCP tool's input schema all take their validation and choices from here.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

from .resource import Call


class ArgType:
    """Base type. A subclass or instance names itself in capitals and says what it means (`doc`)."""

    name = "TEXT"
    doc = "free text"

    def validate(self, ctx: Any, value: str) -> Any:
        """Return the canonical value, or raise ValueError with the reason."""
        return value

    def complete(self, ctx: Any, prefix: str) -> list[str]:
        return [v for v in self.choices(ctx) if v.startswith(prefix)]

    def choices(self, ctx: Any) -> list[str]:
        """Every valid value, where the set is finite and cheap to list."""
        return []

    def examples(self, ctx: Any) -> list[str]:
        return self.choices(ctx)[:3]

    def resolve(self, ctx: Any, value: Any) -> Call | None:
        """The call that fetches the resource this value names, or None."""
        return None

    def schema(self, ctx: Any = None) -> dict[str, Any]:
        """JSON Schema for an MCP tool input (0041 FR-027)."""
        s: dict[str, Any] = {"type": "string", "description": f"{self.name}: {self.doc}"}
        try:
            c = self.choices(ctx) if ctx is not None else []
        except Exception:
            c = []
        if c and len(c) <= 50:
            s["enum"] = c
        return s

    def meaning(self) -> str:
        return f"{type(self).__module__}.{type(self).__name__}:{self.name}:{self.doc}"


class Choice(ArgType):
    def __init__(self, name: str, choices: Iterable[str], doc: str = ""):
        self.name, self._choices, self.doc = name, list(choices), doc or f"one of {', '.join(choices)}"

    def choices(self, ctx: Any) -> list[str]:
        return list(self._choices)

    def validate(self, ctx: Any, value: str) -> str:
        if value not in self._choices:
            raise ValueError(f"{value!r} is not one of {', '.join(self._choices)}")
        return value

    def meaning(self) -> str:
        return f"Choice:{self.name}:{','.join(self._choices)}"


class Pattern(ArgType):
    def __init__(self, name: str, regex: str, doc: str, examples: Iterable[str] = ()):
        self.name, self.doc, self._re, self._examples = name, doc, re.compile(regex), list(examples)

    def validate(self, ctx: Any, value: str) -> str:
        if not self._re.fullmatch(value):
            raise ValueError(f"{value!r} does not match {self._re.pattern}")
        return value

    def examples(self, ctx: Any) -> list[str]:
        return self._examples

    def meaning(self) -> str:
        return f"Pattern:{self.name}:{self._re.pattern}"


class Dynamic(ArgType):
    """A type whose values come from the repository: `lister(ctx)` returns every valid value."""

    def __init__(self, name: str, doc: str, lister: Any):
        self.name, self.doc, self._lister = name, doc, lister

    def choices(self, ctx: Any) -> list[str]:
        return list(self._lister(ctx))

    def validate(self, ctx: Any, value: str) -> str:
        if value not in self.choices(ctx):
            raise ValueError(f"{value!r} is not a known {self.name.lower()}")
        return value

    def meaning(self) -> str:
        return f"Dynamic:{self.name}:{self.doc}"


TEXT = ArgType()
INT_TYPE = type("INT", (ArgType,), {"name": "INT", "doc": "a whole number",
                                    "validate": lambda self, ctx, v: int(v)})()
COMMIT = Pattern("COMMIT", r"[0-9a-f]{40}", "a full Git commit, 40 hex digits", ["8efca19779828488b21619777e5f7805ca22c2bb"])
