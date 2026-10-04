"""Writing tracked files with `--dry-run` (0041-command-line FR-015)."""
from __future__ import annotations

import difflib
from pathlib import Path
from typing import Any

from .ctx import Ctx

DIFF_LINES = 60


def _read(path: Path) -> str | bytes | None:
    if not path.is_file():
        return None
    data = path.read_bytes()
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data


def norm(data: str | bytes | None) -> str | bytes | None:
    """Content as a file is read back: text where it is UTF-8, bytes otherwise, so a text file read as bytes compares equal."""
    if isinstance(data, bytes):
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError:
            return data
    return data


def diff_of(old: str | bytes | None, new: str | bytes | None) -> list[str]:
    """A unified diff of two texts; none for a binary file."""
    if isinstance(old, bytes) or isinstance(new, bytes):
        return []
    return list(difflib.unified_diff((old or "").splitlines(), (new or "").splitlines(), "before", "after", lineterm="", n=1))


def apply(ctx: Ctx, changes: dict[Path, str | bytes | None], root: Path | None = None) -> list[dict[str, Any]]:
    """Write each path's new content (text or bytes), delete a path whose content is None, or under `--dry-run` write
    nothing. Returns what changed in each file."""
    root = root or ctx.root
    out: list[dict[str, Any]] = []
    for path, new in changes.items():
        old, new = _read(path), norm(new)
        if old == new:
            continue
        diff = diff_of(old, new)
        rel = str(path.relative_to(root)) if path.is_relative_to(root) else str(path)
        out.append({"path": rel, "change": "delete" if new is None else "create" if old is None else "modify",
                    "added": sum(1 for l in diff if l.startswith("+") and not l.startswith("+++")),
                    "removed": sum(1 for l in diff if l.startswith("-") and not l.startswith("---")),
                    "diff": diff[:DIFF_LINES] + ([f"... {len(diff) - DIFF_LINES} more lines"] if len(diff) > DIFF_LINES else [])})
        if ctx.dry_run:
            continue
        if new is None:
            path.unlink()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(new if isinstance(new, bytes) else new.encode("utf-8"))
    return out
