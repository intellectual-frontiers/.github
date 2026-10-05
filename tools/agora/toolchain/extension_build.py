"""The IF Console extension's build and test tools: TypeScript, esbuild, ESLint, `@types/vscode`, VS Code Elements, the codicon package,
`@vscode/vsce`, which packs the .vsix, and `@vscode/test-electron`, which starts a real VS Code to run the extension's tests
(0043-if-console FR-027, FR-032, FR-035; 0042-agora FR-032).

`tools/if-console/package.json` and `package-lock.json` are the pin: the extension has no runtime dependency, so what the lock holds
is build and test tools only, every package one exact version with its integrity hash. The tree is installed with `npm ci` into the
toolchain cache by the node the `nodejs-wheel-binaries` package supplies, never into the repository and never by a host node.
"""
from __future__ import annotations

import json
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Toolchain, ToolchainError, run_program
from agora.lib import node
from agora.toolchain import npm_packages

NAME = "extension-build"
EXT_DIR = Path(__file__).resolve().parents[2] / "if-console"
HOME = Path(__file__).resolve().parents[3]
REGISTRY = npm_packages.REGISTRY
# Every package of the extension's lock that the package.json names, each at one exact version. `@types/vscode` is the engine's own version
# (package.json's engines.vscode), so that the code cannot use an API the oldest VS Code it supports lacks (0043 FR-030, FR-035).
PACKAGES = {
    "@eslint/js": "10.0.1",
    "@types/node": "22.20.5",
    "@types/vscode": "1.101.0",
    "@vscode-elements/elements": "2.5.1",
    "@vscode/codicons": "0.0.45",
    "@vscode/test-electron": "3.1.0",
    "@vscode/vsce": "4.0.0",
    "esbuild": "0.28.2",
    "eslint": "10.12.0",
    "globals": "17.13.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.71.0",
}
VERSION = f"typescript-{PACKAGES['typescript']}+esbuild-{PACKAGES['esbuild']}+eslint-{PACKAGES['eslint']}+vsce-{PACKAGES['@vscode/vsce']}"
CODICONS_MAPPING = "node_modules/@vscode/codicons/src/template/mapping.json"


def lock_problems() -> list[str]:
    """package.json names exactly these packages at these versions, as development dependencies and no other kind; package-lock.json pins
    every package with its version and integrity hash; `@types/vscode` is the engine's version (0025 FR-015; 0043 FR-027, FR-035)."""
    try:
        pkg = json.loads((EXT_DIR / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return [f"tools/if-console/package.json cannot be read: {e}"]
    out: list[str] = []
    if pkg.get("dependencies"):
        out.append(f"tools/if-console/package.json has runtime dependencies {sorted(pkg['dependencies'])}; the extension ships none (0043 FR-027)")
    if pkg.get("devDependencies") != PACKAGES:
        out.append(f"tools/if-console/package.json devDependencies are {pkg.get('devDependencies')}; the entry declares {PACKAGES}")
    engine = str(pkg.get("engines", {}).get("vscode", "")).lstrip("^")
    if PACKAGES["@types/vscode"] != engine:
        out.append(f"@types/vscode is {PACKAGES['@types/vscode']} and the engine is {engine}; the types are the engine's own (0043 FR-035)")
    out += npm_packages.lock_hash_problems(EXT_DIR, "tools/if-console")
    try:
        locked = json.loads((EXT_DIR / "package-lock.json").read_text(encoding="utf-8")).get("packages", {})
    except (OSError, ValueError):
        return out
    for name, version in PACKAGES.items():
        got = locked.get(f"node_modules/{name}", {}).get("version")
        if got != version:
            out.append(f"tools/if-console/package-lock.json locks {name} at {got}, not {version}")
    return out


def provides(platform: str) -> dict[str, str]:
    return {"extension-modules": "node_modules", "tsc": "node_modules/typescript/bin/tsc", "eslint": "node_modules/eslint/bin/eslint.js",
            "vsce": "node_modules/@vscode/vsce/vsce", "vscode-test": "node_modules/@vscode/test-electron",
            "codicons-mapping": CODICONS_MAPPING}


def install(tc: Toolchain, scratch: Path, platform: str) -> None:
    npm_packages.install(tc, scratch, platform, EXT_DIR)


def check(r) -> str:
    exe = node.locate(HOME, dict(r.toolchain.env), offline=True)
    base = r.entry_path(NAME)
    code, out = run_program([exe, str(r.path_of("tsc")), "--version"], r.env(), cwd=base)
    if code != 0 or PACKAGES["typescript"] not in out:
        raise ToolchainError(f"tsc did not report version {PACKAGES['typescript']}: {out[-300:]}", entries=[NAME], fetchable=False)
    code, out = run_program([exe, str(r.path_of("eslint")), "--version"], r.env(), cwd=base)
    if code != 0 or PACKAGES["eslint"] not in out:
        raise ToolchainError(f"eslint did not report version {PACKAGES['eslint']}: {out[-300:]}", entries=[NAME], fetchable=False)
    code, out = run_program([exe, str(r.path_of("vsce")), "--version"], r.env(), cwd=base)
    if code != 0 or PACKAGES["@vscode/vsce"] not in out:
        raise ToolchainError(f"vsce did not report version {PACKAGES['@vscode/vsce']}: {out[-300:]}", entries=[NAME], fetchable=False)
    code, out = run_program([exe, "--input-type=module", "-e", "const e = await import('esbuild'); console.log(e.version)"], r.env(), cwd=base)
    if code != 0 or PACKAGES["esbuild"] not in out:
        raise ToolchainError(f"esbuild did not report version {PACKAGES['esbuild']}: {out[-300:]}", entries=[NAME], fetchable=False)
    for program in ("vscode-test", "codicons-mapping"):
        if not r.path_of(program).exists():
            raise ToolchainError(f"{program} is not in the installed tree", entries=[NAME], fetchable=False)
    return (f"tsc {PACKAGES['typescript']}, esbuild {PACKAGES['esbuild']}, eslint {PACKAGES['eslint']} and vsce {PACKAGES['@vscode/vsce']} run on the package's node, "
            f"and @vscode/test-electron {PACKAGES['@vscode/test-electron']} is installed")


_ALL = {p: (Archive(REGISTRY, npm_packages.lock_sha256(EXT_DIR), "npm-lock", size=0),)
        for p in ("linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64")}

ENTRY = Entry(NAME, VERSION, "TypeScript, esbuild and ESLint, which check and bundle the IF Console extension, vsce, which packs it, and @vscode/test-electron, which tests it in a real VS Code: "
              "installed with npm ci from tools/if-console's lock",
              _ALL, provides, override_hint="a directory holding node_modules with the extension's build packages", check=check, installer=install)
