"""Chromium, Playwright's pinned build (0042-agora FR-030): the browser the design systems' harnesses drive.

The address is the one Playwright itself downloads its Chromium from, for the revision that the pinned Playwright (the npm
lock's `playwright`) names in its `browsers.json`. A Linux Chromium also links shared libraries a fetch cannot supply: the
`system` noun's `ensure` installs them once (0025-tooling-environment FR-021).
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from agora.core import system
from agora.core.toolchain import Archive, Entry, Resolved, ToolchainError, run_program

NAME = "chromium"
PLAYWRIGHT_VERSION = "1.50.0"   # must equal the npm lock's playwright (checked by `check toolchain`)
REVISION = "1155"                # that Playwright's browsers.json revision for chromium (checked by `check toolchain`)
CDN = f"https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/{REVISION}"
CHROME = {"linux-x86_64": "chrome", "linux-aarch64": "chrome", "macos-arm64": "Chromium.app/Contents/MacOS/Chromium",
          "macos-x86_64": "Chromium.app/Contents/MacOS/Chromium"}


def provides(platform: str) -> dict[str, str]:
    return {"chrome": CHROME[platform]}


def env(r: Resolved, path: Path, platform: str) -> dict[str, str]:
    """CHROMIUM, which the harnesses read to find the browser. An override names the program itself."""
    return {"CHROMIUM": str(path if r.is_overridden(NAME) and not path.is_dir() else path / CHROME[platform])}


def check(r: Resolved) -> str:
    gone = system.missing(system.chromium_libraries(r.platform), system.family())
    if gone:
        raise ToolchainError(f"Chromium's system libraries are missing ({', '.join(sorted(lib for lib, _ in gone))}); "
                             "run `agora system ensure`", entries=[NAME], fetchable=False)
    with tempfile.TemporaryDirectory(prefix="agora-check-") as tmp:
        page = Path(tmp) / "page.html"
        page.write_text("<!doctype html><title>check</title><h1>loaded</h1>", encoding="utf-8")
        code, out = run_program([str(r.path_of("chrome")), "--headless", "--disable-gpu", "--no-sandbox", "--dump-dom",
                                 f"file://{page}"], r.env(), timeout=120)
    if code != 0 or "<h1>loaded</h1>" not in out:
        raise ToolchainError(f"Chromium did not load a page: {out[-400:]}", entries=[NAME], fetchable=False)
    return "Chromium loaded a page"


def _zip(platform_file: str, sha256: str, size: int, prefix: str) -> tuple[Archive, ...]:
    return (Archive(f"{CDN}/{platform_file}", sha256, "zip", prefix=prefix, size=size),)


ENTRY = Entry(
    NAME, PLAYWRIGHT_VERSION, f"Chromium 133, Playwright {PLAYWRIGHT_VERSION}'s pinned build (revision {REVISION})",
    {"linux-x86_64": _zip("chromium-linux.zip", "cadb84ee9dd3b3a5ce435175c2e39c585c90457292358534acf6e6f2f1fa248d",
                          171466478, "chrome-linux"),
     "linux-aarch64": _zip("chromium-linux-arm64.zip", "61110a15751b15e502806963f2604682a315cbf10fe55827625df879de1b574f",
                           174660801, "chrome-linux"),
     "macos-x86_64": _zip("chromium-mac.zip", "4fa2039f02033ff0f6b7911248a60bb42706689c24bd9f330d4d33853f45e1a7",
                          135494963, "chrome-mac"),
     "macos-arm64": _zip("chromium-mac-arm64.zip", "d881777164aa95a69621d2f400f54db5e6c525d99bf1d22b8f91dfb7f2b8ffac",
                         129251668, "chrome-mac")},
    provides, override_hint="a Chromium or Chrome program", check=check, env=env,
    needs_system=system.chromium_libraries)
