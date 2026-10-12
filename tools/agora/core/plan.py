"""The dependency plan (0041-command-line FR-002 to FR-005).

A command declares its dependency group by living in one. The plan is computed from the registry alone, importing no
third-party package. A group with no pinned packages runs on the plain standard-library interpreter. A group that pins
packages (a dependency group of `pyproject.toml`) runs from the repository's committed `uv.lock`, which holds a hash for every
file of every package, synced with `uv sync --frozen --only-group` into an environment uv creates inside its own cache, never
into an interpreter or site-packages the host owns; nothing is resolved, upgraded or installed outside the lock.
"""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .registry import Group, Registry
from .resource import AgoraError, MISSING, next_command

READY = ".agora-ready"


@dataclass
class Plan:
    group: str
    packages: dict[str, str]
    lock: Path | None

    @property
    def stdlib(self) -> bool:
        return not self.packages

    def describe(self) -> str:
        return "the standard-library interpreter" if self.stdlib else f"group {self.group}'s locked packages ({len(self.packages)} package(s))"


def norm(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def pins_stamp(packages: dict[str, str]) -> str:
    canon = "\n".join(f"{norm(k)}=={v}" for k, v in sorted(packages.items()))
    return "sha256:" + hashlib.sha256(canon.encode()).hexdigest()


def plan_for(reg: Registry, group: str) -> Plan:
    g = reg.groups[group]
    return Plan(g.name, dict(g.packages), g.lock if g.packages else None)


def read_lock(path: Path) -> dict[str, Any] | None:
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def lock_problems(g: Group) -> list[str]:
    """Where `uv.lock` and a group's pins disagree (0041 FR-029, FR-030): a missing lock, a package locked at another version, a file with no
    hash, and a lock that was written from other dependency groups than `pyproject.toml` now has."""
    if not g.packages:
        return []
    if not g.lock.is_file():
        return [f"group {g.name} pins {', '.join(sorted(g.packages))} but there is no uv.lock; run `lock` online"]
    data = read_lock(g.lock)
    if data is None:
        return [f"uv.lock cannot be read as TOML; run `lock` online"]
    problems: list[str] = []
    locked = {norm(p["name"]): p for p in data.get("package", [])}
    for name, ver in sorted(g.packages.items()):
        p = locked.get(norm(name))
        if p is None or p.get("version") != ver:
            problems.append(f"group {g.name} pins {name}=={ver}; uv.lock has {p.get('version') if p else 'nothing'}; run `lock` online")
            continue
        files = ([p["sdist"]] if "sdist" in p else []) + list(p.get("wheels", []))
        if not files or any(not str(f.get("hash", "")).startswith("sha256:") for f in files):
            problems.append(f"uv.lock has no hash for every file of {name} (0025-tooling-environment FR-013)")
    root = next((p for p in data.get("package", []) if "virtual" in (p.get("source") or {})), None)
    wanted = ((root or {}).get("metadata") or {}).get("requires-dev")
    if wanted is not None:   # what the lock was written from
        have = {norm(r["name"]): r.get("specifier") for r in wanted.get(g.name, [])}
        want = {norm(k): f"=={v}" for k, v in g.packages.items()}
        if have != want:
            problems.append(f"uv.lock was written from other pins than pyproject.toml's group {g.name}; run `lock` online")
    return problems


def uv_cache_dir() -> Path | None:
    uv = shutil.which("uv")
    if not uv:
        return None
    p = subprocess.run([uv, "cache", "dir"], capture_output=True, text=True)
    return Path(p.stdout.strip()) if p.returncode == 0 and p.stdout.strip() else None


def env_dir(g: Group, cache: Path) -> Path:
    """One environment per group and per lock: a lock that changes makes a new one, and the old is left to uv's cache to forget."""
    stamp = hashlib.sha256(g.lock.read_bytes() + pins_stamp(g.packages).encode()).hexdigest()[:16]
    return cache / "agora" / f"{g.name}-{stamp}"


def prepare(reg: Registry, group: str, *, offline: bool, command: str) -> Path:
    """Return the Python of an environment holding exactly the group's locked packages, creating it with uv if needed.

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
                         detail={"program": "uv", "hint": "install uv (https://docs.astral.sh/uv/getting-started/installation/)"})
    env = env_dir(g, cache)
    py = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if py.is_file() and (env / READY).is_file():
        return py
    names = ", ".join(f"{k}=={v}" for k, v in sorted(g.packages.items()))
    argv = [uv, "sync", "--quiet", "--frozen", "--only-group", group, "--project", str(g.lock.parent), "--python", sys.executable,
            *(["--offline"] if offline else [])]
    from . import progress
    with progress.step(f"📦 Preparing the packages group {group} needs", watch=cache):
        p = subprocess.run(argv, capture_output=True, text=True, env={**os.environ, "UV_PROJECT_ENVIRONMENT": str(env)})
    if p.returncode != 0:
        shutil.rmtree(env, ignore_errors=True)
        if offline:
            raise AgoraError("offline", f"offline: group {group} needs {names}, which uv's cache lacks; "
                             f"run `{reg.name} {command}` once online to fill the cache",
                             exit=MISSING, detail={"group": group, "packages": sorted(g.packages), "command": command})
        raise AgoraError("plan", f"uv could not prepare group {group}'s environment: {p.stderr.strip()[-400:]}", exit=MISSING)
    (env / READY).write_text(pins_stamp(g.packages) + "\n", encoding="utf-8")
    return py


def reexec_argv(py: Path, argv: list[str]) -> list[str]:
    """The command line that runs `python -m agora` under the group's environment."""
    return [str(py), "-m", "agora", *argv]
