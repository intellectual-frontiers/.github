"""The toolchain lock's machinery: fetch, verify, unpack and cache the programs outside Python that a command needs
(0041-command-line FR-066 to FR-068; 0025-tooling-environment FR-015 to FR-020). Standard library only (0041 FR-005).

An entry is declared in code, in `agora/toolchain/<name>.py`, found by presence (0041 FR-066): its name, version, an
`https` address and a SHA-256 for every platform upstream builds, the programs it provides and a functional check. This
module is everything else:

  - `Toolchain.ensure(names)` obtains each entry a command names: from the per-user cache when it is there, else
    downloaded, its SHA-256 verified before anything is unpacked, unpacked into a scratch directory beside the cache and
    renamed into place, so an interrupted fetch leaves nothing a later run could use (FR-017);
  - offline (`AGORA_OFFLINE=1` or `--offline`) nothing is downloaded: an entry the cache lacks ends the command with exit
    status 3 naming it, its version, the platform and `agora toolchain add` (FR-018);
  - a program found on the host is never used in an entry's place unless the person names it in the entry's variable,
    `AGORA_<ENTRY>`; `doctor` lists each one and `fresh` will not call a generator current under one (FR-019);
  - `Resolved` says where an entry's programs are and the environment they run in, which never carries what the host's own
    TeX, Playwright or Node settings would add.

A `Toolchain` takes its entries, cache, environment and platform as values, so that the tests drive it with local archives
and no network.
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import platform as _platform
import shutil
import stat
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping

from .resource import FAILED, MISSING, AgoraError, next_command

try:  # POSIX locks keep two runs from fetching one entry at once; Windows is served through WSL (0025 FR-020)
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None  # type: ignore[assignment]

PLATFORMS = ("linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64")
REQUIRED_PLATFORM = "linux-x86_64"
FORMS = ("tar.gz", "tar.xz", "zip", "file", "npm-lock")
MARKER = ".agora-entry.json"
FETCH_COMMAND = "toolchain add"
FLOATING = ("latest", "stable", "head", "main", "master", "next", "nightly")
# What the host's own settings would otherwise add to a program's behavior (a TeX tree, a Playwright browser path, a Node
# search path): none of it reaches a program agora runs (0025 FR-019).
SCRUBBED = ("TEXMFHOME", "TEXMFLOCAL", "TEXMFVAR", "TEXMFCONFIG", "TEXMFCNF", "TEXMFDIST", "TEXMFSYSVAR", "TEXMFSYSCONFIG",
            "TEXINPUTS", "TEXFONTS", "OSFONTDIR", "TEXFORMATS", "NODE_OPTIONS", "NODE_PATH", "PLAYWRIGHT_BROWSERS_PATH",
            "PLAYWRIGHT_MODULE", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "CHROMIUM", "SOURCE_DATE_EPOCH", "PARAGON")


class ToolchainError(AgoraError):
    """This host cannot supply a toolchain entry. Exit status 3 unless the file that arrived was the wrong one (1)."""

    def __init__(self, message: str, *, entries: list[str] | tuple[str, ...] = (), code: str = "toolchain",
                 exit: int = MISSING, fetchable: bool = True):
        actions = [next_command(f"fetch {' '.join(entries)}", FETCH_COMMAND, entries=list(entries))] if entries and fetchable else []
        super().__init__(code, message, exit=exit, actions=actions, detail={"entries": list(entries)} if entries else {})
        self.entries = list(entries)


# ---- the declaration -------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Archive:
    """One download of an entry: its address, its SHA-256, its form and where it unpacks."""

    url: str
    sha256: str
    form: str = "tar.gz"
    prefix: str = ""            # the archive's own top folder, dropped: only what is under it is unpacked, without it
    dest: str = ""              # a folder inside the entry's directory (a `file` form names the file here)
    size: int = 0               # bytes, for the progress line and `toolchain show`
    only: tuple[str, ...] = ()  # unpack only members under one of these prefixes (after `prefix`); empty means all


@dataclass(frozen=True)
class Entry:
    name: str
    version: str
    summary: str
    platforms: Mapping[str, tuple[Archive, ...]]
    provides: Callable[[str], Mapping[str, str]]  # platform -> {program: path inside the unpacked entry}
    needs: tuple[str, ...] = ()                    # other entries it runs with
    override_hint: str = ""                        # what a person points the override variable at
    check: Callable[["Resolved"], str] | None = None          # the functional check: returns a sentence, or raises
    env: Callable[["Resolved", Path, str], Mapping[str, str]] | None = None    # (resolved, entry dir or override, platform) -> env
    installer: Callable[["Toolchain", Path, str], None] | None = None          # runs after unpacking, in the scratch dir
    needs_system: Callable[[str], tuple[str, ...]] | None = None               # platform -> shared libraries it links

    @property
    def variable(self) -> str:
        return "AGORA_" + self.name.upper().replace("-", "_")

    def archives(self, platform: str) -> tuple[Archive, ...]:
        return tuple(self.platforms.get(platform, ()))

    def pins(self, platform: str) -> str:
        """What the cache directory must have been made from: the addresses and checksums of this platform's archives."""
        return hashlib.sha256("\n".join(f"{a.url} {a.sha256}" for a in self.archives(platform)).encode()).hexdigest()


def discover() -> dict[str, Entry]:
    """The entries, found by presence: every module of the `agora.toolchain` package that holds an `ENTRY` (0041 FR-066)."""
    import importlib
    import pkgutil

    pkg = importlib.import_module("agora.toolchain")
    out: dict[str, Entry] = {}
    for info in sorted(pkgutil.iter_modules(pkg.__path__), key=lambda i: i.name):
        mod = importlib.import_module(f"agora.toolchain.{info.name}")
        for e in ([mod.ENTRY] if hasattr(mod, "ENTRY") else []) + list(getattr(mod, "ENTRIES", ())):
            out[e.name] = e
    return out


def host_platform() -> str:
    machine = _platform.machine().lower()
    arch = {"x86_64": "x86_64", "amd64": "x86_64", "aarch64": "aarch64", "arm64": "arm64"}.get(machine, machine)
    if sys.platform.startswith("linux"):
        return f"linux-{'aarch64' if arch == 'arm64' else arch}"
    if sys.platform == "darwin":
        return f"macos-{'arm64' if arch in ('arm64', 'aarch64') else arch}"
    return f"{sys.platform}-{arch}"


def cache_root(env: Mapping[str, str] | None = None) -> Path:
    """The per-user toolchain cache: $AGORA_TOOLCHAIN_CACHE, else the platform's cache directory (XDG on Linux), as uv's
    own cache is (0025 FR-017)."""
    env = os.environ if env is None else env
    if env.get("AGORA_TOOLCHAIN_CACHE"):
        return Path(env["AGORA_TOOLCHAIN_CACHE"]).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "agora" / "toolchain"
    return Path(env.get("XDG_CACHE_HOME") or Path.home() / ".cache") / "agora" / "toolchain"


def problems(entries: Mapping[str, Entry]) -> list[str]:
    """What is wrong with the declarations (0041 FR-068, 0025 FR-016, FR-020): an incomplete entry, an address that is not
    `https`, a version that is a range or a floating tag, a missing `linux-x86_64`, a checksum that is not a SHA-256."""
    out: list[str] = []
    for key, e in entries.items():
        where = f"toolchain entry {e.name}"
        if key != e.name:
            out.append(f"{where} is registered as {key}")
        if not e.name or not all(c.isalnum() or c == "-" for c in e.name):
            out.append(f"{where}: the name is not letters, digits and hyphens")
        for f in ("version", "summary"):
            if not getattr(e, f):
                out.append(f"{where} has no {f}")
        if any(c in e.version for c in "<>=~^*, ") or e.version.lower() in FLOATING:
            out.append(f"{where}: version {e.version!r} is a range or a floating tag")
        if REQUIRED_PLATFORM not in e.platforms:
            out.append(f"{where} lacks the platform {REQUIRED_PLATFORM}")
        for platform, archives in e.platforms.items():
            if platform not in PLATFORMS:
                out.append(f"{where}: {platform!r} is not a platform ({', '.join(PLATFORMS)})")
            if not archives:
                out.append(f"{where}: {platform} lists no archive")
            if not e.provides(platform):
                out.append(f"{where}: {platform} provides no program")
            for a in archives:
                if not a.url.startswith("https://"):
                    out.append(f"{where}: {platform} address {a.url!r} is not https")
                if "/latest/" in a.url or a.url.rstrip("/").endswith("/latest") or "/nightly" in a.url:
                    out.append(f"{where}: {platform} address {a.url!r} is a floating address")
                if len(a.sha256) != 64 or any(c not in "0123456789abcdef" for c in a.sha256):
                    out.append(f"{where}: {platform} checksum for {a.url} is not a SHA-256")
                if a.form not in FORMS:
                    out.append(f"{where}: {platform} form {a.form!r} is not one of {', '.join(FORMS)}")
        if e.check is None:
            out.append(f"{where} has no functional check")
        for n in e.needs:
            if n not in entries:
                out.append(f"{where} needs {n}, which is not an entry")
    return out


# ---- resolving -------------------------------------------------------------------------------------------------

@dataclass
class Resolved:
    """Where the entries a command named are, on this host, and how to start their programs."""

    toolchain: "Toolchain"
    platform: str
    dirs: dict[str, Path] = field(default_factory=dict)
    overridden: dict[str, Path] = field(default_factory=dict)

    def is_overridden(self, name: str) -> bool:
        return name in self.overridden

    def has_entry(self, name: str) -> bool:
        return name in self.dirs or name in self.overridden

    def entry_path(self, name: str) -> Path:
        if name in self.overridden:
            return self.overridden[name]
        if name not in self.dirs:
            raise ToolchainError(f"toolchain entry {name} is not obtained; `agora {FETCH_COMMAND} {name}` fetches it", entries=[name])
        return self.dirs[name]

    def path_of(self, program: str) -> Path:
        """The program's executable, in the cache or (for an overridden entry) where the person's variable points."""
        owner = self.toolchain.owner(program)
        if owner is None or not self.has_entry(owner):
            raise ToolchainError(f"{program} is not available: its entry {owner or '(none)'} is not obtained; "
                                 f"`agora {FETCH_COMMAND} {owner or ''}` fetches it", entries=[owner] if owner else [])
        entry = self.toolchain.entries[owner]
        if owner in self.overridden:
            given = self.overridden[owner]
            return given / Path(entry.provides(self.platform)[program]).name if given.is_dir() else given
        return self.dirs[owner] / entry.provides(self.platform)[program]

    def env(self, extra: Mapping[str, str] | None = None) -> dict[str, str]:
        """The host's environment without what would change a program's output, plus each obtained entry's own variables
        and its program directory first on PATH."""
        env = self.toolchain.clean_env()
        paths: list[str] = []
        for name, path in [*self.dirs.items(), *self.overridden.items()]:
            entry = self.toolchain.entries[name]
            if entry.env:
                for key, value in entry.env(self, path, self.platform).items():
                    if key == "PATH":
                        paths.append(value)
                    else:
                        env[key] = value
        if paths:
            env["PATH"] = os.pathsep.join([*paths, env.get("PATH", "")])
        env.update(extra or {})
        return env


@dataclass(frozen=True)
class Lacking:
    entry: Entry
    platform: str
    why: str  # "not in the cache" or "no build"

    def line(self) -> str:
        if self.why == "no build":
            return (f"{self.entry.name} {self.entry.version} has no build for {self.platform}; set {self.entry.variable} to "
                    f"{self.entry.override_hint or 'a program of your own'} to use one you have")
        return f"{self.entry.name} {self.entry.version} ({self.platform}) is not in the cache"


class Toolchain:
    """The entries, a cache, an environment and a platform. Everything a command does with the lock goes through one."""

    def __init__(self, entries: Mapping[str, Entry] | None = None, *, cache: Path | None = None,
                 env: Mapping[str, str] | None = None, platform: str | None = None, offline: bool | None = None,
                 announce: Callable[[str], None] | None = None):
        self.entries: dict[str, Entry] = dict(discover() if entries is None else entries)
        self.env: Mapping[str, str] = os.environ if env is None else env
        self.cache = cache if cache is not None else cache_root(self.env)
        self.platform = platform or host_platform()
        self.offline = (self.env.get("AGORA_OFFLINE", "") not in ("", "0")) if offline is None else offline
        self.announce = announce or (lambda line: print(line, file=sys.stderr, flush=True))

    # -- naming
    def get(self, name: str) -> Entry:
        e = self.entries.get(name)
        if e is None:
            raise ToolchainError(f"there is no toolchain entry {name!r}; `agora toolchain list` names them", code="invalid-argument",
                                 exit=2, fetchable=False)
        return e

    def owner(self, program: str) -> str | None:
        for e in self.entries.values():
            for platform in PLATFORMS:
                if program in e.provides(platform):
                    return e.name
        return None

    def entry_dir(self, entry: Entry, platform: str | None = None) -> Path:
        return self.cache / f"{entry.name}-{entry.version}-{platform or self.platform}"

    def override_path(self, entry: Entry) -> Path | None:
        value = self.env.get(entry.variable, "")
        return Path(value).expanduser() if value else None

    def overrides(self) -> list[tuple[Entry, Path]]:
        """Every entry the person has replaced with a program of their own (0025 FR-019)."""
        return [(e, p) for e in self.entries.values() for p in [self.override_path(e)] if p is not None]

    def overridden_in(self, names: tuple[str, ...] | list[str]) -> list[tuple[Entry, Path]]:
        """The overrides among the named entries and what they need."""
        wanted = set(self.expand(names))
        return [(e, p) for e, p in self.overrides() if e.name in wanted]

    def clean_env(self) -> dict[str, str]:
        env = dict(self.env)
        for name in SCRUBBED:
            env.pop(name, None)
        for name in [n for n in env if n.startswith("PLAYWRIGHT_")]:
            env.pop(name, None)
        env["TEXMFVAR"] = str(self.cache / "texmf-var")  # a per-user scratch for caches TeX writes, never inside an entry
        return env

    # -- state
    def marker(self, entry: Entry, platform: str | None = None) -> dict[str, Any]:
        try:
            return json.loads((self.entry_dir(entry, platform) / MARKER).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def cached(self, entry: Entry, platform: str | None = None) -> bool:
        """Whether the cache holds this entry, complete and made from the pins now declared: whatever an override says."""
        platform = platform or self.platform
        m = self.marker(entry, platform)
        return bool(entry.archives(platform)) and bool(m) and m.get("pins") == entry.pins(platform)

    def state(self, entry: Entry, platform: str | None = None) -> str:
        """`ready`, `missing` (not in the cache, or made from other pins), `override` or `no build`."""
        platform = platform or self.platform
        if self.override_path(entry) is not None:
            return "override"
        if not entry.archives(platform):
            return "no build"
        return "ready" if self.cached(entry, platform) else "missing"

    def describe(self, entry: Entry) -> str:
        s = self.state(entry)
        if s == "override":
            return f"override {self.override_path(entry)} ({entry.variable})"
        if s == "no build":
            return f"no build for {self.platform}; {entry.variable} names a program of your own"
        if s == "missing":
            return f"not in the cache ({self.entry_dir(entry)})"
        return f"ready ({self.entry_dir(entry)}, fetched {self.marker(entry).get('fetched', '?')})"

    def expand(self, names: tuple[str, ...] | list[str]) -> list[str]:
        """The entries named and every entry they need, each after what it needs."""
        order: list[str] = []

        def visit(name: str, trail: tuple[str, ...] = ()) -> None:
            if name in order:
                return
            if name in trail:
                raise ToolchainError(f"toolchain entries need each other in a loop: {' -> '.join((*trail, name))}", code="toolchain", exit=FAILED, fetchable=False)
            for needed in self.get(name).needs:
                visit(needed, (*trail, name))
            order.append(name)

        for n in names:
            visit(n)
        return order

    def lacking(self, names: tuple[str, ...] | list[str]) -> list[Lacking]:
        out = []
        for name in self.expand(names):
            e = self.get(name)
            s = self.state(e)
            if s in ("missing", "no build"):
                out.append(Lacking(e, self.platform, "no build" if s == "no build" else "not in the cache"))
        return out

    def resolve(self, names: tuple[str, ...] | list[str]) -> Resolved:
        """Where the named entries are, from the cache only: nothing is downloaded. One that is not there is left out."""
        out = Resolved(self, self.platform)
        for name in self.expand(names):
            e = self.get(name)
            given = self.override_path(e)
            if given is not None:
                out.overridden[name] = given
            elif self.state(e) == "ready":
                out.dirs[name] = self.entry_dir(e)
        return out

    def ensure(self, names: tuple[str, ...] | list[str]) -> Resolved:
        """Obtain every entry a command names before it runs: fetch what the cache lacks unless offline (0025 FR-017, FR-018).
        Raises a ToolchainError (exit 3) naming what could not be had, its version, the platform and the fix."""
        lacking = self.lacking(names)
        if lacking:
            unbuilt = [m for m in lacking if m.why == "no build"]
            if unbuilt:
                raise ToolchainError("; ".join(m.line() for m in unbuilt), entries=[m.entry.name for m in unbuilt], fetchable=False)
            if self.offline:
                listed = "; ".join(m.line() for m in lacking)
                raise ToolchainError(f"offline, and the toolchain cache lacks: {listed}. Run `agora {FETCH_COMMAND} "
                                     f"{' '.join(m.entry.name for m in lacking)}` while online; the cache keeps what it fetches",
                                     entries=[m.entry.name for m in lacking], code="offline")
            for m in lacking:
                self.fetch(m.entry)
        return self.resolve(names)

    def use(self, names: tuple[str, ...] | list[str]) -> Resolved:
        """What a command that runs the named entries does first: `ensure` them, then find, before anything starts, which
        shared libraries a browser links that this host lacks, and fail naming each and `agora system add` (0025 FR-021)."""
        from . import system

        resolved = self.ensure(names)
        gone = self.libraries_missing(names, system.loads)
        if gone:
            libs = sorted({lib for v in gone.values() for lib in v})
            err = ToolchainError(f"{', '.join(gone)} needs system libraries this host lacks ({', '.join(libs)}); run "
                                 "`agora system add` once to install them", code="system-libraries", fetchable=False)
            err.actions = [next_command("install the system libraries", "system add")]
            err.detail = {"entries": list(gone), "libraries": libs}
            raise err
        return resolved

    def libraries_missing(self, names: tuple[str, ...] | list[str], loads: Callable[[str], bool]) -> dict[str, list[str]]:
        """For each named entry (overridden ones too) that links system libraries on this platform: those that do not load."""
        out: dict[str, list[str]] = {}
        for name in self.expand(names):
            e = self.get(name)
            libs = e.needs_system(self.platform) if e.needs_system else ()
            gone = [lib for lib in libs if not loads(lib)]
            if gone:
                out[name] = gone
        return out

    # -- fetching
    @contextlib.contextmanager
    def _locked(self, name: str):
        self.cache.mkdir(parents=True, exist_ok=True)
        handle = open(self.cache / f".lock-{name}", "a+")
        try:
            if fcntl:
                fcntl.flock(handle, fcntl.LOCK_EX)
            yield
        finally:
            if fcntl:
                fcntl.flock(handle, fcntl.LOCK_UN)
            handle.close()

    def fetch(self, entry: Entry) -> Path:
        """Download, verify, unpack and install one entry into the cache. The directory is visible only when complete."""
        platform = self.platform
        archives = entry.archives(platform)
        if not archives:
            raise ToolchainError(Lacking(entry, platform, "no build").line(), entries=[entry.name], fetchable=False)
        final = self.entry_dir(entry)
        with self._locked(entry.name):
            if self.cached(entry):
                return final
            self.cache.mkdir(parents=True, exist_ok=True)
            scratch = Path(tempfile.mkdtemp(prefix=f".tmp-{entry.name}-", dir=self.cache))
            started = time.monotonic()
            total = 0
            try:
                size = sum(a.size for a in archives)
                self.announce(f"fetching {entry.name} {entry.version} ({platform}, {size / 1e6:.1f} MB in {len(archives)} "
                              f"file{'s' if len(archives) != 1 else ''}) from {archives[0].url.split('/')[2]}")
                for a in archives:
                    total += self._fetch_one(entry, a, scratch)
                if entry.installer:
                    entry.installer(self, scratch, platform)
                (scratch / MARKER).write_text(json.dumps({
                    "name": entry.name, "version": entry.version, "platform": platform, "pins": entry.pins(platform),
                    "sha256": [a.sha256 for a in archives], "bytes": total, "seconds": round(time.monotonic() - started, 1),
                    "fetched": time.strftime("%Y-%m-%d", time.gmtime())}, indent=1), encoding="utf-8")
                _make_tree_writable(scratch)
                if final.exists():  # what an earlier pin left: replaced
                    shutil.rmtree(final, ignore_errors=True)
                try:
                    os.rename(scratch, final)
                except OSError:
                    if not self.cached(entry):
                        raise
                    shutil.rmtree(scratch, ignore_errors=True)  # another run finished first
                self.announce(f"fetched {entry.name} {entry.version} in {time.monotonic() - started:.1f}s")
            except BaseException:
                shutil.rmtree(scratch, ignore_errors=True)
                raise
        return final

    def _fetch_one(self, entry: Entry, a: Archive, scratch: Path) -> int:
        part = self.cache / f".download-{entry.name}-{a.sha256[:12]}.part"
        if a.form == "npm-lock":  # the committed package-lock.json is the pin; `npm ci` checks each package's integrity
            return 0
        request = urllib.request.Request(a.url, headers={"User-Agent": "agora-toolchain"})
        last: Exception | None = None
        digest, received = hashlib.sha256(), 0
        for attempt in range(3):
            digest, received = hashlib.sha256(), 0
            try:
                with urllib.request.urlopen(request, timeout=60) as response, open(part, "wb") as out:
                    for block in iter(lambda: response.read(1 << 20), b""):
                        out.write(block)
                        digest.update(block)
                        received += len(block)
                last = None
                break
            except (urllib.error.URLError, OSError, TimeoutError) as e:
                last = e
                time.sleep(1 + attempt)
        if last is not None:
            part.unlink(missing_ok=True)
            raise ToolchainError(f"could not download {entry.name} {entry.version} from {a.url}: {last}. Check the connection, "
                                 f"then run `agora {FETCH_COMMAND} {entry.name}`", entries=[entry.name])
        if digest.hexdigest() != a.sha256:
            part.unlink(missing_ok=True)
            raise ToolchainError(f"{entry.name} {entry.version}: the file at {a.url} does not match its pinned checksum (expected "
                                 f"{a.sha256}, got {digest.hexdigest()}); it was deleted and nothing was unpacked",
                                 entries=[entry.name], code="checksum", exit=FAILED, fetchable=False)
        try:
            unpack(part, a, scratch)
        finally:
            part.unlink(missing_ok=True)
        return received

    def remove(self, entry: Entry) -> bool:
        final = self.entry_dir(entry)
        if final.is_dir():
            shutil.rmtree(final)
            return True
        return False


def _make_tree_writable(path: Path) -> None:
    """Owner-writable, so a cache directory can be removed by a person with `rm -r`."""
    for dirpath, dirs, files in os.walk(path):
        for n in [*dirs, *files]:
            p = Path(dirpath) / n
            if not p.is_symlink():
                with contextlib.suppress(OSError):
                    p.chmod(p.stat().st_mode | stat.S_IWUSR)


# ---- unpacking -------------------------------------------------------------------------------------------------

def _inside(base: Path, target: Path) -> bool:
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _relative(name: str, a: Archive) -> str | None:
    """A member's path under the archive's prefix, or None when it is outside it, is the prefix itself or is not wanted."""
    while name.startswith("./"):
        name = name[2:]
    if a.prefix:
        head = a.prefix.rstrip("/") + "/"
        if not name.startswith(head):
            return None
        name = name[len(head):]
    name = name.rstrip("/")
    if not name:
        return None
    if a.only and not any(name == o.rstrip("/") or name.startswith(o.rstrip("/") + "/") for o in a.only):
        return None
    return name


def unpack(archive_file: Path, a: Archive, scratch: Path) -> None:
    """Unpack a verified archive under scratch/<dest>, refusing any path that would leave it."""
    base = scratch / a.dest if a.dest else scratch
    if a.form == "file":  # one file, not an archive: `dest` is the file's path inside the entry
        base.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(archive_file, base)
        return
    base.mkdir(parents=True, exist_ok=True)
    if a.form == "zip":
        with zipfile.ZipFile(archive_file) as z:
            for info in z.infolist():
                rel = _relative(info.filename, a)
                if rel is None:
                    continue
                target = base / rel
                if not _inside(base, target):
                    raise ToolchainError(f"{a.url}: member {info.filename!r} would unpack outside its directory", code="unpack", exit=FAILED, fetchable=False)
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                mode = info.external_attr >> 16
                if stat.S_ISLNK(mode):
                    target.symlink_to(z.read(info).decode("utf-8"))
                    continue
                with z.open(info) as src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)
                os.chmod(target, (mode & 0o777) | 0o600 if mode else 0o644)
        return
    with tarfile.open(archive_file, "r:*") as t:
        for member in t:
            rel = _relative(member.name, a)
            if rel is None:
                continue
            target = base / rel
            if not _inside(base, target.parent):
                raise ToolchainError(f"{a.url}: member {member.name!r} would unpack outside its directory", code="unpack", exit=FAILED, fetchable=False)
            if member.issym() or member.islnk():
                link = member.linkname
                resolved = (target.parent / link) if member.issym() else (base / (_relative(link, a) or link))
                if not _inside(base, resolved):
                    continue  # a link that leaves the entry is dropped, never followed
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            if member.issym():
                target.symlink_to(member.linkname)
            elif member.islnk():
                source = base / (_relative(member.linkname, a) or member.linkname)
                if source.exists():
                    os.link(source, target)
            elif member.isfile():
                src = t.extractfile(member)
                assert src is not None
                with open(target, "wb") as out:
                    shutil.copyfileobj(src, out)
                os.chmod(target, (member.mode & 0o777) | 0o600)
            # devices, fifos and the like are never unpacked


def run_program(argv: list[str], env: Mapping[str, str], *, cwd: Path | None = None, timeout: int = 300) -> tuple[int, str]:
    """Run a program for a functional check: its exit status and its output (standard output and error together)."""
    import subprocess

    try:
        p = subprocess.run(argv, env=dict(env), cwd=cwd, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, f"{type(e).__name__}: {e}"
    return p.returncode, (p.stdout + p.stderr).decode("utf-8", "replace")
