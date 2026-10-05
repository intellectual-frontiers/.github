"""A stand-in `ws-host` for the toolchain tests: a script that answers `provider show agora` and `toolchain ensure` from a JSON state file, so the
adapter of core/toolchain.py runs end to end with no network and no real install (0041-command-line FR-066, FR-067)."""
from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

from agora.core.toolchain import Toolchain

SCRIPT = r'''#!{python}
import json, sys
state_file = {state!r}
log_file = {log!r}
args = [a for a in sys.argv[1:] if a != "--json"]
with open(log_file, "a") as f:
    f.write(" ".join(args) + "\n")
st = json.load(open(state_file))
def out(kind, data, code=0):
    print(json.dumps({{"schema": "ws-host/" + kind + "@1", "kind": kind, "id": "x", "data": data}}))
    sys.exit(code)
if args[:3] == ["provider", "show", "agora"]:
    ready = [e for e in st["entries"] if e["state"] == "ready"]
    env = {{k: v for e in ready for k, v in e.get("env", {{}}).items()}}
    if ready and any(e.get("bin") for e in ready):
        env["PATH"] = ":".join(e["bin"] for e in ready if e.get("bin"))
    out("provider", {{"entries": [{{k: e.get(k) for k in ("name", "version", "summary", "state", "path", "needs", "provides")}} for e in st["entries"]], "environment": env}})
if args[:2] == ["toolchain", "ensure"]:
    name = args[2]
    e = next(x for x in st["entries"] if x["name"] == name)
    if e.get("fail"):
        out("error", {{"code": "toolchain-install", "message": e["fail"], "plain": e["fail"]}}, e.get("exit", 3))
    e["state"] = "ready"
    json.dump(st, open(state_file, "w"))
    out("toolchain-ensure", {{"plain": "Installed " + name, "installed": [name]}})
if args[:4] == ["toolchain", "generate", "--root", args[3]] if len(args) > 3 else False:
    out("toolchain-generate", {{"plain": "ok", "stale": st.get("stale", [])}}, st.get("generate_exit", 0))
out("error", {{"code": "usage", "message": "unknown", "plain": "unknown"}}, 2)
'''


class FakeHost:
    """A stand-in ws-host with entries of the test's choosing, and the log of what it was asked."""

    def __init__(self, tmp: Path):
        self.tmp = Path(tmp)
        self.state = self.tmp / "ws-state.json"
        self.log = self.tmp / "ws-log.txt"
        self.script = self.tmp / "ws-host"
        self.entries: list[dict] = []
        self.extra: dict = {}
        self.save()
        self.script.write_text(SCRIPT.format(python=sys.executable, state=str(self.state), log=str(self.log)))
        self.script.chmod(self.script.stat().st_mode | stat.S_IXUSR)

    def save(self) -> None:
        self.state.write_text(json.dumps({"entries": self.entries, **self.extra}))

    def add(self, name: str, *, ready: bool = True, version: str = "1.0", files: dict[str, bytes] | None = None, provides: dict[str, str] | None = None,
            env: dict[str, str] | None = None, needs: tuple[str, ...] = (), fail: str | None = None, exit: int = 3, bin: str | None = None) -> Path:
        """An entry whose files are written under the test's folder; `ready` says whether the host reports it installed."""
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

    def asked(self) -> list[str]:
        return self.log.read_text().splitlines() if self.log.is_file() else []

    def env(self, **more: str) -> dict[str, str]:
        return {**os.environ, "WS_HOST": str(self.script), "PATH": f"{self.tmp}{os.pathsep}{os.environ.get('PATH', '')}", **more}

    def toolchain(self, *, offline: bool = False, env: dict[str, str] | None = None, lines: list[str] | None = None) -> Toolchain:
        return Toolchain(self.tmp, env=env if env is not None else self.env(), offline=offline,
                         announce=(lines.append if lines is not None else (lambda _l: None)))
