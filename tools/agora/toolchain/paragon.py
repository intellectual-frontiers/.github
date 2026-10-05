"""Paragon, for the Open edX package's build (0042-agora FR-030): an npm package `ws-host` installs from its lock, by a pinned Node."""
from __future__ import annotations

from agora.core.toolchain import Resolved, ToolchainError

NAME = "paragon"


def check(r: Resolved) -> str:
    cli = r.path_of("paragon")
    if not cli.exists():
        raise ToolchainError(f"Paragon's CLI is not at {cli}", entries=[NAME], fetchable=False)
    return "Paragon's CLI is installed"
