"""Untracked NDJSON action logs (0041-command-line FR-042; 0042-agora FR-021)."""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any


def worth_logging(category: str) -> bool:
    """What changes or runs something is logged; a `read` changes nothing and is not (0041 FR-042)."""
    return category != "read"


def write(logs_dir: Path, *, surface: str, command: str, args: dict[str, Any], exit: int, dry_run: bool = False,
          trace: str | None = None) -> None:
    """Append one line: time, surface, command, typed arguments (never a person's name, secret or file contents), exit
    status. A failure to log never fails the command."""
    line: dict[str, Any] = {"time": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "surface": surface, "command": command,
                            "args": args, "exit": exit}
    if dry_run:
        line["dry_run"] = True
    if trace:
        line["trace"] = trace
    try:
        logs_dir.mkdir(parents=True, exist_ok=True)
        with (logs_dir / f"{time.strftime('%Y-%m-%d')}.ndjson").open("a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
    except OSError:
        pass
