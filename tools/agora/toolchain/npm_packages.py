"""The npm tree: Playwright for Node and Paragon (0042-agora FR-030; 0025-tooling-environment FR-015).

`tools/agora/npm/package.json` and `package-lock.json` are the pin, the two files npm owns, every package one exact version
with its integrity hash. The tree is installed with `npm ci` into the toolchain cache, never into the repository, by the node
that the `nodejs-wheel-binaries` package supplies (lib/node.py), never by a node of the host. Its checksum here is the lock
file's, so a changed lock makes the cached tree stale.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Resolved, Toolchain, ToolchainError, run_program
from agora.lib import node

NAME = "npm-packages"
NPM_DIR = Path(__file__).resolve().parents[1] / "npm"
HOME = Path(__file__).resolve().parents[3]
PLAYWRIGHT_VERSION = "1.50.0"
PARAGON_VERSION = "23.23.0"
REGISTRY = "https://registry.npmjs.org/"


def lock_sha256(npm_dir: Path | None = None) -> str:
    lock = (npm_dir or NPM_DIR) / "package-lock.json"
    return hashlib.sha256(lock.read_bytes()).hexdigest() if lock.is_file() else "0" * 64


def lock_hash_problems(npm_dir: Path, label: str) -> list[str]:
    """Every package of an npm lock carries its version and integrity hash (0025 FR-015)."""
    try:
        packages = json.loads((npm_dir / "package-lock.json").read_text(encoding="utf-8")).get("packages", {})
    except (OSError, ValueError) as e:
        return [f"{label}/package-lock.json cannot be read: {e}"]
    return [f"{label}/package-lock.json: {name} has no version and integrity hash" for name, p in packages.items()
            if name and not p.get("link") and not (p.get("integrity") and p.get("version"))]


def lock_problems() -> list[str]:
    """package.json names exactly the two packages at the versions declared here; package-lock.json pins every package with
    its version and integrity hash (0025 FR-015, 0041 FR-068)."""
    out: list[str] = []
    pkg, lock = NPM_DIR / "package.json", NPM_DIR / "package-lock.json"
    try:
        deps = json.loads(pkg.read_text(encoding="utf-8")).get("dependencies", {})
    except (OSError, ValueError) as e:
        return [f"tools/agora/npm/package.json cannot be read: {e}"]
    want = {"playwright": PLAYWRIGHT_VERSION, "@openedx/paragon": PARAGON_VERSION}
    if deps != want:
        out.append(f"tools/agora/npm/package.json depends on {deps}; the entry declares {want}")
    try:
        packages = json.loads(lock.read_text(encoding="utf-8")).get("packages", {})
    except (OSError, ValueError) as e:
        return out + [f"tools/agora/npm/package-lock.json cannot be read: {e}"]
    for name, p in packages.items():
        if name and not p.get("link") and not (p.get("integrity") and p.get("version")):
            out.append(f"tools/agora/npm/package-lock.json: {name} has no version and integrity hash")
    for name, ver in want.items():
        if packages.get(f"node_modules/{name}", {}).get("version") != ver:
            out.append(f"tools/agora/npm/package-lock.json locks {name} at "
                       f"{packages.get(f'node_modules/{name}', {}).get('version')}, not {ver}")
    return out


def provides(platform: str) -> dict[str, str]:
    return {"playwright": "node_modules/playwright/index.js", "paragon": "node_modules/.bin/paragon"}


def env(r: Resolved, path: Path, platform: str) -> dict[str, str]:
    """PLAYWRIGHT_MODULE, the directory holding node_modules/playwright, which the harnesses read to find Playwright."""
    return {"PLAYWRIGHT_MODULE": str(path)}


def install(tc: Toolchain, scratch: Path, platform: str, npm_dir: Path | None = None) -> None:
    """`npm ci` from the committed lock, by the node a Python package supplies, into the scratch directory."""
    for name in ("package.json", "package-lock.json"):
        shutil.copyfile((npm_dir or NPM_DIR) / name, scratch / name)
    exe = node.locate(HOME, dict(tc.env), offline=tc.offline)
    argv = node.npm_argv("ci", "--ignore-scripts", "--no-audit", "--no-fund", env={**tc.env, node.OVERRIDE: exe})
    if argv is None:
        raise ToolchainError(f"npm was not found beside {exe}: the {node.PACKAGE} package holds it", fetchable=False)
    e = node.with_node({**tc.env, node.OVERRIDE: exe})
    e.update({"npm_config_update_notifier": "false", "npm_config_fund": "false", "npm_config_audit": "false",
              "npm_config_cache": str(tc.cache / "npm-cache")})
    done = subprocess.run(argv, cwd=scratch, env=e, capture_output=True, text=True)
    shutil.rmtree(tc.cache / "npm-cache", ignore_errors=True)  # npm's own download cache: the tree is what is kept
    if done.returncode != 0:
        raise ToolchainError(f"npm ci failed: {(done.stdout + done.stderr)[-600:]}", entries=[NAME])


def check(r: Resolved) -> str:
    base = r.entry_path(NAME)
    exe = node.locate(HOME, dict(r.toolchain.env), offline=True)
    code, out = run_program([exe, "-e", "console.log(require('playwright').chromium.name())"], r.env(), cwd=base)
    if code != 0 or "chromium" not in out:
        raise ToolchainError(f"Node could not load Playwright: {out[-300:]}", entries=[NAME], fetchable=False)
    paragon = r.path_of("paragon")
    if not paragon.exists():
        raise ToolchainError(f"Paragon's CLI is not at {paragon}", entries=[NAME], fetchable=False)
    return "Node loaded Playwright; Paragon's CLI is installed"


_ALL = {p: (Archive(REGISTRY, lock_sha256(), "npm-lock", size=0),) for p in ("linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64")}

ENTRY = Entry(NAME, f"{PLAYWRIGHT_VERSION}+paragon-{PARAGON_VERSION}",
              f"Playwright {PLAYWRIGHT_VERSION} for Node and Paragon {PARAGON_VERSION}, installed with npm ci from the committed lock",
              _ALL, provides, override_hint="a directory holding node_modules with playwright and @openedx/paragon", check=check,
              env=env, installer=install)
