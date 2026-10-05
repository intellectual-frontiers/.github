"""Generators and `fresh` (0041-command-line FR-035, FR-036).

A generator returns every tracked file it writes, in memory, as a `Generated`. The command that rewrites them applies it
with `files.apply` (so `--dry-run` shows the change); `fresh` compares it with the tracked files and writes nothing.
A generator whose group pins packages runs in that group's own process, like an isolated check section.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import plan
from .ctx import Ctx
from .files import _read, norm
from .registry import Generator
from .resource import MISSING, AgoraError, Call


@dataclass
class Generated:
    """What a generator writes: each file's content (text or bytes) by absolute path."""

    files: dict[Path, str | bytes] = field(default_factory=dict)
    # Directories the generator owns outright: a file in one that it did not write is stale, except the top-level names
    # listed (built output, caches) that something else owns.
    owned: list[tuple[Path, tuple[str, ...]]] = field(default_factory=list)
    # The call that rewrites a file, where it differs from the generator's own command (a unit's name, say).
    calls: dict[Path, Call] = field(default_factory=dict)
    # The same, where the command is another tool's own and no agora command (a design system's script), as written.
    literal: dict[Path, str] = field(default_factory=dict)

    def merge(self, other: "Generated") -> None:
        self.files.update(other.files)
        self.owned += other.owned
        self.calls.update(other.calls)
        self.literal.update(other.literal)


def rewrite_call(gen: Generator, gd: Generated, path: Path) -> Call | None:
    if path in gd.calls:
        return gd.calls[path]
    return Call(gen.command, {}) if gen.command else None


def orphans(gd: Generated) -> list[Path]:
    """Files in a directory the generator owns that it did not write."""
    out: list[Path] = []
    for d, ignore in gd.owned:
        if d.is_dir():
            out += [p for p in sorted(d.rglob("*")) if p.is_file() and p.relative_to(d).parts[0] not in ignore and p not in gd.files]
    return out


def stale_files(ctx: Ctx, gen: Generator, gd: Generated) -> list[dict[str, str]]:
    """Where the tracked files differ from what the generator writes: each file's path, why, and the command that rewrites it."""
    out: list[dict[str, str]] = []

    def rel(p: Path) -> str:
        return str(p.relative_to(ctx.root)) if p.is_relative_to(ctx.root) else str(p)

    def add(p: Path, why: str) -> None:
        c = None if p in gd.literal else rewrite_call(gen, gd, p)
        out.append({"path": rel(p), "why": why,
                    "rewrite": gd.literal[p] if p in gd.literal else c.cli(ctx.registry, ctx.registry.name) if c else "",
                    "call": {"command": c.command, "fields": c.fields} if c else None})

    for path, new in sorted(gd.files.items()):
        old, new = _read(path), norm(new)
        if old is None:
            add(path, "is missing")
        elif old != new:
            add(path, "differs from what the generator writes")
    for p in orphans(gd):
        add(p, "is not written by the generator")
    return out


def needs_worker(ctx: Ctx, gen: Generator) -> bool:
    p = plan.plan_for(ctx.registry, gen.group)
    return not p.stdlib and ctx.env.get("AGORA_PLAN_GROUP") != gen.group


def _worker(ctx: Ctx, gen: Generator) -> dict[str, Any]:
    py = plan.prepare(ctx.registry, gen.group, offline=ctx.offline, command=f"fresh {gen.name}")
    argv = [str(py), "-m", "agora", "fresh", gen.name, "--json", "--no-log"]
    if ctx.offline:
        argv.append("--offline")
    env = {**ctx.env, "PYTHONPATH": str(ctx.home / "tools"), "AGORA_PLAN_GROUP": gen.group}
    proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env, cwd=ctx.home)
    tail: list[str] = []

    def forward() -> None:
        for line in proc.stderr:  # type: ignore[union-attr]
            tail.append(line)
            del tail[:-20]

    t = threading.Thread(target=forward, daemon=True)
    t.start()
    stdout = proc.stdout.read()  # type: ignore[union-attr]
    proc.wait()
    t.join()
    proc.stdout.close()  # type: ignore[union-attr]
    proc.stderr.close()  # type: ignore[union-attr]
    try:
        doc = json.loads(stdout)
    except ValueError:
        raise AgoraError("worker", f"the worker for generator {gen.name} returned no resource: {''.join(tail).strip()[-300:]}",
                         exit=1) from None
    if doc.get("kind") == "error":
        d = doc["data"]
        raise AgoraError(d.get("code", "worker"), d.get("message", ""), exit=proc.returncode or 1)
    return doc["data"]["generators"][0]


def prove(ctx: Ctx, gen: Generator) -> dict[str, Any]:
    """One generator's row for `fresh`: status fresh, stale or skipped, with every stale file and its rewriting command."""
    row: dict[str, Any] = {"name": gen.name, "group": gen.group, "status": "fresh", "files": 0, "stale": [], "reason": ""}
    if gen.toolchain:
        tc = ctx.toolchain()
        try:
            tc.use(gen.toolchain)
        except AgoraError as e:
            return {**row, "status": "skipped", "reason": e.message}
    try:
        if needs_worker(ctx, gen):
            return _worker(ctx, gen)
        gd = gen.fn(ctx, None)  # type: ignore[misc]
    except AgoraError as e:
        if e.exit == MISSING:
            return {**row, "status": "skipped", "reason": e.message}
        raise
    row["files"] = len(gd.files)
    row["stale"] = stale_files(ctx, gen, gd)
    if row["stale"]:
        row["status"] = "stale"
    return row
