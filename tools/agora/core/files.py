"""Writing tracked files with `--dry-run` (0041-command-line FR-015)."""
from __future__ import annotations

import difflib
from pathlib import Path
from typing import Any

from .ctx import Ctx

DIFF_LINES = 60


def apply(ctx: Ctx, changes: dict[Path, str], root: Path | None = None) -> list[dict[str, Any]]:
    """Write each path's new text, or under `--dry-run` write nothing. Returns what changed in each file."""
    root = root or ctx.root
    out: list[dict[str, Any]] = []
    for path, new in changes.items():
        old = path.read_text(encoding="utf-8") if path.is_file() else None
        if old == new:
            continue
        diff = list(difflib.unified_diff((old or "").splitlines(), new.splitlines(), "before", "after", lineterm="", n=1))
        rel = str(path.relative_to(root)) if path.is_relative_to(root) else str(path)
        out.append({"path": rel, "change": "create" if old is None else "modify",
                    "added": sum(1 for l in diff if l.startswith("+") and not l.startswith("+++")),
                    "removed": sum(1 for l in diff if l.startswith("-") and not l.startswith("---")),
                    "diff": diff[:DIFF_LINES] + ([f"... {len(diff) - DIFF_LINES} more lines"] if len(diff) > DIFF_LINES else [])})
        if not ctx.dry_run:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(new, encoding="utf-8")
    return out
