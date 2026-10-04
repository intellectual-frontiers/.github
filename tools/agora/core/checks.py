"""Check sections, suites and `--changed` (0041-command-line FR-028, FR-031 to FR-033)."""
from __future__ import annotations

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


def changed_paths(root: Path, since: str | None = None) -> list[str]:
    """Files Git reports as changed in the working tree, staged, or untracked, or that differ from `since`."""
    if shutil.which("git") is None:
        raise AgoraError("missing-program", "git is needed for --changed and is not on PATH",
                         exit=MISSING, detail={"program": "git", "hint": "install git from the host"})
    def git(*args: str) -> str:
        p = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)
        if p.returncode != 0:
            raise AgoraError("git", f"git {' '.join(args)} failed: {p.stderr.strip()}", exit=USAGE)
        return p.stdout
    paths: set[str] = set()
    for line in git("status", "--porcelain", "-z", "--untracked-files=all").split("\0"):
        if len(line) > 3:
            paths.add(line[3:])
    if since:
        paths.update(p for p in git("diff", "--name-only", since).splitlines() if p)
    return sorted(paths)


def section_changed(watch: tuple[str, ...], changed: list[str]) -> tuple[bool, str]:
    """Whether a section runs under --changed, and why (0041 FR-032)."""
    if not watch:
        return True, "declares no watched paths"
    rx = [glob_regex(w) for w in watch]
    for p in changed:
        if any(r.match(p) for r in rx):
            return True, f"{p} changed"
    return False, "no watched path changed"


def program_missing(ctx: Any, programs: tuple[str, ...]) -> list[str]:
    return [p for p in programs if shutil.which(p) is None]
