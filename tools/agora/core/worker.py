"""Isolated workers (0041-command-line FR-028): a section whose group differs from the process's own runs in its own
process under its own plan, returning its result as JSON. One process never holds two locks."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any

from . import plan
from .checks import SectionResult
from .ctx import Ctx
from .registry import Section
from .resource import AgoraError, FAILED


def needs_worker(ctx: Ctx, s: Section) -> bool:
    p = plan.plan_for(ctx.registry, s.group)
    mine = ctx.env.get("AGORA_PLAN_GROUP")
    return s.isolated or (not p.stdlib and mine != s.group) or (p.stdlib and mine not in (None, "") and mine != s.group)


def run_section(ctx: Ctx, s: Section, scope: str | None) -> SectionResult:
    p = plan.plan_for(ctx.registry, s.group)
    py = plan.prepare(ctx.registry, s.group, offline=ctx.offline, command=f"check {s.name}") if not p.stdlib else sys.executable
    argv = [str(py), "-m", "agora", "check", s.name, "--json", "--no-log"]
    if scope:
        argv += ["--scope", scope]
    if ctx.relocated:
        argv += ["--root", str(ctx.root)]
    if ctx.offline:
        argv.append("--offline")
    env = {**ctx.env, "PYTHONPATH": str(ctx.home / "tools"), "AGORA_PLAN_GROUP": s.group}
    proc = subprocess.run(argv, capture_output=True, text=True, env=env, cwd=ctx.home)
    try:
        doc = json.loads(proc.stdout)
    except ValueError:
        raise AgoraError("worker", f"the worker for section {s.name} returned no resource: {proc.stderr.strip()[-300:]}",
                         exit=FAILED) from None
    if doc.get("kind") == "error":
        d = doc["data"]
        raise AgoraError(d.get("code", "worker"), d.get("message", ""), exit=proc.returncode or FAILED)
    return SectionResult.from_dict(doc["data"]["sections"][0])
