"""The print design system's article layouts, read from its own registry (0042-agora FR-006, FR-008, FR-017).

The numbers live in `design-systems/frontiers-print/latex/layouts.json` and are resolved and emitted by that design
system's own `latex/layout.py`, which stays there (0014-design-systems FR-005): this module reads the JSON for what a
person looks at, and loads the script from where it stands for what the class reads. Standard library only.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agora.lib import items

SLUG = "frontiers-print"


def registry(root: Path) -> dict[str, Any]:
    return json.loads((items.system(root, SLUG) / "latex" / "layouts.json").read_text(encoding="utf-8"))


def names(root: Path) -> list[str]:
    """Every name a layout answers to: its own and its aliases."""
    reg = registry(root)["layouts"]
    return [*reg, *(a for v in reg.values() for a in v.get("aliases", []))]


def canonical(root: Path, name: str) -> str | None:
    reg = registry(root)["layouts"]
    if name in reg:
        return name
    return next((k for k, v in reg.items() if name in v.get("aliases", [])), None)


def row(name: str, v: dict[str, Any], default: str) -> dict[str, Any]:
    return {"name": name, "status": v["status"], "default": name == default, "aliases": ", ".join(v.get("aliases", [])),
            "columns": v.get("cols"), "sidebar": bool(v.get("sidebar")), "summary": v["summary"]}


def typefaces(root: Path) -> list[str]:
    return list(json.loads((items.system(root, SLUG) / "latex" / "typefaces.json").read_text(encoding="utf-8"))["sets"])


def emit(root: Path, canon: str, typeface: str) -> str:
    """The iflayout.def the class reads, from the design system's own `emit`, which refuses a layout that is not built."""
    mod = items.load(root, SLUG, "latex/layout.py")
    try:
        items.call(mod.resolve, canon)
        return items.call(mod.emit, canon, typeface)
    except items.ScriptProblem as e:
        raise ValueError(str(e)) from None
