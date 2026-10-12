"""A stand-in for `archon` in the toolchain tests: a backend that answers from a JSON state file and obtains an entry by marking it ready, so the adapter of
core/toolchain.py runs end to end with no network and no real install (0041-command-line FR-066, FR-067)."""
from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path
from unittest import mock

from agora.core import toolchain as tc
from agora.core.toolchain import Toolchain, ToolchainError


class FakeBackend:
    """What `ArchonBackend` offers (`rows` and `obtain`), from the host's state file."""

    def __init__(self, host: "FakeHost"):
        self.host = host

    def rows(self) -> dict:
        st = json.loads(self.host.state.read_text())
        ready = [e for e in st["entries"] if e["state"] == "ready"]
        env = {k: v for e in ready for k, v in e.get("env", {}).items()}
        if ready and any(e.get("bin") for e in ready):
            env["PATH"] = ":".join(e["bin"] for e in ready if e.get("bin"))
        return {"entries": [{k: e.get(k) for k in ("name", "version", "summary", "state", "path", "needs", "provides")} for e in st["entries"]],
                "environment": env}

    def obtain(self, names: list[str]) -> None:
        st = json.loads(self.host.state.read_text())
        for name in names:
            with open(self.host.log, "a") as f:
                f.write(f"obtain {name}\n")
            e = next(x for x in st["entries"] if x["name"] == name)
            if e.get("fail"):
                raise ToolchainError(e["fail"], entries=[name], fetchable=False, exit=e.get("exit", 3))
            e["state"] = "ready"
        self.host.state.write_text(json.dumps(st))


class FakeHost:
    """A stand-in source of entries of the test's choosing, and the log of what was obtained."""

    def __init__(self, tmp: Path):
        self.tmp = Path(tmp)
        self.state = self.tmp / "toolchain-state.json"
        self.log = self.tmp / "toolchain-log.txt"
        self.entries: list[dict] = []
        self.extra: dict = {}
        self.save()

    def save(self) -> None:
        self.state.write_text(json.dumps({"entries": self.entries, **self.extra}))

    def add(self, name: str, *, ready: bool = True, version: str = "1.0", files: dict[str, bytes] | None = None, provides: dict[str, str] | None = None,
            env: dict[str, str] | None = None, needs: tuple[str, ...] = (), fail: str | None = None, exit: int = 3, bin: str | None = None) -> Path:
        """An entry whose files are written under the test's folder; `ready` says whether it is reported obtained."""
        path = self.tmp / "store" / name
        path.mkdir(parents=True, exist_ok=True)
        for rel, data in (files or {}).items():
            f = path / rel
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(data)
            f.chmod(0o755)
        self.entries.append({"name": name, "version": version, "summary": f"{name}, for a test", "state": "ready" if ready else "missing", "path": str(path),
                             "needs": list(needs), "provides": {k: str(path / v) for k, v in (provides or {}).items()},
                             "env": {k: v.replace("{dir}", str(path)) for k, v in (env or {}).items()}, "fail": fail, "exit": exit,
                             "bin": str(path / bin) if bin else None})
        self.save()
        return path

    @contextlib.contextmanager
    def patched(self):
        """Every Toolchain built inside the block (by `run_json` and the commands it runs) answers from this host."""
        with mock.patch.object(tc, "ArchonBackend", lambda home, env, offline: FakeBackend(self)):
            yield self

    def asked(self) -> list[str]:
        return self.log.read_text().splitlines() if self.log.is_file() else []

    def env(self, **more: str) -> dict[str, str]:
        return {**os.environ, **more}

    def toolchain(self, *, offline: bool = False, env: dict[str, str] | None = None, lines: list[str] | None = None) -> Toolchain:
        return Toolchain(self.tmp, env=env if env is not None else self.env(), offline=offline,
                         announce=(lines.append if lines is not None else (lambda _l: None)), backend=FakeBackend(self))
