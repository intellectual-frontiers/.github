"""Local archives and entries for the toolchain tests: no network (0041-command-line FR-066 to FR-069)."""
from __future__ import annotations

import hashlib
import io
import tarfile
import zipfile
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Resolved, Toolchain

PLATFORM = "linux-x86_64"


def make_tar(path: Path, files: dict[str, bytes | tuple[str, str]], mode: str = "w:gz", prefix: str = "") -> str:
    """A tar archive of files (a (kind, target) value is a symbolic link), returning its SHA-256."""
    with tarfile.open(path, mode) as t:
        for name, content in files.items():
            info = tarfile.TarInfo(prefix + name)
            if isinstance(content, tuple):
                info.type = tarfile.SYMTYPE
                info.linkname = content[1]
                t.addfile(info)
                continue
            info.size = len(content)
            info.mode = 0o755 if name.startswith("bin/") else 0o644
            t.addfile(info, io.BytesIO(content))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_zip(path: Path, files: dict[str, bytes], prefix: str = "") -> str:
    with zipfile.ZipFile(path, "w") as z:
        for name, content in files.items():
            info = zipfile.ZipInfo(prefix + name)
            info.external_attr = (0o755 if name.startswith("bin/") else 0o644) << 16
            z.writestr(info, content)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entry(name: str, archive: Path, sha256: str, *, form: str = "tar.gz", version: str = "1.0", prefix: str = "",
          provides: dict[str, str] | None = None, needs: tuple[str, ...] = (), check=None, env=None, installer=None,
          needs_system=None, size: int = 0, platform: str = PLATFORM) -> Entry:
    """An entry whose one archive is a local file (a `file://` address, which the fetch reads as it does an https one)."""
    prog = provides if provides is not None else {name: f"bin/{name}"}
    return Entry(name, version, f"{name}, for a test", {platform: (Archive(archive.resolve().as_uri(), sha256, form, prefix=prefix,
                                                                           size=size),)},
                 lambda _p: prog, needs=needs, check=check or (lambda r: "ok"), env=env, installer=installer,
                 needs_system=needs_system)


def toolchain(entries: dict[str, Entry], cache: Path, *, env: dict[str, str] | None = None, offline: bool = False,
              platform: str = PLATFORM, lines: list[str] | None = None) -> Toolchain:
    return Toolchain(entries, cache=cache, env=env if env is not None else {}, platform=platform, offline=offline,
                     announce=(lines.append if lines is not None else (lambda _l: None)))
