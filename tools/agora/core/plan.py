"""The dependency plan (0041-command-line FR-002 to FR-005).

A command declares its dependency group by living in one. The plan is computed from the registry alone, importing no
third-party package. A group with no pinned packages runs on the plain standard-library interpreter. A group that pins
packages runs from its committed, hashed lock (`agora.lock`, a requirements file with a hash for every distribution),
synced with hash checking into an environment uv creates inside its own cache, never into an interpreter or
site-packages the host owns; nothing is resolved, upgraded or installed outside the lock.
"""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .registry import Group, Registry
from .resource import AgoraError, MISSING, next_command

STAMP = "# agora-pins: "


@dataclass
class Plan:
    group: str
    packages: dict[str, str]
    lock: Path | None

    @property
    def stdlib(self) -> bool:
        return not self.packages

    def describe(self) -> str:
        return "the standard-library interpreter" if self.stdlib else f"group {self.group}'s lock ({len(self.packages)} package(s))"


def pins_stamp(packages: dict[str, str]) -> str:
    canon = "\n".join(f"{k.lower()}=={v}" for k, v in sorted(packages.items()))
    return "sha256:" + hashlib.sha256(canon.encode()).hexdigest()


def plan_for(reg: Registry, group: str) -> Plan:
    g = reg.groups[group]
    return Plan(g.name, dict(g.packages), g.lock if g.packages else None)


def lock_problems(g: Group) -> list[str]:
    """Where a group's lock and its manifest's pins disagree (0041 FR-029, FR-030)."""
    if not g.packages:
        return [f"group {g.name} pins no packages but has a lock: remove {g.lock}"] if g.lock.is_file() else []
    if not g.lock.is_file():
        return [f"group {g.name} pins {', '.join(sorted(g.packages))} but has no lock; run `lock {g.name}` online"]
    text = g.lock.read_text(encoding="utf-8")
    problems = []
    first = text.splitlines()[0] if text else ""
    if not first.startswith(STAMP) or first[len(STAMP):].strip() != pins_stamp(g.packages):
        problems.append(f"group {g.name}'s lock does not match its manifest's pins; run `lock {g.name}` online")
    entries = re.findall(r"^([A-Za-z0-9_.-]+)==([^\s\\]+)", text, re.M)
    locked = {n.lower(): v for n, v in entries}
    for name, ver in g.packages.items():
        if locked.get(name.lower()) != ver:
            problems.append(f"group {g.name} pins {name}=={ver}; its lock has {locked.get(name.lower(), 'nothing')}")
    blocks = re.split(r"\n(?=[A-Za-z0-9_.-]+==)", text)
    for b in blocks:
        m = re.match(r"([A-Za-z0-9_.-]+)==", b)
        if m and "--hash=sha256:" not in b:
            problems.append(f"group {g.name}'s lock has no hash for {m.group(1)} (0025-tooling-environment FR-013)")
    return problems


def uv_cache_dir() -> Path | None:
    uv = shutil.which("uv")
    if not uv:
        return None
    p = subprocess.run([uv, "cache", "dir"], capture_output=True, text=True)
    return Path(p.stdout.strip()) if p.returncode == 0 and p.stdout.strip() else None


def env_dir(g: Group, cache: Path) -> Path:
    stamp = hashlib.sha256(g.lock.read_bytes()).hexdigest()[:16]
    return cache / "agora" / f"{g.name}-{stamp}"


def prepare(reg: Registry, group: str, *, offline: bool, command: str) -> Path:
    """Return the Python of an environment holding exactly the group's lock, creating it with uv if needed.

    Raises an error resource (exit 3) naming the package, the group and the command that prepares it, when offline
    and the cache lacks something (0041 FR-004)."""
    g = reg.groups[group]
    problems = lock_problems(g)
    if problems:
        raise AgoraError("lock", problems[0], exit=MISSING, actions=[next_command("check the plan", "doctor")])
    uv = shutil.which("uv")
    cache = uv_cache_dir()
    if not uv or cache is None:
        raise AgoraError("missing-program", "uv is needed to run a command that needs packages", exit=MISSING,
                         detail={"program": "uv", "hint": "install uv from the host"})
    env = env_dir(g, cache)
    py = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if py.is_file() and (env / ".agora-ready").is_file():
        return py
    names = ", ".join(f"{k}=={v}" for k, v in sorted(g.packages.items()))
    off = ["--offline"] if offline else []
    steps = [[uv, "venv", "--quiet", "--python", sys.executable, *off, str(env)],
             [uv, "pip", "sync", "--quiet", "--require-hashes", *off, "--python", str(env / "bin" / "python"), str(g.lock)]]
    from . import progress
    for argv in steps:
        with progress.step(f"📦 Preparing the packages group {group} needs", watch=cache):
            p = subprocess.run(argv, capture_output=True, text=True)
        if p.returncode != 0:
            shutil.rmtree(env, ignore_errors=True)
            if offline:
                raise AgoraError("offline", f"offline: group {group} needs {names}, which uv's cache lacks; "
                                 f"run `{reg.name} {command}` once online to fill the cache",
                                 exit=MISSING, detail={"group": group, "packages": sorted(g.packages), "command": command})
            raise AgoraError("plan", f"uv could not prepare group {group}'s environment: {p.stderr.strip()[-400:]}", exit=MISSING)
    (env / ".agora-ready").write_text(pins_stamp(g.packages) + "\n", encoding="utf-8")
    return py


def reexec_argv(py: Path, argv: list[str]) -> list[str]:
    """The command line that runs `python -m agora` under the group's environment."""
    return [str(py), "-m", "agora", *argv]
