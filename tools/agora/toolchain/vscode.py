"""VS Code, the pinned stable build that IF Console's extension tests run in (0043-if-console FR-031; 0042-agora FR-030).

The address and the SHA-256 are the ones the vendor's update service publishes for this version, which it serves by version, not
as `latest`. The Linux build is a tarball and the macOS build a zip. VS Code also links shared libraries a fetch cannot supply;
`system add` installs them once (0025-tooling-environment FR-021), and a display server is needed to start it (see `xvfb`).
"""
from __future__ import annotations

from agora.core import system
from agora.core.toolchain import Archive, Entry, Resolved, ToolchainError, run_program

NAME = "vscode"
VERSION = "1.140.0"
COMMIT = "07f806f999227108933c2e30515b26eecc1fda74"
BASE = f"https://vscode.download.prss.microsoft.com/dbazure/download/stable/{COMMIT}"
CODE = {"linux-x86_64": "code", "linux-aarch64": "code", "macos-arm64": "Visual Studio Code.app/Contents/MacOS/Electron",
        "macos-x86_64": "Visual Studio Code.app/Contents/MacOS/Electron"}
CLI = {"linux-x86_64": "bin/code", "linux-aarch64": "bin/code", "macos-arm64": "Visual Studio Code.app/Contents/Resources/app/bin/code",
       "macos-x86_64": "Visual Studio Code.app/Contents/Resources/app/bin/code"}


def provides(platform: str) -> dict[str, str]:
    return {"code": CODE[platform], "code-cli": CLI[platform]}


def check(r: Resolved) -> str:
    gone = system.missing(system.vscode_libraries(r.platform), system.family())
    if gone:
        raise ToolchainError(f"VS Code's system libraries are missing ({', '.join(sorted(lib for lib, _ in gone))}); "
                             "run `agora system add`", entries=[NAME], fetchable=False)
    code, text = run_program([str(r.path_of("code-cli")), "--version", "--user-data-dir", str(r.toolchain.cache / "vscode-check")], r.env(), timeout=120)
    if code != 0 or VERSION not in text:
        raise ToolchainError(f"VS Code did not report version {VERSION}: {text[-400:]}", entries=[NAME], fetchable=False)
    return f"VS Code {VERSION} ({COMMIT[:10]}) starts"


def _tar(name: str, sha256: str, size: int, prefix: str) -> tuple[Archive, ...]:
    return (Archive(f"{BASE}/{name}", sha256, "tar.gz", prefix=prefix, size=size),)


def _zip(name: str, sha256: str, size: int) -> tuple[Archive, ...]:
    return (Archive(f"{BASE}/{name}", sha256, "zip", size=size),)


ENTRY = Entry(
    NAME, VERSION, f"VS Code {VERSION}, the stable build the IF Console extension's tests run in",
    {"linux-x86_64": _tar("code-stable-x64-1790759436.tar.gz", "d32031e9e213d59532af3cf32fcb8b357a1cdd10417967b4f5b5ba30436dc0dc",
                          348920118, "VSCode-linux-x64"),
     "linux-aarch64": _tar("code-stable-arm64-1790759311.tar.gz", "9609a7655c4bc2a101b343ff22aa91f6678b46d9565b914c0608bd7f2e577fa6",
                           338341237, "VSCode-linux-arm64"),
     "macos-arm64": _zip("VSCode-darwin-arm64.zip", "86a64f1cc9f4e0b5fc44969530994742f4bd61e7b98d9637238c5e24b26593b0", 317901801),
     "macos-x86_64": _zip("VSCode-darwin.zip", "5f56ee60956865d79711dd8a1ceef7d94b72ba2c5539a1e46642db07a3d256d2", 342873534)},
    provides, override_hint="a VS Code program", check=check, needs_system=system.vscode_libraries)
