"""The Temurin Java runtime that AsciidoctorJ runs on (0042-agora FR-030; 0041-command-line FR-066).

The version, the addresses and the checksums are the same as the private repositories' own entry of this name pins, so that
what one fetches the other can use. Adoptium publishes Linux and macOS builds for both architectures.
"""
from __future__ import annotations

from pathlib import Path

from agora.core.toolchain import Archive, Entry, Resolved, ToolchainError, run_program

NAME = "jre"
VERSION = "21.0.12.1+1"
RELEASE = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1"
PREFIX = f"jdk-{VERSION}-jre"
MAC_PREFIX = f"{PREFIX}/Contents/Home"


def _jre(platform_file: str, sha256: str, size: int, form: str = "tar.gz", prefix: str = PREFIX) -> tuple[Archive, ...]:
    return (Archive(f"{RELEASE}/{platform_file}", sha256, form, prefix=prefix, size=size),)


def provides(platform: str) -> dict[str, str]:
    return {"java": "bin/java"}


def env(_r: Resolved, path: Path, _platform: str) -> dict[str, str]:
    return {"JAVA_HOME": str(path), "PATH": str(path / "bin")}


def check(r: Resolved) -> str:
    code, text = run_program([str(r.path_of("java")), "-version"], r.env())
    if code != 0 or "Temurin" not in text:
        raise ToolchainError(f"java did not start: {text[-300:]}", entries=[NAME], fetchable=False)
    return text.splitlines()[0].strip()


ENTRY = Entry(
    NAME, VERSION, "a Temurin Java runtime",
    {"linux-x86_64": _jre("OpenJDK21U-jre_x64_linux_hotspot_21.0.12.1_1.tar.gz",
                          "2413149700df0f7d440500a84a8f764c535f21e5a5e87d38328b64eec2c5b500", 52059408),
     "linux-aarch64": _jre("OpenJDK21U-jre_aarch64_linux_hotspot_21.0.12.1_1.tar.gz",
                           "14be1f35ebdbd1f6e8d57eb911a3ffb74d6d9aa255abc5daf2b1302002cf2cf2", 51149460),
     "macos-x86_64": _jre("OpenJDK21U-jre_x64_mac_hotspot_21.0.12.1_1.tar.gz",
                          "6717ec641fd9ce0bb209ca083ee23b42202ac68cb6fcc5753496e0e4a0f41989", 42131876, prefix=MAC_PREFIX),
     "macos-arm64": _jre("OpenJDK21U-jre_aarch64_mac_hotspot_21.0.12.1_1.tar.gz",
                         "dec50fc6f9fcd4fe3ae8cabf5a5fa68f6afc48841f7698e468e9aa5d54beed84", 48144965, prefix=MAC_PREFIX)},
    provides, override_hint="the java program", check=check, env=env)
