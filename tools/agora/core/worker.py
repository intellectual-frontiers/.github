"""Isolated workers (0041-command-line FR-028): a section whose group differs from the process's own runs in its own
process under its own plan, returning its result as JSON. One process never holds two locks."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from typing import Any

from . import plan
from .checks import SectionResult
from .ctx import Ctx
from .registry import Section
from .resource import AgoraError, FAILED


def needs_worker(ctx: Ctx, s: Section) -> bool:
    p = plan.plan_for(ctx.registry, s.group)
    mine = ctx.env.get("AGORA_PLAN_GROUP")
    return (s.isolated and mine != s.group) or (not p.stdlib and mine != s.group) or (p.stdlib and mine not in (None, "") and mine != s.group)


def run_section(ctx: Ctx, s: Section, scope: str | list[str] | None) -> SectionResult:
    p = plan.plan_for(ctx.registry, s.group)
    py = plan.prepare(ctx.registry, s.group, offline=ctx.offline, command=f"check {s.name}") if not p.stdlib else sys.executable
    argv = [str(py), "-m", "agora", "check", s.name, "--json", "--no-log"]
    for one in [scope] if isinstance(scope, str) else scope or []:
        argv += ["--scope", one]
    for flag in ("runner", "brand", "paragon", "mode"):
        if ctx.section_options.get(flag) and f"--{flag}" in s.options:
            argv += [f"--{flag}", str(ctx.section_options[flag])]
    for flag in ("draft", "spoken"):
        if ctx.section_options.get(flag) and f"--{flag}" in s.options:
            argv.append(f"--{flag}")
    if ctx.relocated:
        argv += ["--root", str(ctx.root)]
    if ctx.offline:
        argv.append("--offline")
    env = {**ctx.env, "PYTHONPATH": str(ctx.home / "tools"), "AGORA_PLAN_GROUP": s.group}
    # The worker's stderr is the section's progress (a harness's own output): pass it on as it arrives, keep its tail.
    proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env, cwd=ctx.home)
    tail: list[str] = []

    def forward() -> None:
        for line in proc.stderr:  # type: ignore[union-attr]
            print(line, end="", file=sys.stderr, flush=True)
            tail.append(line)
            del tail[:-20]

    t = threading.Thread(target=forward, daemon=True)
    t.start()
    stdout = proc.stdout.read()  # type: ignore[union-attr]
    proc.wait()
    t.join()
    try:
        doc = json.loads(stdout)
    except ValueError:
        raise AgoraError("worker", f"the worker for section {s.name} returned no resource: {''.join(tail).strip()[-300:]}",
                         exit=FAILED) from None
    if doc.get("kind") == "error":
        d = doc["data"]
        raise AgoraError(d.get("code", "worker"), d.get("message", ""), exit=proc.returncode or FAILED)
    return SectionResult.from_dict(doc["data"]["sections"][0])
