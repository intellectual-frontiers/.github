"""The one prerequisite beyond python3 and uv: the shared libraries a Linux Chromium links against (0025-tooling-environment
FR-021; 0041-command-line FR-069). Standard library only.

Installing them needs administrator rights, so the `system` noun's `add` is the only command that runs `sudo`. This module
reads (which libraries load here) and plans (the exact commands `add` prints and, with the person's yes, runs). The package
list is pinned here for each distribution family: `apt` on Debian and Ubuntu; on any other family there is no list, and
`add` names the libraries and stops.
"""
from __future__ import annotations

import ctypes
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping

# soname -> the apt package that holds it (Playwright's own list of what Chromium needs on Debian and Ubuntu).
APT_LIBRARIES: dict[str, str] = {
    "libnss3.so": "libnss3", "libnssutil3.so": "libnss3", "libnspr4.so": "libnspr4",
    "libatk-1.0.so.0": "libatk1.0-0", "libatk-bridge-2.0.so.0": "libatk-bridge2.0-0", "libatspi.so.0": "libatspi2.0-0",
    "libcups.so.2": "libcups2", "libdrm.so.2": "libdrm2", "libdbus-1.so.3": "libdbus-1-3",
    "libxkbcommon.so.0": "libxkbcommon0", "libXcomposite.so.1": "libxcomposite1", "libXdamage.so.1": "libxdamage1",
    "libXfixes.so.3": "libxfixes3", "libXrandr.so.2": "libxrandr2", "libgbm.so.1": "libgbm1",
    "libpango-1.0.so.0": "libpango-1.0-0", "libcairo.so.2": "libcairo2", "libasound.so.2": "libasound2",
    "libX11.so.6": "libx11-6", "libxcb.so.1": "libxcb1", "libXext.so.6": "libxext6", "libglib-2.0.so.0": "libglib2.0-0",
}
# What VS Code links beyond what Chromium does (it is an Electron build), found by reading the binaries' dynamic sections, and the
# display server its extension tests start it under. A name without ".so" is a program, found on PATH (0043-if-console FR-032).
APT_VSCODE_EXTRA: dict[str, str] = {
    "libgtk-3.so.0": "libgtk-3-0", "libsmime3.so": "libnss3", "libexpat.so.1": "libexpat1", "libudev.so.1": "libudev1",
    "libxkbfile.so.1": "libxkbfile1", "libgobject-2.0.so.0": "libglib2.0-0", "libgio-2.0.so.0": "libglib2.0-0",
    "Xvfb": "xvfb",
}
# Ubuntu 24.04 and Debian 13 renamed these for the 64-bit time_t transition.
APT_T64_RENAMED = {"libatk1.0-0": "libatk1.0-0t64", "libatk-bridge2.0-0": "libatk-bridge2.0-0t64",
                   "libatspi2.0-0": "libatspi2.0-0t64", "libcups2": "libcups2t64", "libasound2": "libasound2t64",
                   "libglib2.0-0": "libglib2.0-0t64", "libgtk-3-0": "libgtk-3-0t64"}


@dataclass(frozen=True)
class Family:
    name: str                          # "apt", or the os-release id of a family with no list
    label: str                         # shown to the person
    packages: Mapping[str, str]        # soname -> package; empty where no list is pinned
    refresh: tuple[str, ...] = ()      # the index refresh, e.g. ("apt-get", "update")
    install: tuple[str, ...] = ()      # the install, before the package names


def os_release(paths: tuple[str, ...] = ("/etc/os-release", "/usr/lib/os-release")) -> dict[str, str]:
    out: dict[str, str] = {}
    for path in paths:
        try:
            for line in Path(path).read_text(encoding="utf-8").splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    out[k] = v.strip().strip('"')
            break
        except OSError:
            continue
    return out


def _version(text: str) -> float:
    try:
        return float(text)
    except ValueError:
        return 0.0


def family(release: Mapping[str, str] | None = None) -> Family:
    """The pinned package list for this host's distribution family, or a Family with none."""
    r = os_release() if release is None else release
    ids = {r.get("ID", ""), *r.get("ID_LIKE", "").split()}
    if "debian" in ids or "ubuntu" in ids:
        v = _version(r.get("VERSION_ID", ""))
        t64 = (r.get("ID") == "ubuntu" and v >= 24.04) or (r.get("ID") == "debian" and v >= 13)
        packages = {lib: (APT_T64_RENAMED.get(pkg, pkg) if t64 else pkg) for lib, pkg in {**APT_LIBRARIES, **APT_VSCODE_EXTRA}.items()}
        return Family("apt", f"{r.get('PRETTY_NAME') or r.get('ID')} (apt{', t64 names' if t64 else ''})", packages,
                      ("apt-get", "update"), ("apt-get", "install", "-y", "--no-install-recommends"))
    return Family(r.get("ID") or "unknown", r.get("PRETTY_NAME") or r.get("ID") or "this distribution", {})


def chromium_libraries(platform: str) -> tuple[str, ...]:
    """The shared libraries a Chromium build links against and a fetch cannot supply; none off Linux."""
    return tuple(APT_LIBRARIES) if platform.startswith("linux") else ()


def vscode_libraries(platform: str) -> tuple[str, ...]:
    """What VS Code links and the display server it starts under: Chromium's libraries, VS Code's own and Xvfb; none off Linux."""
    return (*chromium_libraries(platform), *APT_VSCODE_EXTRA) if platform.startswith("linux") else ()


def needed(entries: Mapping[str, object], platform: str) -> tuple[str, ...]:
    """Every shared library any toolchain entry links on this platform, once each."""
    libs: list[str] = []
    for e in entries.values():
        fn = getattr(e, "needs_system", None)
        if fn:
            libs += [lib for lib in fn(platform) if lib not in libs]
    return tuple(libs)


def loads(soname: str) -> bool:
    if ".so" not in soname:  # a program, such as the display server
        import shutil
        return shutil.which(soname) is not None
    try:
        ctypes.CDLL(soname)
        return True
    except OSError:
        return False


def missing(libraries: tuple[str, ...], fam: Family, probe: Callable[[str], bool] | None = None) -> list[tuple[str, str]]:
    """(soname, package) for each library that does not load here; the package is '' where the family has no list."""
    probe = probe or loads
    return [(lib, fam.packages.get(lib, "")) for lib in libraries if not probe(lib)]


def commands(gone: list[tuple[str, str]], fam: Family, *, root: bool | None = None) -> list[list[str]]:
    """The exact commands `system add` runs, in order: none when nothing is missing or no list is pinned. `sudo` leads each
    unless the process already is root."""
    packages = sorted({pkg for _, pkg in gone if pkg})
    if not packages or not fam.install:
        return []
    prefix = [] if (os.geteuid() == 0 if root is None else root) else ["sudo"]
    return [[*prefix, *fam.refresh], [*prefix, *fam.install, *packages]]


def uses_sudo(cmds: list[list[str]]) -> bool:
    return bool(cmds) and cmds[0][0] == "sudo"
