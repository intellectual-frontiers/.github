"""Help topics: the one place the daily work is documented (0041-command-line FR-065; 0042-agora FR-033).

A topic is a Python module of `agora/help/`, found by presence like a command, that declares one function with `@topic(name,
summary)`. The function returns the topic's words and its steps; a step is an action (0041 FR-017), so the terminal shows it as a
pasteable line and the editor as a button. Standard library only (0041 FR-005).
"""
from __future__ import annotations

import importlib
import pkgutil
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass(frozen=True)
class Step:
    """One thing a person does, as a command of the registry with its fields. `note` says what to expect, in words."""

    label: str
    command: str
    fields: dict[str, Any] = field(default_factory=dict)
    note: str = ""


@dataclass
class Topic:
    name: str
    summary: str
    fn: Callable[[], dict[str, Any]]
    module: str = ""

    def body(self) -> dict[str, Any]:
        """{"plain": str, "sections": ((heading, text), ...), "steps": (Step, ...)}; text lines indented four spaces are commands."""
        got = self.fn()
        return {"plain": got.get("plain", ""), "sections": tuple(got.get("sections", ())), "steps": tuple(got.get("steps", ()))}


def topic(name: str, summary: str):
    """Declare a help topic: `fn() -> {"plain", "sections", "steps"}`."""

    def deco(fn: Callable[[], dict[str, Any]]) -> Callable[[], dict[str, Any]]:
        fn.__agora_topic__ = (name, summary)
        return fn

    return deco


def discover(package: str = "agora.help") -> dict[str, Topic]:
    """The topics, found by presence: every function of every module of the package that carries `@topic`. Two with one name
    are a conflict, kept in `Topic` order of discovery and reported by `check help`."""
    pkg = importlib.import_module(package)
    out: dict[str, Topic] = {}
    for info in sorted(pkgutil.iter_modules(pkg.__path__), key=lambda i: i.name):
        mod = importlib.import_module(f"{package}.{info.name}")
        for attr in sorted(vars(mod)):
            fn = getattr(mod, attr)
            if callable(fn) and hasattr(fn, "__agora_topic__") and getattr(fn, "__module__", None) == mod.__name__:
                name, summary = fn.__agora_topic__
                if name in out:
                    out[f"{name}#duplicate-{info.name}"] = Topic(name, summary, fn, mod.__name__)
                else:
                    out[name] = Topic(name, summary, fn, mod.__name__)
    return out
