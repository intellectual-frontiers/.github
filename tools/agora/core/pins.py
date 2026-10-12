"""The packages each command group pins: the dependency groups of `pyproject.toml` (0025-tooling-environment FR-013; 0041-command-line FR-002, FR-003).

A group's name is the name of a command group (`tools/agora/groups/<name>/`); a group that has no entry pins nothing. An entry is an exact pin,
`Name==1.2.3`, or `{ include-group = "other" }`, which adds another group's pins. `uv.lock` holds the resolution with a hash for every file; this
module reads only the pins. Standard library only.
"""
from __future__ import annotations

import re
import tomllib
from pathlib import Path
from typing import Any

PIN = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*==\s*([^\s;,=]+)\s*$")


def _groups(home: Path) -> dict[str, Any]:
    try:
        return tomllib.loads((Path(home) / "pyproject.toml").read_text(encoding="utf-8")).get("dependency-groups", {})
    except (OSError, ValueError):
        return {}


def _expand(groups: dict[str, Any], name: str, trail: tuple[str, ...] = ()) -> tuple[dict[str, str], list[str]]:
    """(the pins of a group with the groups it includes, what in it is not an exact pin)"""
    pins: dict[str, str] = {}
    bad: list[str] = []
    for item in groups.get(name, []):
        if isinstance(item, str):
            m = PIN.match(item)
            if m:
                pins[m.group(1)] = m.group(2)
            else:
                bad.append(f"group {name}: {item!r} is not pinned to one exact version, as name==version")
        elif isinstance(item, dict) and set(item) == {"include-group"}:
            other = item["include-group"]
            if other in trail or other == name:
                bad.append(f"group {name} includes {other}, which includes it")
            elif other not in groups:
                bad.append(f"group {name} includes {other}, which pyproject.toml does not declare")
            else:
                got, more = _expand(groups, other, (*trail, name))
                pins.update(got)
                bad += more
        else:
            bad.append(f"group {name}: {item!r} is neither an exact pin nor an include-group")
    return pins, bad


def dependency_pins(home: Path) -> dict[str, dict[str, str]]:
    """Each dependency group's exact pins, by group name; empty where there is no pyproject.toml."""
    groups = _groups(home)
    return {name: _expand(groups, name)[0] for name in groups}


def pin_problems(home: Path, known: set[str]) -> list[str]:
    """What is wrong with the declarations: an entry that is not an exact pin, and a dependency group no command group has (0041 FR-003)."""
    groups = _groups(home)
    out: list[str] = []
    for name in sorted(groups):
        out += _expand(groups, name)[1]
        if name not in known:
            out.append(f"pyproject.toml declares a dependency group {name}, and no command group has that name (0041 FR-002)")
    return sorted(set(out))
