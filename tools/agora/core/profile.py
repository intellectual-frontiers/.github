"""The execution profile: how the host is provisioned and whether a person is at the invocation (0041-command-line FR-078 to FR-082).

Two independent facts, determined once per invocation. Provisioning is `hosted` when `ws-host` is on the host and `bare` when it is not: it
says what the host can supply (0025-tooling-environment FR-005). Attendance is `attended` when a person is at the invocation and `unattended`
when not: it says only what an output carries for a reader. Neither changes a command's result or exit status for the same inputs, except
that a command naming a toolchain entry is not runnable on a bare host. Standard library only (0041 FR-005).
"""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from typing import Any, Mapping

HOSTED, BARE = "hosted", "bare"
ATTENDED, UNATTENDED = "attended", "unattended"
TRUE = ("1", "true")
# Variables that say an AI agent or a CI job is running the command (0041 FR-078). A pipe is not among them: the editor reads JSON through one.
UNATTENDED_BY = ("CI", "CLAUDE_CODE_REMOTE")
SURFACE_ATTENDANCE = {"mcp": UNATTENDED, "editor": ATTENDED}


@dataclass(frozen=True)
class Profile:
    provisioning: str
    attendance: str
    why: str  # which rule decided the attendance, for `doctor`

    @property
    def hosted(self) -> bool:
        return self.provisioning == HOSTED

    @property
    def unattended(self) -> bool:
        return self.attendance == UNATTENDED

    def to_dict(self) -> dict[str, str]:
        return {"provisioning": self.provisioning, "attendance": self.attendance, "attendance decided by": self.why}


def provisioning_of(name: str, env: Mapping[str, str]) -> str:
    """`NAME_PROVISIONING`, which the launcher sets to what it used; else hosted when `ws-host` can be started."""
    said = env.get(f"{name.upper()}_PROVISIONING", "")
    if said in (HOSTED, BARE):
        return said
    return HOSTED if env.get("WS_HOST") or shutil.which("ws-host", path=env.get("PATH")) else BARE


def attendance_of(name: str, env: Mapping[str, str], surface: str = "cli") -> tuple[str, str]:
    """(the attendance, the rule that decided it): the override, the surface, the variables of an agent or a CI job, else attended."""
    said = env.get(f"{name.upper()}_ATTENDANCE", "")
    if said in (ATTENDED, UNATTENDED):
        return said, f"{name.upper()}_ATTENDANCE"
    if surface in SURFACE_ATTENDANCE:
        return SURFACE_ATTENDANCE[surface], f"the {surface} surface"
    for var in UNATTENDED_BY:
        if env.get(var, "").lower() in TRUE:
            return UNATTENDED, var
    return ATTENDED, "no agent or CI variable is set"


def detect(name: str, env: Mapping[str, str] | None = None, surface: str = "cli") -> Profile:
    env = os.environ if env is None else env
    att, why = attendance_of(name, env, surface)
    return Profile(provisioning_of(name, env), att, why)


def runnable(profile: Profile, toolchain: tuple[str, ...] | list[str]) -> bool:
    """A command that names a toolchain entry is runnable on a hosted host; any other command is runnable anywhere."""
    return profile.hosted or not toolchain


def python_floor(home: Any) -> tuple[int, int]:
    """The oldest Python the repository allows, from the one place it is written: `requires-python` in `pyproject.toml` (0025 FR-014)."""
    import re
    import tomllib
    from pathlib import Path

    try:
        spec = tomllib.loads((Path(home) / "pyproject.toml").read_text(encoding="utf-8")).get("project", {}).get("requires-python", "")
        m = re.search(r">=\s*(\d+)\.(\d+)", spec)
        if m:
            return int(m.group(1)), int(m.group(2))
    except (OSError, ValueError):
        pass
    return 3, 14


def needs_of(registry: Any, command: Any) -> dict[str, Any]:
    """The dependency group's packages and the toolchain entries a command's plan names (0041 FR-079)."""
    group = registry.groups.get(command.group) if command.group else None
    return {"packages": sorted(group.packages) if group is not None else [], "toolchain": list(command.toolchain)}
