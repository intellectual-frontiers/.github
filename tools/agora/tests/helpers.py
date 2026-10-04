"""Fixtures: run agora in-process, and build small repositories to check."""
from __future__ import annotations

import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from typing import Any

from agora.core.cli import main
from agora.core.registry import Registry

HOME = Path(__file__).resolve().parents[3]

CLOSING = """
## Out of scope

- Nothing.

## Edge cases

- A case, per FR-001.

## Assumptions

- A condition.

## Open questions

- None.

## Key entities

- **Thing** - a thing.

## Success criteria

- **SC-001**: It works.

## Review & acceptance checklist

- [x] Done
"""


def spec_text(name: str, status: str = "Draft", frs: int = 1, extra: str = "") -> str:
    items = "\n".join(f"- **FR-{i:03d}**: A thing MUST hold." for i in range(1, frs + 1))
    return (f"# Feature Specification: {name}\n\n**Spec ID:** {name}\n**Status:** {status}\n\n**Input:** A thing.\n\n"
            f"## Rules\n\n{items}\n{extra}{CLOSING}")


def run(argv: list[str], home: Path = HOME, env: dict[str, str] | None = None, registry: Registry | None = None
        ) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    argv = list(argv)
    if "--no-log" not in argv and argv[:1] not in (["--complete"], ["--completion-script"]):
        argv.append("--no-log")
    code = main(argv, home=home, stdout=out, stderr=err, env={"PATH": "/usr/bin:/bin", **(env or {})}, registry=registry)
    return code, out.getvalue(), err.getvalue()


def run_json(argv: list[str], **kw: Any) -> tuple[int, dict[str, Any]]:
    code, out, err = run([*argv, "--json"], **kw)
    return code, json.loads(out or err)


class TempRepo(unittest.TestCase):
    """A small repository in a temp dir, valid until a test breaks it."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first"))
        self.write("spec-kit/enforcement.tsv", "requirement\tmechanism\tby\tnote\n0001-first FR-001\tnone\t-\tnot yet\n")

    def write(self, rel: str, text: str) -> Path:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    def check(self, *sections: str) -> dict[str, Any]:
        code, doc = run_json(["check", *sections, "--root", str(self.root)])
        self.last_code = code
        return doc

    def findings(self, section: str) -> list[str]:
        doc = self.check(section)
        return [f["message"] for s in doc["data"]["sections"] for f in s["findings"]]
