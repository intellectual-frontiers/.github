"""Chromium, Playwright's pinned build (0042-agora FR-030): the browser the design systems' harnesses drive.

The address is the one Playwright itself downloads its Chromium from, for the revision that the pinned Playwright names in its `browsers.json`. A Linux
Chromium also links shared libraries a fetch cannot supply: the entry's `system` list names them and `ws-host system ensure` installs them once.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from agora.core.toolchain import Resolved, ToolchainError, run_program

NAME = "chromium"


def check(r: Resolved) -> str:
    with tempfile.TemporaryDirectory(prefix="agora-check-") as tmp:
        page = Path(tmp) / "page.html"
        page.write_text("<!doctype html><title>check</title><h1>loaded</h1>", encoding="utf-8")
        code, out = run_program([str(r.path_of("chrome")), "--headless", "--disable-gpu", "--no-sandbox", "--dump-dom",
                                 f"file://{page}"], r.env(), timeout=120)
    if code != 0 or "<h1>loaded</h1>" not in out:
        hint = " (its system libraries may be missing: run `ws-host system ensure`)" if "error while loading shared libraries" in out else ""
        raise ToolchainError(f"Chromium did not load a page{hint}: {out[-400:]}", entries=[NAME], fetchable=False)
    return "Chromium loaded a page"
