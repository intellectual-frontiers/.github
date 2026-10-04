"""0025-tooling-environment FR-008: tools/reference-environment pins the reference environment as one flake reference
at a full commit, and the devcontainer's image, if there is one, is tagged with that commit."""
from __future__ import annotations

import re
from pathlib import Path

from agora.core.checks import Finding

PIN = re.compile(r"^github:[\w.-]+/[\w.-]+/[0-9a-f]{40}$")
IMAGE = re.compile(r'("image"\s*:\s*"[^"]*:sha-)([0-9a-f]+)(")')


def pin_commit(root: Path) -> str | None:
    pin = root / "tools" / "reference-environment"
    if not pin.is_file():
        return None
    lines = [l for l in pin.read_text(encoding="utf-8").splitlines() if l.strip()]
    return lines[0].strip().rsplit("/", 1)[1] if len(lines) == 1 and PIN.match(lines[0].strip()) else None


def image_tag(root: Path) -> str | None:
    dc = root / ".devcontainer" / "devcontainer.json"
    if not dc.is_file():
        return None
    m = IMAGE.search(dc.read_text(encoding="utf-8"))
    return m.group(2) if m else None


def check_reference_environment(root: Path) -> list[Finding]:
    pin = root / "tools" / "reference-environment"
    if not (root / "tools").is_dir():
        return []
    if not pin.is_file():
        return [Finding("error", "tools/reference-environment", "is missing; pin the reference environment (0025-tooling-environment FR-008)")]
    lines = [l for l in pin.read_text(encoding="utf-8").splitlines() if l.strip()]
    if len(lines) != 1 or not PIN.match(lines[0].strip()):
        return [Finding("error", "tools/reference-environment", "must hold one line, github:<owner>/<repo>/<40-hex commit> (0025-tooling-environment FR-008)")]
    commit = lines[0].strip().rsplit("/", 1)[1]
    dc = root / ".devcontainer" / "devcontainer.json"
    if dc.is_file():
        tag = image_tag(root)
        if not tag or not commit.startswith(tag) or len(tag) < 7:
            return [Finding("error", ".devcontainer/devcontainer.json", f"its image must be tagged sha-{commit[:7]}, matching tools/reference-environment (0025-tooling-environment FR-008)")]
    return []


def new_pin_text(old: str, commit: str) -> str:
    return re.sub(r"[0-9a-f]{40}", commit, old, count=1)


def new_devcontainer_text(old: str, commit: str) -> str:
    return IMAGE.sub(lambda m: f"{m.group(1)}{commit[:7]}{m.group(3)}", old, count=1)
