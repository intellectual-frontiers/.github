"""Playwright for Node, for the design systems' browser harnesses (0042-agora FR-030): an npm package `ws-host` installs from its lock, by a pinned Node."""
from __future__ import annotations

from agora.core.toolchain import Resolved, ToolchainError, run_program

NAME = "playwright"


def check(r: Resolved) -> str:
    base = r.entry_path(NAME)
    code, out = run_program(["node", "-e", "console.log(require('playwright').chromium.name())"], r.env(), cwd=base)
    if code != 0 or "chromium" not in out:
        raise ToolchainError(f"Node could not load Playwright: {out[-300:]}", entries=[NAME], fetchable=False)
    return "Node loaded Playwright"
