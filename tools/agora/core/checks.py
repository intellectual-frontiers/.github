"""Check sections, suites and `--changed` (0041-command-line FR-028, FR-031 to FR-033)."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .resource import AgoraError, MISSING, USAGE


@dataclass
class Finding:
    level: str  # "error" or "warning"
    where: str
    message: str

    def __str__(self) -> str:
        return f"{'❎' if self.level == 'error' else '🟡'} {self.where}: {self.message}"


@dataclass
class SectionResult:
    name: str
    status: str = "passed"  # passed, failed, skipped
    findings: list[Finding] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)  # what a person reads beside the findings
    data: dict[str, Any] = field(default_factory=dict)
    reason: str = ""  # why a section was skipped

    @classmethod
    def from_findings(cls, name: str, findings: list[Finding], notes: list[str] | None = None,
                      data: dict[str, Any] | None = None) -> "SectionResult":
        failed = any(f.level == "error" for f in findings)
        return cls(name, "failed" if failed else "passed", findings, notes or [], data or {})

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "name": self.name, "status": self.status,
            "findings": [{"level": f.level, "where": f.where, "message": f.message,
                          "next": f"edit {f.where.split(':')[0].split(' ')[0]}, then run `check {self.name}`"}
                         for f in self.findings],
            "notes": self.notes, "data": self.data,
        }
        if self.reason:
            d["reason"] = self.reason
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "SectionResult":
        return cls(d["name"], d["status"], [Finding(f["level"], f["where"], f["message"]) for f in d["findings"]],
                   d.get("notes", []), d.get("data", {}), d.get("reason", ""))


# --changed -----------------------------------------------------------------------------------------------------
def glob_regex(pattern: str) -> re.Pattern[str]:
    """A path glob: `**` crosses directories, `*` and `?` do not."""
    out, i = "", 0
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
            continue
        if pattern.startswith("**", i):
            out += ".*"
            i += 2
            continue
        out += "[^/]*" if c == "*" else "[^/]" if c == "?" else re.escape(c)
        i += 1
    return re.compile(out + "$")


def changed_paths(ctx: Any, since: str | None = None) -> list[str]:
    """Files Git reports as changed in the working tree, staged, or untracked, or that differ from `since`.

    Read with the pinned dulwich package, never a `git` program (0042-agora FR-030): the vcs group's locked environment
    runs agora.lib.gitstate and prints the paths."""
    from . import plan
    py = plan.prepare(ctx.registry, "vcs", offline=ctx.offline, command="check --changed")
    p = subprocess.run([str(py), "-m", "agora.lib.gitstate", str(ctx.root), since or ""], capture_output=True, text=True,
                       env={**ctx.env, "PYTHONPATH": str(ctx.home / "tools"), "PYTHONDONTWRITEBYTECODE": "1"})
    if p.returncode != 0:
        raise AgoraError("git", f"could not read Git's state: {p.stderr.strip()[-300:]}", exit=USAGE)
    return json.loads(p.stdout)


def section_changed(watch: tuple[str, ...], changed: list[str]) -> tuple[bool, str]:
    """Whether a section runs under --changed, and why (0041 FR-032)."""
    if not watch:
        return True, "declares no watched paths"
    rx = [glob_regex(w) for w in watch]
    for p in changed:
        if any(r.match(p) for r in rx):
            return True, f"{p} changed"
    return False, "no watched path changed"


def find_program(registry: Any, name: str, env: dict[str, str] | None = None) -> str | None:
    """Where a program the host supplies is, or None (0041 FR-006). A program is on PATH; one a manifest declares with
    `probe_env`, `probe_default` and `probe_globs` (a browser Playwright installs outside PATH) is also looked for in
    those directories, the environment's variable first, so a host's own override wins (0025 FR-002)."""
    found = shutil.which(name)
    if found:
        return found
    spec = registry.program(name) if registry is not None else {}
    globs = spec.get("probe_globs")
    if not globs:
        return None
    env = os.environ if env is None else env
    bases = [env.get(spec["probe_env"], "")] if spec.get("probe_env") else []
    bases += [os.path.expanduser(b) for b in spec.get("probe_default", [])]
    for base in bases:
        for pattern in globs:
            for hit in sorted(Path(base).glob(pattern)) if base else []:
                if hit.is_file():
                    return str(hit)
    return None


def program_missing(ctx: Any, programs: tuple[str, ...]) -> list[str]:
    return [p for p in programs if find_program(ctx.registry, p, ctx.env) is None]
