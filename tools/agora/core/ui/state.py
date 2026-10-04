"""A running UI's state file (0042-agora FR-023): its process id, port and address, untracked."""
from __future__ import annotations

import json
import os
import socket
import time
from pathlib import Path
from typing import Any

HOST = "127.0.0.1"


def state_dir(home: Path, registry: Any) -> Path:
    return home / registry.root_manifest.get("ui", ".agora/ui")


def _file(home: Path, registry: Any, ui: str) -> Path:
    return state_dir(home, registry) / f"{ui}.json"


def alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    try:  # a process that has ended and is not yet reaped is not running
        return Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[0] != "Z"
    except (OSError, IndexError):
        return True


def read(home: Path, registry: Any, ui: str) -> dict[str, Any] | None:
    """The state of a running UI, or None. A state file whose process has gone is stale: it is removed."""
    f = _file(home, registry, ui)
    try:
        st = json.loads(f.read_text(encoding="utf-8"))
        pid = int(st["pid"])
    except (OSError, ValueError, KeyError, TypeError):
        return None
    if alive(pid):
        return st
    f.unlink(missing_ok=True)
    return None


def write(home: Path, registry: Any, ui: str, port: int) -> dict[str, Any]:
    st = {"ui": ui, "pid": os.getpid(), "port": port, "url": f"http://{HOST}:{port}/",
          "started": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
    f = _file(home, registry, ui)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(st) + "\n", encoding="utf-8")
    return st


def clear(home: Path, registry: Any, ui: str, pid: int | None = None) -> None:
    f = _file(home, registry, ui)
    try:
        if pid is None or json.loads(f.read_text(encoding="utf-8")).get("pid") == pid:
            f.unlink(missing_ok=True)
    except (OSError, ValueError):
        pass


def free_port() -> int:
    with socket.socket() as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]
