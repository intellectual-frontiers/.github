"""The Temurin Java runtime that AsciidoctorJ runs on (0042-agora FR-030)."""
from __future__ import annotations

from agora.core.toolchain import Resolved, ToolchainError, run_program

NAME = "jre"


def check(r: Resolved) -> str:
    code, text = run_program([str(r.path_of("java")), "-version"], r.env())
    if code != 0 or "Temurin" not in text:
        raise ToolchainError(f"java did not start: {text[-300:]}", entries=[NAME], fetchable=False)
    return text.splitlines()[0].strip()
