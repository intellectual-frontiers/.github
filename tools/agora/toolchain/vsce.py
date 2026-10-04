"""The IF Console extension's build and test tools: `@vscode/vsce`, which packs the .vsix, and `@vscode/test-electron`, which starts
a real VS Code to run the extension's tests (0043-if-console FR-027, FR-032; 0042-agora FR-032).

`tools/if-console/package.json` and `package-lock.json` are the pin: the extension has no runtime dependency, so what the lock
holds is build tools only, every package one exact version with its integrity hash. The tree is installed with `npm ci` into the
toolchain cache by the node the `nodejs-wheel-binaries` package supplies, never into the repository and never by a host node.
"""
from __future__ import annotations

import json
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Toolchain, ToolchainError, run_program
from agora.lib import node
from agora.toolchain import npm_packages

NAME = "vsce"
EXT_DIR = Path(__file__).resolve().parents[2] / "if-console"
HOME = Path(__file__).resolve().parents[3]
VSCE_VERSION = "4.0.0"
TEST_ELECTRON_VERSION = "3.1.0"
REGISTRY = npm_packages.REGISTRY


def lock_problems() -> list[str]:
    """package.json names exactly @vscode/vsce at the version declared here, as a development dependency and no other kind;
    package-lock.json pins every package with its version and integrity hash (0025 FR-015; 0043 FR-027)."""
    try:
        pkg = json.loads((EXT_DIR / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return [f"tools/if-console/package.json cannot be read: {e}"]
    out: list[str] = []
    if pkg.get("dependencies"):
        out.append(f"tools/if-console/package.json has runtime dependencies {sorted(pkg['dependencies'])}; the extension ships none (0043 FR-027)")
    want = {"@vscode/vsce": VSCE_VERSION, "@vscode/test-electron": TEST_ELECTRON_VERSION}
    if pkg.get("devDependencies") != want:
        out.append(f"tools/if-console/package.json devDependencies are {pkg.get('devDependencies')}; the entry declares {want}")
    out += npm_packages.lock_hash_problems(EXT_DIR, "tools/if-console")
    try:
        locked = json.loads((EXT_DIR / "package-lock.json").read_text(encoding="utf-8")).get("packages", {})
    except (OSError, ValueError):
        return out
    for name, version in want.items():
        if locked.get(f"node_modules/{name}", {}).get("version") != version:
            out.append(f"tools/if-console/package-lock.json locks {name} at {locked.get(f'node_modules/{name}', {}).get('version')}, not {version}")
    return out


def provides(platform: str) -> dict[str, str]:
    return {"vsce": "node_modules/@vscode/vsce/vsce", "vscode-test": "node_modules/@vscode/test-electron"}


def install(tc: Toolchain, scratch: Path, platform: str) -> None:
    npm_packages.install(tc, scratch, platform, EXT_DIR)


def check(r) -> str:
    exe = node.locate(HOME, dict(r.toolchain.env), offline=True)
    code, out = run_program([exe, str(r.path_of("vsce")), "--version"], r.env(), cwd=r.entry_path(NAME))
    if code != 0 or VSCE_VERSION not in out:
        raise ToolchainError(f"vsce did not report version {VSCE_VERSION}: {out[-300:]}", entries=[NAME], fetchable=False)
    if not (r.path_of("vscode-test") / "out" / "index.js").is_file() and not (r.path_of("vscode-test") / "package.json").is_file():
        raise ToolchainError("@vscode/test-electron is not in the installed tree", entries=[NAME], fetchable=False)
    return f"vsce {VSCE_VERSION} runs on the package's node, and @vscode/test-electron {TEST_ELECTRON_VERSION} is installed"


_ALL = {p: (Archive(REGISTRY, npm_packages.lock_sha256(EXT_DIR), "npm-lock", size=0),)
        for p in ("linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64")}

ENTRY = Entry(NAME, VSCE_VERSION, f"@vscode/vsce {VSCE_VERSION}, which packs the IF Console extension, and @vscode/test-electron {TEST_ELECTRON_VERSION}, which tests it in a real VS Code, installed with npm ci from tools/if-console's lock",
              _ALL, provides, override_hint="a directory holding node_modules with @vscode/vsce and @vscode/test-electron", check=check, installer=install)
