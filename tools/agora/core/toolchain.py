"""agora's view of the toolchain that `ws-host` owns (0042-agora FR-030; 0025-tooling-environment). Standard library only (0041-command-line FR-005).

agora declares what it needs in `.workspaces-host/` (provider.toml and toolchain.d/*.toml, read as data by `ws-host`); `ws-host` fetches, verifies,
unpacks and stores the programs and says where they are. This module asks it, through its command line, and nothing else:

  - `Toolchain.use(names)` returns where the named entries (and what they need) are, installing missing ones first with
    `ws-host toolchain ensure` unless offline, when a missing one ends the command with exit status 3 naming it;
  - `Resolved` says where an entry's programs are and the environment they run in, which never carries what the host's own TeX, Playwright or
    Node settings would add (those names are removed first);
  - an entry's functional check and the way a program is started (a jar is run by a runtime) are agora's own code, in `agora/toolchain/<name>.py`,
    found by presence (0041-command-line FR-066): they hold no address, no checksum and no version.

A `Toolchain` takes its `ws-host` command and environment as values, so that the tests drive it with a stand-in program.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping

from .resource import FAILED, MISSING, AgoraError, next_command

PROVIDER = "agora"
WS_HOST = "ws-host"
FETCH_COMMAND = "toolchain ensure"
# What the host's own settings would otherwise add to a program's behavior (a TeX tree, a Playwright browser path, a Node
# search path): none of it reaches a program agora runs (0025 FR-019).
SCRUBBED = ("TEXMFHOME", "TEXMFLOCAL", "TEXMFVAR", "TEXMFCONFIG", "TEXMFCNF", "TEXMFDIST", "TEXMFSYSVAR", "TEXMFSYSCONFIG",
            "TEXINPUTS", "TEXFONTS", "OSFONTDIR", "TEXFORMATS", "NODE_OPTIONS", "NODE_PATH", "PLAYWRIGHT_BROWSERS_PATH",
            "PLAYWRIGHT_MODULE", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "CHROMIUM", "SOURCE_DATE_EPOCH", "PARAGON")
# A name several entries share, so that a command asks for "the TeX packages" without listing each (0042-agora FR-030).
GROUPS = {"tex-packages": "tex-"}


class ToolchainError(AgoraError):
    """This host cannot supply a toolchain entry. Exit status 3 unless the file that arrived was the wrong one (1)."""

    def __init__(self, message: str, *, entries: list[str] | tuple[str, ...] = (), code: str = "toolchain",
                 exit: int = MISSING, fetchable: bool = True):
        hint = f" Run `{WS_HOST} {FETCH_COMMAND} {' '.join(entries)} --provider {PROVIDER}`." if entries and fetchable else ""
        super().__init__(code, message + hint, exit=exit, detail={"entries": list(entries)} if entries else {})
        self.entries = list(entries)


class WsHostMissing(ToolchainError):
    def __init__(self, why: str):
        super().__init__(why, code="ws-host-missing", fetchable=False)


# ---- asking ws-host --------------------------------------------------------------------------------------------

def ws_host_command(env: Mapping[str, str] | None = None) -> list[str]:
    """The command that starts `ws-host`: WS_HOST when set, else the one on PATH."""
    env = os.environ if env is None else env
    named = env.get("WS_HOST")
    found = named or shutil.which(WS_HOST, path=env.get("PATH"))
    if not found:
        raise WsHostMissing("ws-host is needed and is not on PATH; install it from https://github.com/intellectual-frontiers/workspaces-host, "
                            f"then run `{WS_HOST} provider add` on this clone")
    return found.split()


def ask(args: list[str], env: Mapping[str, str] | None = None, timeout: int = 3600) -> dict[str, Any]:
    """`ws-host ARGS --json`: the document it answers with, or a ToolchainError saying why it could not."""
    cmd = [*ws_host_command(env), *args, "--json"]
    try:
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=dict(os.environ if env is None else env))
    except (OSError, subprocess.TimeoutExpired) as e:
        raise WsHostMissing(f"ws-host could not be run: {e}")
    lines = [l for l in done.stdout.splitlines() if l.strip().startswith("{")]
    try:
        doc = json.loads(lines[-1])
    except (IndexError, ValueError):
        raise ToolchainError(f"ws-host {' '.join(args)} gave no answer: {(done.stderr or done.stdout).strip()[-300:]}", code="ws-host-answer",
                             exit=FAILED_EXIT, fetchable=False)
    doc["_exit"] = done.returncode
    return doc


FAILED_EXIT = 1


def platform_name() -> str:
    import platform

    return "linux-arm64" if platform.machine().lower() in ("aarch64", "arm64") else "linux-x64"


# ---- the declaration, as agora's own code knows it -----------------------------------------------------------------

@dataclass
class Entry:
    name: str
    version: str = ""
    summary: str = ""
    state: str = "missing"              # ready | missing
    path: Path | None = None
    needs: tuple[str, ...] = ()
    provides: dict[str, str] = field(default_factory=dict)      # program -> path
    env: dict[str, str] = field(default_factory=dict)
    check: Callable[["Resolved"], str] | None = None
    argv: Callable[["Resolved", str], list[str]] | None = None


def discover_code() -> dict[str, Any]:
    """Each module of `agora.toolchain` that holds a `NAME`: its `check` and `argv`, found by presence (0041-command-line FR-066)."""
    import importlib
    import pkgutil

    pkg = importlib.import_module("agora.toolchain")
    out: dict[str, Any] = {}
    for info in sorted(pkgutil.iter_modules(pkg.__path__), key=lambda i: i.name):
        mod = importlib.import_module(f"agora.toolchain.{info.name}")
        if hasattr(mod, "NAME"):
            out[mod.NAME] = mod
    return out


def declared(home: Path) -> dict[str, dict[str, Any]]:
    """The entries `.workspaces-host/toolchain.d/*.toml` declare, read as data (name, version, summary, kind, needs)."""
    import tomllib

    out: dict[str, dict[str, Any]] = {}
    d = home / ".workspaces-host" / "toolchain.d"
    for f in sorted(d.glob("*.toml")) if d.is_dir() else []:
        try:
            out[f.stem] = tomllib.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            out[f.stem] = {}
    return out


def run_program(argv: list[str], env: Mapping[str, str], *, cwd: Path | None = None, timeout: int = 300) -> tuple[int, str]:
    """Run a program for a functional check: its exit status and its output (standard output and error together)."""
    try:
        p = subprocess.run(argv, env=dict(env), cwd=cwd, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, f"{type(e).__name__}: {e}"
    return p.returncode, (p.stdout + p.stderr).decode("utf-8", "replace")


# ---- resolving -------------------------------------------------------------------------------------------------

@dataclass
class Resolved:
    """Where the entries a command named are, on this host, and how to start their programs."""

    toolchain: "Toolchain"
    dirs: dict[str, Path] = field(default_factory=dict)
    delta: dict[str, str] = field(default_factory=dict)

    def has_entry(self, name: str) -> bool:
        return name in self.dirs

    def entry_path(self, name: str) -> Path:
        if name not in self.dirs:
            raise ToolchainError(f"toolchain entry {name} is not installed", entries=[name])
        return self.dirs[name]

    def path_of(self, program: str) -> Path:
        """The program's executable, in the store."""
        owner = self.toolchain.owner(program)
        if owner is None or owner not in self.dirs:
            raise ToolchainError(f"{program} is not available: its entry {owner or '(none)'} is not installed", entries=[owner] if owner else [])
        return Path(self.toolchain.entries[owner].provides[program])

    def argv(self, program: str) -> list[str]:
        """The argument vector that starts a program, before its own arguments: the program itself, or what its entry says
        starts it (a jar is run by the entry's runtime)."""
        owner = self.toolchain.owner(program)
        entry = self.toolchain.entries.get(owner) if owner else None
        if entry is not None and entry.argv:
            return entry.argv(self, program)
        return [str(self.path_of(program))]

    def env(self, extra: Mapping[str, str] | None = None) -> dict[str, str]:
        """The host's environment without what would change a program's output, plus what the installed entries add: their programs first on PATH and
        their variables."""
        env = self.toolchain.clean_env()
        for k, v in self.delta.items():
            if k == "PATH":
                env["PATH"] = os.pathsep.join([v, env.get("PATH", "")])
            else:
                env[k] = v
        env.update(extra or {})
        return env


class Toolchain:
    """What `ws-host` says agora's provider pins, a stand-in for the entries' code, and the environment commands run in."""

    def __init__(self, home: Path | None = None, *, env: Mapping[str, str] | None = None, offline: bool | None = None,
                 announce: Callable[[str], None] | None = None):
        self.home = home or Path(__file__).resolve().parents[3]
        self.env: Mapping[str, str] = os.environ if env is None else env
        self.offline = (self.env.get("AGORA_OFFLINE", "") not in ("", "0")) if offline is None else offline
        self.announce = announce or (lambda line: print(line, file=sys.stderr, flush=True))
        self._answer: dict[str, Any] | None = None
        self._code = discover_code()

    # -- what ws-host says
    def refresh(self) -> dict[str, Any]:
        doc = ask(["provider", "show", PROVIDER], self.env)
        data = doc.get("data", {})
        if doc.get("kind") == "error" or "entries" not in data:
            raise ToolchainError(data.get("plain") or data.get("message") or "ws-host does not know this provider", code="provider-not-enabled",
                                 exit=MISSING, fetchable=False)
        self._answer = data
        return data

    @property
    def answer(self) -> dict[str, Any]:
        return self._answer if self._answer is not None else self.refresh()

    @property
    def entries(self) -> dict[str, Entry]:
        out: dict[str, Entry] = {}
        for row in self.answer["entries"]:
            mod = self._code.get(row["name"])
            out[row["name"]] = Entry(
                row["name"], row["version"], row.get("summary", ""), row["state"], Path(row["path"]) if row.get("path") else None,
                tuple(row.get("needs", ())), dict(row.get("provides", {})), {}, getattr(mod, "check", None), getattr(mod, "argv", None))
        return out

    # -- naming
    def get(self, name: str) -> Entry:
        e = self.entries.get(name)
        if e is None:
            raise ToolchainError(f"there is no toolchain entry {name!r}; `{WS_HOST} provider show {PROVIDER}` names them", code="invalid-argument",
                                 exit=2, fetchable=False)
        return e

    def owner(self, program: str) -> str | None:
        for e in self.entries.values():
            if program in e.provides:
                return e.name
        return None

    def clean_env(self) -> dict[str, str]:
        env = dict(self.env)
        for name in SCRUBBED:
            env.pop(name, None)
        for name in [n for n in env if n.startswith("PLAYWRIGHT_")]:
            env.pop(name, None)
        return env

    # -- state
    def state(self, entry: Entry) -> str:
        return entry.state

    def expand(self, names: tuple[str, ...] | list[str]) -> list[str]:
        """The named entries and every entry they need, each once, a need before what needs it. A group name stands for its entries."""
        entries = self.entries
        out: list[str] = []

        def visit(name: str, trail: tuple[str, ...] = ()) -> None:
            if name in out:
                return
            if name in GROUPS:
                for n in sorted(entries):
                    if n.startswith(GROUPS[name]):
                        visit(n, trail)
                return
            if name not in entries:
                raise ToolchainError(f"there is no toolchain entry {name!r}", entries=[name], code="invalid-argument", exit=2, fetchable=False)
            if name in trail:
                raise ToolchainError(f"toolchain entry {name} needs itself", code="invalid-argument", exit=2, fetchable=False)
            for n in entries[name].needs:
                visit(n, (*trail, name))
            out.append(name)

        for n in names:
            visit(n)
        return out

    def lacking(self, names: tuple[str, ...] | list[str]) -> list[str]:
        entries = self.entries
        return [n for n in self.expand(names) if entries[n].state != "ready"]

    # -- resolving
    def resolve(self, names: tuple[str, ...] | list[str]) -> Resolved:
        gone = self.lacking(names)
        if gone:
            raise ToolchainError(f"not installed: {', '.join(f'{n} {self.entries[n].version}' for n in gone)}", entries=gone)
        return Resolved(self, {n: Path(self.entries[n].path) for n in self.expand(names) if self.entries[n].path}, dict(self.answer.get("environment", {})))

    def ensure(self, names: tuple[str, ...] | list[str]) -> Resolved:
        """Install what the named entries need that is missing, through `ws-host`, then say where it all is."""
        gone = self.lacking(names)
        if gone and self.offline:
            raise ToolchainError("offline, and not installed: " + ", ".join(f"{n} {self.entries[n].version}" for n in gone), entries=gone)
        for n in gone:
            e = self.entries[n]
            self.announce(f"installing {n} {e.version} with ws-host")
            doc = ask(["toolchain", "ensure", n, "--provider", PROVIDER] + (["--offline"] if self.offline else []), self.env)
            if doc.get("_exit", 1) != 0:
                data = doc.get("data", {})
                raise ToolchainError(data.get("plain") or data.get("message") or f"ws-host could not install {n}", entries=[n], fetchable=False,
                                     exit=MISSING if doc.get("_exit") == 3 else FAILED_EXIT)
        if gone:
            self.refresh()
        return self.resolve(names)

    use = ensure
